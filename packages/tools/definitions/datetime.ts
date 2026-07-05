import type { ToolDefinition } from "../types";

export const getDatetimeTool: ToolDefinition<Record<string, never>> = {
  name: "get_datetime",
  description:
    "Get the current local date and time. Use whenever the user asks about the date, day, or time.",
  parameters: {
    type: "object",
    properties: {},
    required: [],
    additionalProperties: false,
  },
  parseArgs: () => ({}),
  execute: async () => {
    const now = new Date().toLocaleString(undefined, {
      dateStyle: "full",
      timeStyle: "short",
    });
    return `It is ${now}.`;
  },
};
