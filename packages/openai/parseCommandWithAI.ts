import type { ToolCall } from "../shared/types";
import { toolDefinitions, toToolCall } from "../tools";
import {
  chatCompletion,
  type FunctionToolSpec,
} from "./client";

const MODEL = "gpt-4o-mini";

const SYSTEM_PROMPT =
  "You are Jarvis, a desktop assistant. Map the user's command to one of the " +
  "available tools. If no tool fits the command, do not call a tool.";

function toFunctionSpecs(): FunctionToolSpec[] {
  return toolDefinitions.map((definition) => ({
    type: "function",
    function: {
      name: definition.name,
      description: definition.description,
      parameters: definition.parameters,
      strict: true,
    },
  }));
}

/**
 * Asks the model to select a tool for the user's command. Returns null when
 * the command maps to no known tool. The model can only pick from the tool
 * registry; its output is validated before anything executes.
 */
export async function parseCommandWithAI(
  text: string,
): Promise<ToolCall | null> {
  const response = await chatCompletion({
    model: MODEL,
    temperature: 0,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: text },
    ],
    tools: toFunctionSpecs(),
  });

  const toolCall = response.choices[0]?.message?.tool_calls?.[0];

  if (!toolCall) {
    return null;
  }

  return toToolCall(
    toolCall.function.name,
    JSON.parse(toolCall.function.arguments),
  );
}
