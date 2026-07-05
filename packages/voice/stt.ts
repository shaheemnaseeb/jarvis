import { invoke } from "@tauri-apps/api/core";

import { blobToBase64 } from "./audio";

const TRANSCRIPTION_MODEL = "whisper-1";

/** Transcribes a recorded clip through the Rust proxy (key stays backend-side). */
export async function transcribeAudio(audio: Blob): Promise<string> {
  const audioBase64 = await blobToBase64(audio);

  return invoke<string>("openai_transcribe", {
    audioBase64,
    mimeType: audio.type || "audio/webm",
    model: TRANSCRIPTION_MODEL,
  });
}
