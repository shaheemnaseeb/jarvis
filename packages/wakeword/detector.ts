// The wasm-only entry point: the default export additionally registers the
// WebGPU/WebNN backends, which require the larger "jsep" runtime files that
// this app does not ship in public/ort.
import * as ort from "onnxruntime-web/wasm";

/**
 * Local "hey jarvis" wake word detection using openWakeWord's pretrained
 * ONNX models (https://github.com/dscripka/openWakeWord), run in-process
 * with onnxruntime-web. Everything happens on this machine: microphone
 * audio is never sent anywhere while listening for the wake word.
 *
 * The pipeline mirrors openWakeWord's streaming design:
 *   16 kHz mono audio, in 80 ms chunks of 1280 samples
 *     -> melspectrogram model (8 new mel frames per chunk, 32 bins each)
 *     -> embedding model over the last 76 mel frames (one 96-dim vector)
 *     -> classifier over the last 16 embeddings (score 0..1)
 */

const SAMPLE_RATE = 16_000;
/** openWakeWord processes audio in 80 ms hops. */
const CHUNK_SAMPLES = 1_280;
/** The melspectrogram model emits floor(n/160) - 3 frames (640-sample
 * window, 160-sample hop), so carrying the last 480 samples between chunks
 * yields exactly 8 contiguous frames per 1280-sample chunk. */
const CHUNK_LOOKBACK_SAMPLES = 480;
const MEL_BINS = 32;
const MEL_FRAMES_PER_EMBEDDING = 76;
const EMBEDDING_SIZE = 96;
const EMBEDDINGS_PER_PREDICTION = 16;

export interface WakeWordOptions {
  /** Classifier score (0..1) treated as a detection. */
  threshold?: number;
  /** Ignore further detections for this long after one fires. */
  cooldownMs?: number;
  /** Where the .onnx files are served from. */
  modelBasePath?: string;
  /** Where the onnxruntime .wasm binary is served from. */
  wasmBasePath?: string;
}

const DEFAULTS: Required<WakeWordOptions> = {
  threshold: 0.5,
  cooldownMs: 2_500,
  modelBasePath: "/models/openwakeword",
  wasmBasePath: "/ort/",
};

/** Minimal audio worklet that forwards raw samples to the main thread. */
const CAPTURE_WORKLET = `
  class JarvisCapture extends AudioWorkletProcessor {
    process(inputs) {
      const channel = inputs[0] && inputs[0][0];
      if (channel && channel.length > 0) {
        this.port.postMessage(channel.slice(0));
      }
      return true;
    }
  }
  registerProcessor("jarvis-capture", JarvisCapture);
`;

export class WakeWordDetector {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private worklet: AudioWorkletNode | null = null;

  /** Raw samples waiting to fill the next 1280-sample chunk. */
  private pendingSamples: Float32Array[] = [];
  private pendingLength = 0;
  /** Tail of the previous chunk, for mel window alignment. */
  private lookback = new Float32Array(0);

  private melFrames: Float32Array[] = [];
  private embeddings: Float32Array[] = [];

  /** Serializes inference so chunks never race each other. */
  private inference: Promise<void> = Promise.resolve();
  private queued = 0;
  private lastWakeAt = 0;
  private running = false;

  private constructor(
    private readonly melspec: ort.InferenceSession,
    private readonly embedder: ort.InferenceSession,
    private readonly classifier: ort.InferenceSession,
    private readonly onWake: (score: number) => void,
    private readonly options: Required<WakeWordOptions>,
  ) {}

  /** Downloads and initializes the three models (a few MB, one-time). */
  static async load(
    onWake: (score: number) => void,
    options: WakeWordOptions = {},
  ): Promise<WakeWordDetector> {
    const settings = { ...DEFAULTS, ...options };

    // Point at the .wasm binary only: the bundle entry embeds the JS
    // loader, and Vite forbids importing (rather than fetching) files
    // that live in /public.
    ort.env.wasm.wasmPaths = {
      wasm: `${settings.wasmBasePath}ort-wasm-simd-threaded.wasm`,
    };
    ort.env.wasm.numThreads = 1;

    const [melspec, embedder, classifier] = await Promise.all([
      ort.InferenceSession.create(`${settings.modelBasePath}/melspectrogram.onnx`),
      ort.InferenceSession.create(`${settings.modelBasePath}/embedding_model.onnx`),
      ort.InferenceSession.create(`${settings.modelBasePath}/hey_jarvis_v0.1.onnx`),
    ]);

    return new WakeWordDetector(melspec, embedder, classifier, onWake, settings);
  }

  get isRunning(): boolean {
    return this.running;
  }

