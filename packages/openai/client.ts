import { invoke } from "@tauri-apps/api/core";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface FunctionToolSpec {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: unknown;
    strict: true;
  };
}

export interface ChatCompletionRequest {
  model: string;
  temperature?: number;
  messages: ChatMessage[];
  tools?: FunctionToolSpec[];
}

export interface ChatCompletionResponse {
  choices: Array<{
    message: {
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
    };
  }>;
}

/**
 * Sends a chat completion request through the Rust proxy command, which
 * attaches the API key. The key never reaches frontend code.
 */
export function chatCompletion(
  request: ChatCompletionRequest,
): Promise<ChatCompletionResponse> {
  return invoke<ChatCompletionResponse>("openai_chat", { request });
}
