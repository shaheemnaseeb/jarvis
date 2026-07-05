import { systemInfo } from "../../actions/system";
import type { ToolDefinition } from "../types";

export const systemInfoTool: ToolDefinition<Record<string, never>> = {
  name: "system_info",
  description:
    "Get information about this computer: operating system, hostname, CPU, and memory usage.",
  parameters: {
    type: "object",
    properties: {},
    required: [],
    additionalProperties: false,
  },
  parseArgs: () => ({}),
  execute: () => systemInfo(),
};
