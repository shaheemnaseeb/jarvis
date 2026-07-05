import type { ToolName } from "../shared/types";

/**
 * JSON Schema subset for tool parameters, compatible with OpenAI strict
 * function calling (which requires `additionalProperties: false` and every
 * property listed in `required`).
 */
export interface ToolParameterSchema {
  type: "object";
  properties: Record<
    string,
    { type: "string"; description: string; enum?: readonly string[] }
  >;
  required: string[];
  additionalProperties: false;
}

/**
 * A tool the AI may select. The registry is the single source of truth:
 * the schema shown to the model, the validation of its output, and the
 * execution path all come from the same definition.
 */
export interface ToolDefinition<TArgs> {
  name: ToolName;
  description: string;
  parameters: ToolParameterSchema;
  /** Validates raw model-provided args into typed args; throws on mismatch. */
  parseArgs(raw: unknown): TArgs;
  execute(args: TArgs): Promise<string>;
  /**
   * When present, the tool is destructive: the returned question must be
   * answered affirmatively by the user before `execute` may run.
   */
  confirmQuestion?(args: TArgs): string;
}
