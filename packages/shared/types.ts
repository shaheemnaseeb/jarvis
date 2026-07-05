export const TOOL_NAMES = [
  "open_app",
  "open_url",
  "clipboard_read",
  "clipboard_write",
  "media_control",
  "volume_control",
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

export const MEDIA_ACTIONS = ["play_pause", "next", "previous"] as const;
export type MediaAction = (typeof MEDIA_ACTIONS)[number];

export const VOLUME_ACTIONS = ["up", "down", "mute"] as const;
export type VolumeAction = (typeof VOLUME_ACTIONS)[number];

export interface OpenAppArgs {
  app: string;
}

export interface OpenUrlArgs {
  url: string;
}

export interface ClipboardWriteArgs {
  text: string;
}

export interface MediaControlArgs {
  action: MediaAction;
}

export interface VolumeControlArgs {
  action: VolumeAction;
}

export type ToolCall =
  | { tool: "open_app"; args: OpenAppArgs }
  | { tool: "open_url"; args: OpenUrlArgs }
  | { tool: "clipboard_read"; args: Record<string, never> }
  | { tool: "clipboard_write"; args: ClipboardWriteArgs }
  | { tool: "media_control"; args: MediaControlArgs }
  | { tool: "volume_control"; args: VolumeControlArgs };
