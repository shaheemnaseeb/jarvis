import { useCallback, useEffect, useRef, useState } from "react";

import { JarvisAgent } from "../../../packages/core";
import {
  SilenceWatcher,
  speak,
  transcribeAudio,
  VoiceRecorder,
} from "../../../packages/voice";
import { WakeWordDetector } from "../../../packages/wakeword";

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
  /** Set while a destructive action awaits the user's yes/no. */
  confirmation: string | null;
  respondToConfirmation: (approved: boolean) => void;
  runCommand: (text: string) => Promise<void>;
  toggleListening: () => Promise<void>;
  /** Whether hands-free "Hey Jarvis" standby is on. */
  wakeWordEnabled: boolean;
  toggleWakeWord: () => void;
}

const WAKE_WORD_STORAGE_KEY = "jarvis.wakeword.enabled";

const AFFIRMATIVE =
  /\b(yes|yeah|yep|sure|okay|ok|confirm|go ahead|do it|please do)\b/i;
const NEGATIVE = /\b(no|nope|don'?t|do not|cancel|stop|never mind)\b/i;

function isAffirmative(answer: string): boolean {
  return AFFIRMATIVE.test(answer) && !NEGATIVE.test(answer);
}

function uiMessage(role: UiMessage["role"], text: string): UiMessage {
  return { id: crypto.randomUUID(), role, text };
}

export function useJarvis(): JarvisSession {
  const [phase, setPhase] = useState<JarvisPhase>("idle");
  const [status, setStatus] = useState("");
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const recorderRef = useRef<VoiceRecorder | null>(null);
  const agentRef = useRef<JarvisAgent | null>(null);
  const watcherRef = useRef<SilenceWatcher | null>(null);
  const finalizingRef = useRef(false);
  /** Whether the active listen was auto-opened after a spoken reply. */
  const followUpListenRef = useRef(false);
  /** Breaks the listen -> run -> speak -> listen cycle for useCallback. */
  const startListeningRef = useRef<(followUp: boolean) => Promise<void>>();
  /** Settles the pending confirmation exactly once (voice or button). */
  const confirmSettleRef = useRef<((approved: boolean) => void) | null>(null);

  const getRecorder = () => {
    recorderRef.current ??= new VoiceRecorder();
    return recorderRef.current;
  };

  /**
   * Speaks the confirmation question, then listens for a spoken yes/no.
   * Silence, an unclear answer, or any failure all count as "no" — a
   * destructive action must never proceed by default.
   */
  const requestConfirmation = useCallback((question: string) => {
    return new Promise<boolean>((resolve) => {
      let settled = false;

      const settle = (approved: boolean) => {
        if (settled) {
          return;
        }
        settled = true;

        watcherRef.current?.stop();
        watcherRef.current = null;
        confirmSettleRef.current = null;

        const recorder = getRecorder();
        if (recorder.isRecording) {
          recorder.stop().catch(() => {
            // Already stopping; the clip is discarded either way.
          });
        }

        setConfirmation(null);
        setPhase("thinking");
        setStatus(approved ? "Confirmed." : "Cancelled.");
        resolve(approved);
      };

      confirmSettleRef.current = settle;
      setConfirmation(question);

      void (async () => {
        try {
          setPhase("speaking");
          setStatus(question);
          await speak(question);

          if (settled) {
            return;
          }

          const recorder = getRecorder();
          const stream = await recorder.start();

          const watcher = new SilenceWatcher(
            stream,
            (event) => {
              void (async () => {
                try {
                  const audio = await recorder.stop();

                  if (event === "no-speech") {
                    settle(false);
                    return;
                  }

                  setStatus("Transcribing...");
                  const answer = await transcribeAudio(audio);
                  settle(isAffirmative(answer));
                } catch {
                  settle(false);
                }
              })();
            },
            { silenceMs: 900, noSpeechMs: 5000, maxUtteranceMs: 8000 },
          );
          watcher.start();
          watcherRef.current = watcher;

          setPhase("listening");
        } catch {
          // TTS or mic unavailable: the on-screen buttons remain usable.
          setPhase("idle");
        }
      })();
    });
  }, []);

  const respondToConfirmation = useCallback((approved: boolean) => {
    confirmSettleRef.current?.(approved);
  }, []);

  const getAgent = () => {
    agentRef.current ??= new JarvisAgent(requestConfirmation);
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

  const [wakeWordEnabled, setWakeWordEnabled] = useState(
    () => localStorage.getItem(WAKE_WORD_STORAGE_KEY) === "on",
  );
  const detectorRef = useRef<WakeWordDetector | null>(null);
  const detectorLoadingRef = useRef(false);

  const toggleWakeWord = useCallback(() => {
    setWakeWordEnabled((enabled) => {
      const next = !enabled;
      localStorage.setItem(WAKE_WORD_STORAGE_KEY, next ? "on" : "off");
      if (!next) {
        setStatus("");
      }
      return next;
    });
  }, []);

  /**
   * Runs the local wake word detector whenever Jarvis is idle and standby is
   * enabled. Hearing "hey jarvis" opens the same listening flow as the orb;
   * any other phase (or a pending confirmation) releases the microphone.
   */
  useEffect(() => {
    const shouldRun =
      wakeWordEnabled && phase === "idle" && confirmation === null;

    if (!shouldRun) {
      detectorRef.current?.stop();
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        if (!detectorRef.current) {
          if (detectorLoadingRef.current) {
            return;
          }
          detectorLoadingRef.current = true;
          setStatus("Loading wake word models...");

          detectorRef.current = await WakeWordDetector.load(() => {
            void startListeningRef.current?.(false);
          });
          detectorLoadingRef.current = false;
        }

        if (!cancelled) {
          await detectorRef.current.start();
          setStatus('Standby — say "Hey Jarvis".');
        }
      } catch (error) {
        detectorLoadingRef.current = false;
        setWakeWordEnabled(false);
        setStatus(`Wake word unavailable: ${String(error)}`);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [wakeWordEnabled, phase, confirmation]);

  /** Release the microphone when the component unmounts. */
  useEffect(() => {
    return () => {
      detectorRef.current?.stop();
    };
  }, []);

  const toggleListening = useCallback(async () => {
    // While a confirmation is pending, the confirmation flow owns the mic.
    if (confirmSettleRef.current) {
      return;
    }

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

  return {
    phase,
    status,
    messages,
    confirmation,
    respondToConfirmation,
    runCommand,
    toggleListening,
    wakeWordEnabled,
    toggleWakeWord,
  };
}
