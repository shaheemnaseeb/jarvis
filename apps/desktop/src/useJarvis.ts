import { useCallback, useRef, useState } from "react";

import { JarvisAgent } from "../../../packages/core";
import {
  SilenceWatcher,
  speak,
  transcribeAudio,
  VoiceRecorder,
} from "../../../packages/voice";

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
  const watcherRef = useRef<SilenceWatcher | null>(null);
  const finalizingRef = useRef(false);
  /** Whether the active listen was auto-opened after a spoken reply. */
  const followUpListenRef = useRef(false);
  /** Breaks the listen -> run -> speak -> listen cycle for useCallback. */
  const startListeningRef = useRef<(followUp: boolean) => Promise<void>>();

  const getRecorder = () => {
    recorderRef.current ??= new VoiceRecorder();
    return recorderRef.current;
  };

  const getAgent = () => {
    agentRef.current ??= new JarvisAgent();
    return agentRef.current;
  };

  const runCommand = useCallback(async (text: string, followUp = false) => {
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

      // Voice conversations continue: reopen the mic for a follow-up.
      if (followUp) {
        await startListeningRef.current?.(true);
        return;
      }
    } catch (error) {
      setMessages((previous) => [
        ...previous,
        uiMessage("assistant", `Something went wrong: ${String(error)}`),
      ]);
      setStatus("");
    }

    setPhase("idle");
  }, []);

  /**
   * Ends the current recording exactly once (silence auto-stop and manual
   * orb clicks both land here). `cancelled` skips transcription entirely.
   */
  const finishListening = useCallback(
    async (cancelled: boolean) => {
      if (finalizingRef.current) {
        return;
      }
      finalizingRef.current = true;

      watcherRef.current?.stop();
      watcherRef.current = null;

      const wasFollowUp = followUpListenRef.current;
      followUpListenRef.current = false;

      try {
        const recorder = getRecorder();

        if (!recorder.isRecording) {
          return;
        }

        if (cancelled) {
          await recorder.stop();
          // A silent follow-up window just means the conversation is over.
          setStatus(wasFollowUp ? "" : "I didn't hear anything.");
          setPhase("idle");
          return;
        }

        setPhase("thinking");
        setStatus("Transcribing...");

        const audio = await recorder.stop();
        const text = await transcribeAudio(audio);

        if (text.trim()) {
          await runCommand(text, true);
        } else {
          setStatus(wasFollowUp ? "" : "I didn't hear anything.");
          setPhase("idle");
        }
      } catch (error) {
        setStatus(`Voice input failed: ${String(error)}`);
        setPhase("idle");
      } finally {
        finalizingRef.current = false;
      }
    },
    [runCommand],
  );

  const startListening = useCallback(
    async (followUp: boolean) => {
      const recorder = getRecorder();

      if (recorder.isRecording) {
        return;
      }

      try {
        const stream = await recorder.start();

        const watcher = new SilenceWatcher(stream, (event) => {
          void finishListening(event === "no-speech");
        });
        watcher.start();
        watcherRef.current = watcher;
        followUpListenRef.current = followUp;

        setPhase("listening");
        setStatus(
          followUp
            ? "Listening — anything else?"
            : "Listening — I'll send when you pause.",
        );
      } catch (error) {
        setStatus(`Microphone unavailable: ${String(error)}`);
        setPhase("idle");
      }
    },
    [finishListening],
  );

  startListeningRef.current = startListening;

  const toggleListening = useCallback(async () => {
    const recorder = getRecorder();

    if (recorder.isRecording) {
      await finishListening(false);
      return;
    }

    if (phase !== "idle") {
      return;
    }

    await startListening(false);
  }, [phase, finishListening, startListening]);

  return { phase, status, messages, runCommand, toggleListening };
}
