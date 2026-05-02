import type { ToolCall } from "../shared/types";

const YOUTUBE_URL = "https://youtube.com";

export function parseCommand(text: string): ToolCall | null {
  const normalized = text.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  if (normalized.includes("spotify")) {
    return {
      tool: "open_app",
      args: {
        app: "spotify",
      },
    };
  }

  if (normalized.includes("chrome")) {
    return {
      tool: "open_app",
      args: {
        app: "chrome",
      },
    };
  }

  if (normalized.includes("youtube")) {
    return {
      tool: "open_url",
      args: {
        url: YOUTUBE_URL,
      },
    };
  }

  return null;
}
