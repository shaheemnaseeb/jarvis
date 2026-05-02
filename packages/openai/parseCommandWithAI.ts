import { invoke } from "@tauri-apps/api/core";

import type { ToolCall } from "../shared/types";

export async function parseCommandWithAI(
  text: string,
): Promise<ToolCall | null> {
  return invoke<ToolCall | null>("parse_command_ai", { text });
}
