export const TOOL_NAMES = ["open_app", "open_url"] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

export interface OpenAppArgs {
  app: string;
}

export interface OpenUrlArgs {
  url: string;
}

export type ToolCall =
  | { tool: "open_app"; args: OpenAppArgs }
  | { tool: "open_url"; args: OpenUrlArgs };
