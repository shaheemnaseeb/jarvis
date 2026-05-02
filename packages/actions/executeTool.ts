import type { ToolCall } from "../shared/types";
import { openApp } from "./openApp";
import { openUrl } from "./openUrl";

export async function executeTool(call: ToolCall): Promise<string> {
  switch (call.tool) {
    case "open_app":
      return openApp(call.args.app);
    case "open_url":
      return openUrl(call.args.url);
  }
}
