import { openApp } from "../../actions/openApp";
import type { OpenAppArgs } from "../../shared/types";
import type { ToolDefinition } from "../types";
import { requireStringField } from "../validation";

export const openAppTool: ToolDefinition<OpenAppArgs> = {
  name: "open_app",
  description:
    "Launch a desktop application installed on this computer. Supported apps: " +
    "spotify, chrome, edge, notepad, calculator, vscode, explorer, terminal, settings.",
  parameters: {
    type: "object",
    properties: {
      app: {
        type: "string",
        description:
          "Lowercase application identifier, e.g. 'spotify', 'notepad', or 'vscode'.",
      },
    },
    required: ["app"],
    additionalProperties: false,
  },
  parseArgs: (raw) => ({ app: requireStringField(raw, "app", "open_app") }),
  execute: ({ app }) => openApp(app),
};
