import { mediaControl, volumeControl } from "../../actions/media";
import {
  MEDIA_ACTIONS,
  VOLUME_ACTIONS,
  type MediaControlArgs,
  type VolumeControlArgs,
} from "../../shared/types";
import type { ToolDefinition } from "../types";
import { requireEnumField } from "../validation";

export const mediaControlTool: ToolDefinition<MediaControlArgs> = {
  name: "media_control",
  description:
    "Control media playback on this computer: toggle play/pause, or skip to the next or previous track.",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        description: "The playback action to perform.",
        enum: MEDIA_ACTIONS,
      },
    },
    required: ["action"],
    additionalProperties: false,
  },
  parseArgs: (raw) => ({
    action: requireEnumField(raw, "action", MEDIA_ACTIONS, "media_control"),
  }),
  execute: ({ action }) => mediaControl(action),
};

export const volumeControlTool: ToolDefinition<VolumeControlArgs> = {
  name: "volume_control",
  description:
    "Adjust the system volume: raise it, lower it, or toggle mute.",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        description: "The volume action to perform.",
        enum: VOLUME_ACTIONS,
      },
    },
    required: ["action"],
    additionalProperties: false,
  },
  parseArgs: (raw) => ({
    action: requireEnumField(raw, "action", VOLUME_ACTIONS, "volume_control"),
  }),
  execute: ({ action }) => volumeControl(action),
};
