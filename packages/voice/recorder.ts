const PREFERRED_MIME_TYPE = "audio/webm;codecs=opus";

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") {
    return undefined;
  }

  if (MediaRecorder.isTypeSupported(PREFERRED_MIME_TYPE)) {
    return PREFERRED_MIME_TYPE;
  }

  if (MediaRecorder.isTypeSupported("audio/webm")) {
    return "audio/webm";
  }

  return undefined;
}

/**
 * Wraps MediaRecorder for one command recording at a time. The wake word
 * engine will later call the same start/stop pair that the mic button does.
 */
export class VoiceRecorder {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];

  get isRecording(): boolean {
    return this.recorder?.state === "recording";
  }

  /** Starts recording and returns the live stream (e.g. for silence analysis). */
  async start(): Promise<MediaStream> {
    if (this.isRecording && this.stream) {
      return this.stream;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.stream = stream;
    this.chunks = [];

    const mimeType = pickMimeType();
    this.recorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType } : undefined,
    );
    this.recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.chunks.push(event.data);
      }
    };
    this.recorder.start();

    return stream;
  }

  async stop(): Promise<Blob> {
    const recorder = this.recorder;

    if (!recorder || recorder.state !== "recording") {
      throw new Error("not recording");
    }

    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });
    recorder.stop();
    await stopped;

    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.recorder = null;

    return new Blob(this.chunks, { type: recorder.mimeType || "audio/webm" });
  }
}
