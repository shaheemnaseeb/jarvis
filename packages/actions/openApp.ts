import { exec } from "child_process";

export function openApp(app: string) {
  console.log("Opening app:", app);

  const appMap: Record<string, string> = {
    spotify: "start spotify",
    chrome: "start chrome",
    vscode: "code",
  };

  const command = appMap[app.toLowerCase()];

  if (!command) {
    console.log("App not supported yet");
    return;
  }

  exec(command);
}
