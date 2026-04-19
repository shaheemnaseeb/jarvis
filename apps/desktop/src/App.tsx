import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

function App() {
  const [status, setStatus] = useState("");

  const handleOpenApp = async (app: string) => {
    setStatus(`Launching ${app}...`);

    try {
      const result = await invoke<string>("open_app", { app });
      setStatus(result);
    } catch (error) {
      setStatus(`Failed to open ${app}: ${String(error)}`);
    }
  };

  return (
    <div style={{ padding: 20, fontFamily: "sans-serif" }}>
      <h1>Jarvis</h1>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => handleOpenApp("spotify")}>Open Spotify</button>
        <button onClick={() => handleOpenApp("chrome")}>Open Chrome</button>
      </div>

      <p style={{ marginTop: 12 }}>{status}</p>
    </div>
  );
}

export default App;
