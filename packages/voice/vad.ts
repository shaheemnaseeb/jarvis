/** Why the watcher decided the utterance is over. */
export type SilenceWatcherEvent = "silence" | "no-speech" | "max-duration";

export interface SilenceWatcherOptions {
  /** RMS level (0..1) above which audio counts as speech. */
  speechThreshold?: number;
  /** Silence duration after speech that ends the utterance. */
  silenceMs?: number;
  /** Give up if no speech is heard within this window. */
  noSpeechMs?: number;
  /** Hard cap on utterance length. */
  maxUtteranceMs?: number;
}

const DEFAULTS: Required<SilenceWatcherOptions> = {
  speechThreshold: 0.015,
  silenceMs: 1200,
  noSpeechMs: 6000,
  maxUtteranceMs: 20000,
};

const CHECK_INTERVAL_MS = 60;

/**
 * Watches a live microphone stream and fires `onDone` once, when the speaker
 * pauses (or never speaks, or talks past the cap). Analysis is fully local —
 * audio only leaves the machine after the recorder hands over the final clip.
 */
export class SilenceWatcher {
  private readonly options: Required<SilenceWatcherOptions>;
  private context: AudioContext | null = null;
  private timer: number | null = null;
  private done = false;

  constructor(
    private readonly stream: MediaStream,
    private readonly onDone: (event: SilenceWatcherEvent) => void,
    options: SilenceWatcherOptions = {},
  ) {
    this.options = { ...DEFAULTS, ...options };
  }

  start(): void {
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    context.createMediaStreamSource(this.stream).connect(analyser);

    const samples = new Uint8Array(analyser.fftSize);
    const startedAt = performance.now();
    let heardSpeech = false;
    let lastLoudAt = startedAt;

    this.context = context;
    this.timer = window.setInterval(() => {
      analyser.getByteTimeDomainData(samples);

      let sumSquares = 0;
      for (const sample of samples) {
        const centered = (sample - 128) / 128;
        sumSquares += centered * centered;
      }
      const rms = Math.sqrt(sumSquares / samples.length);

      const now = performance.now();

      if (rms >= this.options.speechThreshold) {
        heardSpeech = true;
        lastLoudAt = now;
      }

      if (now - startedAt >= this.options.maxUtteranceMs) {
        this.finish(heardSpeech ? "max-duration" : "no-speech");
      } else if (heardSpeech) {
        if (now - lastLoudAt >= this.options.silenceMs) {
          this.finish("silence");
        }
      } else if (now - startedAt >= this.options.noSpeechMs) {
        this.finish("no-speech");
      }
    }, CHECK_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }

    this.context?.close().catch(() => {
      // Context may already be closed; nothing to do.
    });
    this.context = null;
  }

  private finish(event: SilenceWatcherEvent): void {
    if (this.done) {
      return;
    }

    this.done = true;
    this.stop();
    this.onDone(event);
  }
}
