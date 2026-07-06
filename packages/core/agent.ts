import {
  chatCompletion,
  type ChatMessage,
  type FunctionToolSpec,
} from "../openai/client";
import {
  confirmationQuestion,
  executeTool,
  toolDefinitions,
  toToolCall,
} from "../tools";

/**
 * Asks the user to approve a destructive action. Resolving false (or the
 * handler being absent) blocks execution.
 */
export type ConfirmHandler = (question: string) => Promise<boolean>;

const MODEL = "gpt-4o-mini";

/** Upper bound on model -> tools -> model cycles for a single user turn.
 * The work-mode briefing alone uses about five tools, so leave headroom. */
const MAX_TOOL_ROUNDS = 6;

/** Trim history beyond this many messages (oldest turns dropped first). */
const MAX_HISTORY_MESSAGES = 30;

const SYSTEM_PROMPT =
  "You are Jarvis, a voice-controlled assistant running on the user's " +
  "computer. Address the user as 'sir'. Use the available tools to fulfil " +
  "requests; you may call several tools for one request. After acting, " +
  "confirm the outcome in one short sentence. If no tool fits, answer in " +
  "one or two short sentences. All of your replies are spoken aloud, so " +
  "never use markdown or lists. " +
  "When the user announces they are back or ready to work (phrases like " +
  "'let's get to work', 'I'm back', 'time to grind'), run the workshop " +
  "entrance: first call play_song with 'Highway to Hell AC/DC', then in " +
  "the same round call get_weather with 'here', get_news, and read_file " +
  "on 'Documents/jarvis-notes.txt'. Then greet them in the style of " +
  "'Welcome back, sir. Let's begin.' followed by a compact spoken " +
  "briefing: the weather in one sentence, anything from the notes file, " +
  "and the two most interesting headlines. Finish by suggesting one " +
  "concrete thing to start with, based on the notes if there are any. " +
  "If the notes file does not exist, skip it silently — never mention " +
  "the error. You have no calendar access, so never invent meetings; if " +
  "asked about meetings, say you cannot see a calendar yet. " +
  "When the user asks you to take a note or remember something for " +
  "later, call append_file on 'Documents/jarvis-notes.txt' with the note " +
  "as one line, prefixed with today's date.";

const FALLBACK_REPLY = "Sorry, I couldn't work out how to help with that.";

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
 * The conversation brain: keeps history across turns and runs the
 * model -> tool -> model loop until the model answers in plain text.
 * Tool output is validated against the registry before execution.
 */
export class JarvisAgent {
  private history: ChatMessage[] = [];

  constructor(private readonly confirm?: ConfirmHandler) {}

  reset(): void {
    this.history = [];
  }

  /**
   * Handles one user turn and returns the sentence to speak.
   * `onStatus` receives progress updates (e.g. which tool is running).
   */
  async handleUserTurn(
    text: string,
    onStatus?: (status: string) => void,
  ): Promise<string> {
    this.history.push({ role: "user", content: text });

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await chatCompletion({
        model: MODEL,
        temperature: 0,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...this.history,
        ],
        tools: toFunctionSpecs(),
      });

      const message = response.choices[0]?.message;
      const toolCalls = message?.tool_calls;

      if (!toolCalls || toolCalls.length === 0) {
        const reply = message?.content?.trim() || FALLBACK_REPLY;
        this.history.push({ role: "assistant", content: reply });
        this.trimHistory();
        return reply;
      }

      this.history.push({
        role: "assistant",
        content: message?.content ?? null,
        tool_calls: toolCalls,
      });

      for (const rawCall of toolCalls) {
        onStatus?.(`Running ${rawCall.function.name}...`);

        let result: string;
        try {
          const call = toToolCall(
            rawCall.function.name,
            JSON.parse(rawCall.function.arguments),
          );

          const question = confirmationQuestion(call);
          if (question) {
            const approved = this.confirm ? await this.confirm(question) : false;

            if (!approved) {
              result =
                "The user declined this action. Do not retry it; acknowledge briefly.";
              this.history.push({
                role: "tool",
                tool_call_id: rawCall.id,
                content: result,
              });
              continue;
            }
          }

          result = await executeTool(call);
        } catch (error) {
          result = `Error: ${String(error)}`;
        }

        this.history.push({
          role: "tool",
          tool_call_id: rawCall.id,
          content: result,
        });
      }
    }

    const reply = "I started on that but it needed too many steps, so I stopped.";
    this.history.push({ role: "assistant", content: reply });
    this.trimHistory();
    return reply;
  }

  /**
   * Drops the oldest messages, always cutting at a user-message boundary so
   * assistant tool_calls stay paired with their tool results.
   */
  private trimHistory(): void {
    if (this.history.length <= MAX_HISTORY_MESSAGES) {
      return;
    }

    let start = this.history.length - MAX_HISTORY_MESSAGES;
    while (start < this.history.length && this.history[start].role !== "user") {
      start++;
    }

    this.history = this.history.slice(start);
  }
}
