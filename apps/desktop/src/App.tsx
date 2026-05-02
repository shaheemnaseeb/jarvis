import { FormEvent, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { executeTool } from "../../../packages/actions/executeTool";
import { parseCommand } from "../../../packages/ai/tools";

function App() {
  const [status, setStatus] = useState("");
  const [command, setCommand] = useState("");

  const handleOpenApp = async (app: string) => {
    setStatus(`Launching ${app}...`);

    try {
      const result = await invoke<string>("open_app", { app });
      setStatus(result);
    } catch (error) {
      setStatus(`Failed to open ${app}: ${String(error)}`);
    }
  };

  const handleRunCommand = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsed = parseCommand(command);

    if (!parsed) {
      setStatus("Command not recognized.");
      return;
    }

    setStatus(`Executing ${parsed.tool}...`);

    try {
      const result = await executeTool(parsed);
      setStatus(result);
    } catch (error) {
      setStatus(`Failed to execute command: ${String(error)}`);
    }
  };

  return (
    <div style={{ padding: 20, fontFamily: "sans-serif" }}>
      <h1>Jarvis</h1>

      <form
        onSubmit={handleRunCommand}
        style={{ display: "flex", gap: 8, marginBottom: 16 }}
      >
        <input
          value={command}
          onChange={(event) => setCommand(event.target.value)}
          placeholder='Type a command like "open spotify"'
          style={{ flex: 1, padding: 8 }}
        />
        <button type="submit">Run Command</button>
      </form>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => handleOpenApp("spotify")}>Open Spotify</button>
        <button onClick={() => handleOpenApp("chrome")}>Open Chrome</button>
      </div>

      <p style={{ marginTop: 12 }}>{status}</p>
    </div>
  );
}

export default App;
