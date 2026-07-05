import { openUrl } from "../../actions/openUrl";
import type { OpenUrlArgs } from "../../shared/types";
import type { ToolDefinition } from "../types";
import { requireStringField } from "../validation";

export const openUrlTool: ToolDefinition<OpenUrlArgs> = {
  name: "open_url",
  description: "Open a website in the default browser.",
  parameters: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "Full URL including scheme, e.g. 'https://youtube.com'.",
      },
    },
    required: ["url"],
    additionalProperties: false,
  },
  parseArgs: (raw) => ({ url: requireStringField(raw, "url", "open_url") }),
  execute: ({ url }) => openUrl(url),
};
