import { invoke } from "@tauri-apps/api/core";

import { playBase64Audio } from "./audio";

const SPEECH_MODEL = "gpt-4o-mini-tts";
const SPEECH_VOICE = "onyx";

/** Speaks the given text aloud; resolves when playback finishes. */
export async function speak(text: string): Promise<void> {
  const audioBase64 = await invoke<string>("openai_speech", {
    request: {
      model: SPEECH_MODEL,
      voice: SPEECH_VOICE,
      input: text,
      response_format: "mp3",
    },
  });

  await playBase64Audio(audioBase64, "audio/mpeg");
}
