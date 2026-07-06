import type { ToolCall, ToolName } from "../shared/types";
import { clipboardReadTool, clipboardWriteTool } from "./definitions/clipboard";
import { getDatetimeTool } from "./definitions/datetime";
import {
  appendFileTool,
  copyFileTool,
  createFolderTool,
  deletePathTool,
  listFolderTool,
  moveFileTool,
  openPathTool,
  readFileTool,
  searchFilesTool,
  writeFileTool,
} from "./definitions/files";
import { mediaControlTool, volumeControlTool } from "./definitions/media";
import { openAppTool } from "./definitions/openApp";
import { openUrlTool } from "./definitions/openUrl";
import {
  showDesktopTool,
  systemInfoTool,
  systemPowerTool,
} from "./definitions/system";
import {
  getNewsTool,
  getWeatherTool,
  playSongTool,
  spotifyConnectTool,
} from "./definitions/web";
import type { ToolDefinition } from "./types";

/** Every tool the AI may select. Adding a tool means adding one entry here. */
export const toolDefinitions: ReadonlyArray<ToolDefinition<unknown>> = [
  openAppTool,
  openUrlTool,
  clipboardReadTool,
  clipboardWriteTool,
  mediaControlTool,
  volumeControlTool,
  getDatetimeTool,
  systemInfoTool,
  searchFilesTool,
  openPathTool,
  createFolderTool,
  moveFileTool,
  copyFileTool,
  deletePathTool,
  readFileTool,
  writeFileTool,
  appendFileTool,
  listFolderTool,
  systemPowerTool,
  showDesktopTool,
  playSongTool,
  getWeatherTool,
  getNewsTool,
  spotifyConnectTool,
];

const registry: ReadonlyMap<string, ToolDefinition<unknown>> = new Map(
  toolDefinitions.map((definition) => [definition.name, definition]),
);

export function isKnownTool(name: string): name is ToolName {
  return registry.has(name);
}

/**
 * Converts a raw model tool selection into a validated ToolCall.
 * Throws if the model named an unknown tool or produced malformed args.
 */
export function toToolCall(name: string, rawArgs: unknown): ToolCall {
  const definition = registry.get(name);

  if (!definition) {
    throw new Error(`AI requested unknown tool '${name}'`);
  }

  return { tool: definition.name, args: definition.parseArgs(rawArgs) } as ToolCall;
}

/**
 * Returns the question the user must approve before this call may execute,
 * or null when the tool needs no confirmation.
 */
export function confirmationQuestion(call: ToolCall): string | null {
  const definition = registry.get(call.tool);
  return definition?.confirmQuestion?.(call.args) ?? null;
}

export async function executeTool(call: ToolCall): Promise<string> {
  const definition = registry.get(call.tool);

  if (!definition) {
    throw new Error(`no tool registered for '${call.tool}'`);
  }

  return definition.execute(call.args);
}
