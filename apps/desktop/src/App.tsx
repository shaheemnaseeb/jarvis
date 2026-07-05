import { FormEvent, useEffect, useRef, useState } from "react";

import { useJarvis, type JarvisPhase } from "./useJarvis";
import "./App.css";

const PHASE_LABELS: Record<JarvisPhase, string> = {
  idle: "Standby",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
};

const QUICK_COMMANDS = [
  { label: "Open Spotify", command: "open spotify" },
  { label: "Open Chrome", command: "open chrome" },
  { label: "Play / Pause", command: "toggle playback" },
  { label: "What's on my clipboard?", command: "what's on my clipboard?" },
];

function App() {
  const jarvis = useJarvis();
  const [command, setCommand] = useState("");
  const logEndRef = useRef<HTMLDivElement | null>(null);

  const busy =
    jarvis.phase === "thinking" ||
    jarvis.phase === "speaking" ||
    jarvis.confirmation !== null;

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [jarvis.messages]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const text = command.trim();
    if (!text || jarvis.phase !== "idle") {
      return;
    }

    setCommand("");
    await jarvis.runCommand(text);
  };

  return (
    <div className="app">
      <header className="header">
        <div className="wordmark">
          JARVIS<span>.</span>
        </div>
        <div className="phase-label" data-phase={jarvis.phase}>
          {PHASE_LABELS[jarvis.phase]}
        </div>
      </header>

      <section className="stage">
        <button
          className="orb"
          data-phase={jarvis.phase}
          onClick={() => void jarvis.toggleListening()}
          disabled={busy}
          aria-label={
            jarvis.phase === "listening" ? "Stop and send" : "Start listening"
          }
          title={jarvis.phase === "listening" ? "Stop & send" : "Speak"}
        >
          <span className="orb-ring" />
          <span className="orb-core" />
        </button>
        <p className="status">{jarvis.status}</p>

        {jarvis.confirmation && (
          <div className="confirm-bar">
            <span className="confirm-question">{jarvis.confirmation}</span>
            <button
              className="confirm-yes"
              onClick={() => jarvis.respondToConfirmation(true)}
            >
              Yes
            </button>
            <button
              className="confirm-no"
              onClick={() => jarvis.respondToConfirmation(false)}
            >
              No
            </button>
          </div>
        )}
      </section>

      <section className="log">
        {jarvis.messages.length === 0 ? (
          <p className="log-empty">
            Click the orb and speak, or type a command below.
            <br />
            Try “open spotify and turn up the volume”.
          </p>
        ) : (
          jarvis.messages.map((message) => (
            <div key={message.id} className={`bubble ${message.role}`}>
              {message.text}
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </section>

      <footer className="composer">
        <form onSubmit={(event) => void handleSubmit(event)}>
          <input
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            placeholder="Type a command…"
            disabled={jarvis.phase !== "idle"}
          />
          <button className="send" type="submit" disabled={jarvis.phase !== "idle"}>
            Send
          </button>
        </form>

        <div className="chips">
          {QUICK_COMMANDS.map(({ label, command: quick }) => (
            <button
              key={quick}
              className="chip"
              disabled={jarvis.phase !== "idle"}
              onClick={() => void jarvis.runCommand(quick)}
            >
              {label}
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
}

export default App;
