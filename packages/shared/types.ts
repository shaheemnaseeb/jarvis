export const TOOL_NAMES = [
  "open_app",
  "open_url",
  "clipboard_read",
  "clipboard_write",
  "media_control",
  "volume_control",
  "get_datetime",
  "system_info",
  "search_files",
  "open_path",
  "create_folder",
  "move_file",
  "copy_file",
  "delete_path",
  "read_file",
  "write_file",
  "append_file",
  "list_folder",
  "system_power",
  "show_desktop",
  "play_song",
  "get_weather",
  "get_news",
  "spotify_connect",
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

export const MEDIA_ACTIONS = ["play_pause", "next", "previous"] as const;
export type MediaAction = (typeof MEDIA_ACTIONS)[number];

export const VOLUME_ACTIONS = ["up", "down", "mute"] as const;
export type VolumeAction = (typeof VOLUME_ACTIONS)[number];

export const POWER_ACTIONS = ["lock", "sleep", "shutdown", "restart"] as const;
export type PowerAction = (typeof POWER_ACTIONS)[number];

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

export interface SearchFilesArgs {
  query: string;
}

export interface PathArgs {
  path: string;
}

export interface TransferArgs {
  from: string;
  to: string;
}

export interface WriteFileArgs {
  path: string;
  content: string;
}

export interface SystemPowerArgs {
  action: PowerAction;
}

export interface PlaySongArgs {
  query: string;
}

export interface WeatherArgs {
  city: string;
}

export type ToolCall =
  | { tool: "open_app"; args: OpenAppArgs }
  | { tool: "open_url"; args: OpenUrlArgs }
  | { tool: "clipboard_read"; args: Record<string, never> }
  | { tool: "clipboard_write"; args: ClipboardWriteArgs }
  | { tool: "media_control"; args: MediaControlArgs }
  | { tool: "volume_control"; args: VolumeControlArgs }
  | { tool: "get_datetime"; args: Record<string, never> }
  | { tool: "system_info"; args: Record<string, never> }
  | { tool: "search_files"; args: SearchFilesArgs }
  | { tool: "open_path"; args: PathArgs }
  | { tool: "create_folder"; args: PathArgs }
  | { tool: "move_file"; args: TransferArgs }
  | { tool: "copy_file"; args: TransferArgs }
  | { tool: "delete_path"; args: PathArgs }
  | { tool: "read_file"; args: PathArgs }
  | { tool: "write_file"; args: WriteFileArgs }
  | { tool: "append_file"; args: WriteFileArgs }
  | { tool: "list_folder"; args: PathArgs }
  | { tool: "system_power"; args: SystemPowerArgs }
  | { tool: "show_desktop"; args: Record<string, never> }
  | { tool: "play_song"; args: PlaySongArgs }
  | { tool: "get_weather"; args: WeatherArgs }
  | { tool: "get_news"; args: Record<string, never> }
  | { tool: "spotify_connect"; args: Record<string, never> };
