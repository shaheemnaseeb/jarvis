import { showDesktop, systemInfo, systemPower } from "../../actions/system";
import { POWER_ACTIONS, type SystemPowerArgs } from "../../shared/types";
import type { ToolDefinition } from "../types";
import { requireEnumField } from "../validation";

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

export const systemPowerTool: ToolDefinition<SystemPowerArgs> = {
  name: "system_power",
  description:
    "Control the computer's power state: lock the screen, go to sleep, " +
    "shut down, or restart. Shutdown and restart ask the user to confirm.",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        description: "The power action to perform.",
        enum: POWER_ACTIONS,
      },
    },
    required: ["action"],
    additionalProperties: false,
  },
  parseArgs: (raw) => ({
    action: requireEnumField(raw, "action", POWER_ACTIONS, "system_power"),
  }),
  execute: ({ action }) => systemPower(action),
  confirmQuestion: ({ action }) =>
    action === "shutdown" || action === "restart"
      ? `${action === "shutdown" ? "Shut down" : "Restart"} the computer — yes or no?`
      : null,
};

export const showDesktopTool: ToolDefinition<Record<string, never>> = {
  name: "show_desktop",
  description:
    "Minimize all open windows and show the desktop.",
  parameters: {
    type: "object",
    properties: {},
    required: [],
    additionalProperties: false,
  },
  parseArgs: () => ({}),
  execute: () => showDesktop(),
};
