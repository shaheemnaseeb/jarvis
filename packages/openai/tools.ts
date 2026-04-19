import { openApp } from "../actions/openApp";
import { openUrl } from "../actions/openUrl";

export function handleCommand(text: string) {
  const lower = text.toLowerCase();

  if (lower.includes("spotify")) {
    openApp("spotify");
  } else if (lower.includes("youtube")) {
    openUrl("https://youtube.com");
  } else {
    console.log("Unknown command:", text);
  }
}