  /** Opens the microphone and begins watching for the wake word. */
  async start(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    this.resetBuffers();

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const context = new AudioContext({ sampleRate: SAMPLE_RATE });
      this.context = context;

      const workletUrl = URL.createObjectURL(
        new Blob([CAPTURE_WORKLET], { type: "text/javascript" }),
      );
      try {
        await context.audioWorklet.addModule(workletUrl);
      } finally {
        URL.revokeObjectURL(workletUrl);
      }

      const source = context.createMediaStreamSource(this.stream);
      const worklet = new AudioWorkletNode(context, "jarvis-capture");
      this.worklet = worklet;

      worklet.port.onmessage = (event: MessageEvent<Float32Array>) => {
        this.ingest(event.data);
      };

      source.connect(worklet);
    } catch (error) {
      this.stop();
      throw error;
    }
  }

  stop(): void {
    this.running = false;

    if (this.worklet) {
      this.worklet.port.onmessage = null;
      this.worklet.disconnect();
      this.worklet = null;
    }

    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;

    this.context?.close().catch(() => {
      // Context may already be closed; nothing to do.
    });
    this.context = null;

    this.resetBuffers();
  }

  private resetBuffers(): void {
    this.pendingSamples = [];
    this.pendingLength = 0;
    this.lookback = new Float32Array(0);
    this.melFrames = [];
    this.embeddings = [];
    this.queued = 0;
  }

  /** Collects worklet packets until a full 80 ms chunk is available. */
  private ingest(samples: Float32Array): void {
    if (!this.running) {
      return;
    }

    this.pendingSamples.push(samples);
    this.pendingLength += samples.length;

    while (this.pendingLength >= CHUNK_SAMPLES) {
      const chunk = new Float32Array(CHUNK_SAMPLES);
      let filled = 0;

      while (filled < CHUNK_SAMPLES) {
        const head = this.pendingSamples[0];
        const take = Math.min(head.length, CHUNK_SAMPLES - filled);

        chunk.set(head.subarray(0, take), filled);
        filled += take;

        if (take === head.length) {
          this.pendingSamples.shift();
        } else {
          this.pendingSamples[0] = head.subarray(take);
        }
      }

      this.pendingLength -= CHUNK_SAMPLES;
      this.enqueueChunk(chunk);
    }
  }

  private enqueueChunk(chunk: Float32Array): void {
    // If inference ever falls behind the microphone, drop audio instead of
    // building an ever-growing backlog.
    if (this.queued >= 4) {
      return;
    }

    this.queued += 1;
    this.inference = this.inference
      .then(() => this.processChunk(chunk))
      .catch(() => {
        // A failed chunk only costs one 80 ms window; keep listening.
      })
      .finally(() => {
        this.queued -= 1;
      });
  }

  private async processChunk(chunk: Float32Array): Promise<void> {
    if (!this.running) {
      return;
    }

    // The models were trained on 16-bit PCM sample values, not [-1, 1].
    const window = new Float32Array(this.lookback.length + chunk.length);
    window.set(this.lookback, 0);
    for (let index = 0; index < chunk.length; index++) {
      window[this.lookback.length + index] = chunk[index] * 32768;
    }

    this.lookback = window.slice(window.length - CHUNK_LOOKBACK_SAMPLES);

    // Until the first lookback exists, the window is one hop short; the
    // melspectrogram model handles either length.
    const melResult = await this.run(this.melspec, window, [1, window.length]);

    // Output is [1, 1, frames, 32]; openWakeWord rescales every value.
    const frameCount = Math.floor(melResult.length / MEL_BINS);
    for (let frame = 0; frame < frameCount; frame++) {
      const bins = new Float32Array(MEL_BINS);
      for (let bin = 0; bin < MEL_BINS; bin++) {
        bins[bin] = melResult[frame * MEL_BINS + bin] / 10 + 2;
      }
      this.melFrames.push(bins);
    }

    if (this.melFrames.length < MEL_FRAMES_PER_EMBEDDING) {
      return;
    }
    this.melFrames = this.melFrames.slice(-MEL_FRAMES_PER_EMBEDDING);

    const melInput = new Float32Array(MEL_FRAMES_PER_EMBEDDING * MEL_BINS);
    this.melFrames.forEach((frame, index) => {
      melInput.set(frame, index * MEL_BINS);
    });

    const embedding = await this.run(this.embedder, melInput, [
      1,
      MEL_FRAMES_PER_EMBEDDING,
      MEL_BINS,
      1,
    ]);

    this.embeddings.push(Float32Array.from(embedding));
    if (this.embeddings.length < EMBEDDINGS_PER_PREDICTION) {
      return;
    }
    this.embeddings = this.embeddings.slice(-EMBEDDINGS_PER_PREDICTION);

    const features = new Float32Array(
      EMBEDDINGS_PER_PREDICTION * EMBEDDING_SIZE,
    );
    this.embeddings.forEach((vector, index) => {
      features.set(vector, index * EMBEDDING_SIZE);
    });

    const scores = await this.run(this.classifier, features, [
      1,
      EMBEDDINGS_PER_PREDICTION,
      EMBEDDING_SIZE,
    ]);
    const score = scores[scores.length - 1];

    const now = performance.now();
    if (
      score >= this.options.threshold &&
      now - this.lastWakeAt >= this.options.cooldownMs &&
      this.running
    ) {
      this.lastWakeAt = now;
      this.onWake(score);
    }
  }

  private async run(
    session: ort.InferenceSession,
    data: Float32Array,
    dims: number[],
  ): Promise<Float32Array> {
    const feeds = {
      [session.inputNames[0]]: new ort.Tensor("float32", data, dims),
    };
    const results = await session.run(feeds);
    return results[session.outputNames[0]].data as Float32Array;
  }
}
