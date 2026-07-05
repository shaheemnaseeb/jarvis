import { invoke } from "@tauri-apps/api/core";

/** A tool call exactly as the OpenAI API represents it (args still JSON text). */
export interface RawToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: RawToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

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
      tool_calls?: RawToolCall[];
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
