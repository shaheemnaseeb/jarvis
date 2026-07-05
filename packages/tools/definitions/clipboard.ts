import { clipboardRead, clipboardWrite } from "../../actions/clipboard";
import type { ClipboardWriteArgs } from "../../shared/types";
import type { ToolDefinition } from "../types";
import { requireStringField } from "../validation";

export const clipboardReadTool: ToolDefinition<Record<string, never>> = {
  name: "clipboard_read",
  description:
    "Read the current text content of the system clipboard, e.g. to answer questions about what the user copied.",
  parameters: {
    type: "object",
    properties: {},
    required: [],
    additionalProperties: false,
  },
  parseArgs: () => ({}),
  execute: async () => {
    const text = await clipboardRead();
    return text.trim() ? `Clipboard contains: ${text}` : "The clipboard is empty.";
  },
};

export const clipboardWriteTool: ToolDefinition<ClipboardWriteArgs> = {
  name: "clipboard_write",
  description: "Replace the system clipboard content with the given text.",
  parameters: {
    type: "object",
    properties: {
      text: {
        type: "string",
        description: "The exact text to place on the clipboard.",
      },
    },
    required: ["text"],
    additionalProperties: false,
  },
  parseArgs: (raw) => ({
    text: requireStringField(raw, "text", "clipboard_write"),
  }),
  execute: ({ text }) => clipboardWrite(text),
};
