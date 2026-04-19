import { exec } from "child_process";

export function openUrl(url: string) {
  console.log("Opening URL:", url);

  try {
    new URL(url);
  } catch {
    console.log("Invalid URL:", url);
    return;
  }

  const escapedUrl = `"${url.replace(/"/g, '\\"')}"`;

  let command: string;
  if (process.platform === "win32") {
    command = `start "" ${escapedUrl}`;
  } else if (process.platform === "darwin") {
    command = `open ${escapedUrl}`;
  } else {
    command = `xdg-open ${escapedUrl}`;
  }

  exec(command, (error) => {
    if (error) {
      console.log("Failed to open URL:", error.message);
    }
  });
}
