import { useCallback, useRef, useState } from "react";

import { JarvisAgent } from "../../../packages/core";
import { speak, transcribeAudio, VoiceRecorder } from "../../../packages/voice";

/**
 * Session phases. The wake word engine will later drive the same
 * listening -> thinking -> speaking cycle that the mic button does today.
 */
export type JarvisPhase = "idle" | "listening" | "thinking" | "speaking";

export interface UiMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

export interface JarvisSession {
  phase: JarvisPhase;
  status: string;
  messages: UiMessage[];
  runCommand: (text: string) => Promise<void>;
  toggleListening: () => Promise<void>;
}

function uiMessage(role: UiMessage["role"], text: string): UiMessage {
  return { id: crypto.randomUUID(), role, text };
}

export function useJarvis(): JarvisSession {
  const [phase, setPhase] = useState<JarvisPhase>("idle");
  const [status, setStatus] = useState("");
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const recorderRef = useRef<VoiceRecorder | null>(null);
  const agentRef = useRef<JarvisAgent | null>(null);

  const getRecorder = () => {
    recorderRef.current ??= new VoiceRecorder();
    return recorderRef.current;
  };

  const getAgent = () => {
    agentRef.current ??= new JarvisAgent();
    return agentRef.current;
  };

  const runCommand = useCallback(async (text: string) => {
    setPhase("thinking");
    setStatus("Thinking...");
    setMessages((previous) => [...previous, uiMessage("user", text)]);

    try {
      const reply = await getAgent().handleUserTurn(text, setStatus);

      setMessages((previous) => [...previous, uiMessage("assistant", reply)]);
      setStatus("");
      setPhase("speaking");
      try {
        await speak(reply);
      } catch {
        // Voice output is best-effort; the reply is already in the log.
      }
    } catch (error) {
      const failure = `Something went wrong: ${String(error)}`;
      setMessages((previous) => [...previous, uiMessage("assistant", failure)]);
      setStatus("");
    } finally {
      setPhase("idle");
    }
  }, []);

  const toggleListening = useCallback(async () => {
    const recorder = getRecorder();

    if (recorder.isRecording) {
      setPhase("thinking");
      setStatus("Transcribing...");

      try {
        const audio = await recorder.stop();
        const text = await transcribeAudio(audio);

        if (text.trim()) {
          await runCommand(text);
        } else {
          setStatus("I didn't hear anything.");
          setPhase("idle");
        }
      } catch (error) {
        setStatus(`Voice input failed: ${String(error)}`);
        setPhase("idle");
      }

      return;
    }

    if (phase !== "idle") {
      return;
    }

    try {
      await recorder.start();
      setPhase("listening");
      setStatus("Listening...");
    } catch (error) {
      setStatus(`Microphone unavailable: ${String(error)}`);
    }
  }, [phase, runCommand]);

  return { phase, status, messages, runCommand, toggleListening };
}
