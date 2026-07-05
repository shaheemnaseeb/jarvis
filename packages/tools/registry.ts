import type { ToolCall, ToolName } from "../shared/types";
import { openAppTool } from "./definitions/openApp";
import { openUrlTool } from "./definitions/openUrl";
import type { ToolDefinition } from "./types";

/** Every tool the AI may select. Adding a tool means adding one entry here. */
export const toolDefinitions: ReadonlyArray<ToolDefinition<unknown>> = [
  openAppTool,
  openUrlTool,
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

export async function executeTool(call: ToolCall): Promise<string> {
  const definition = registry.get(call.tool);

  if (!definition) {
    throw new Error(`no tool registered for '${call.tool}'`);
  }

  return definition.execute(call.args);
}
