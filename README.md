# Jarvis

Jarvis is a desktop AI assistant for controlling everyday computer tasks with typed or spoken natural language commands.

It combines a Tauri desktop shell, a React command UI, Rust system integrations, and a TypeScript tool-calling agent backed by OpenAI.

## Screenshots

<p>
  <img src="assets/screenshots/standby.svg" alt="Jarvis standby screen" width="48%" />
  <img src="assets/screenshots/chat-actions.svg" alt="Jarvis answering questions and opening Chrome" width="48%" />
</p>

<p>
  <img src="assets/screenshots/media-control.svg" alt="Jarvis controlling Spotify playback" width="48%" />
  <img src="assets/screenshots/file-search.svg" alt="Jarvis finding and opening a thesis folder" width="48%" />
</p>

## What It Can Do

- Launch supported desktop apps, currently Spotify and Chrome.
- Open websites in the default browser.
- Control media playback with play/pause, next track, and previous track.
- Adjust system volume.
- Read and write clipboard text.
- Answer date, time, and system information questions.
- Search for files and folders in the user's home directory.
- Open files or folders with their default application.
- Create, copy, move, read, and delete files within guarded filesystem boundaries.
- Ask for confirmation before destructive or high-impact file actions.

## How It Works

Jarvis keeps a short conversation history and sends each user turn to OpenAI with a registry of available tools. The model selects one or more tools, the TypeScript registry validates the tool name and arguments, and the matching action runs through the desktop backend.

The desktop app is split into three layers:

- `apps/desktop`: Tauri 2 + React app, including the orb UI, chat log, command composer, and Rust commands.
- `packages/core`: The Jarvis agent loop, conversation memory, OpenAI tool selection, and confirmation flow.
- `packages/tools` and `packages/actions`: Tool schemas, argument validation, and implementations for apps, URLs, clipboard, media, datetime, system info, and files.

## Tech Stack

- Tauri 2 for the desktop shell and OS bridge.
- React 18 and TypeScript for the UI.
- Rust for system, file, input, clipboard, and command execution.
- OpenAI chat completions with function tools for command understanding.
- Vite for frontend development.

## Project Structure

```text
jarvis/
  apps/
    desktop/
      src/              React UI and Jarvis hook
      src-tauri/        Tauri/Rust backend
  packages/
    actions/            TypeScript action wrappers
    core/               Agent loop and model/tool orchestration
    openai/             OpenAI client
    shared/             Shared argument and tool types
    tools/              Tool registry, schemas, and validation
    voice/              Audio, STT, TTS, and VAD modules
    wakeword/           Wake-word detector module
```

## Local Development

Install dependencies:

```bash
npm install
```

Create `apps/desktop/.env`:

```env
OPENAI_API_KEY=replace_with_your_key
OPENAI_MODEL=gpt-4o-mini
```

Run the desktop app:

```bash
npm run dev
```

Build the desktop app:

```bash
npm run build
```

Type-check the project:

```bash
npm run typecheck
```

## Configuration Notes

The OpenAI request is handled by the Rust backend in `apps/desktop/src-tauri`. The frontend talks to the backend through Tauri `invoke()` calls, so the OpenAI key should stay in `apps/desktop/.env` and should not be exposed through `VITE_` environment variables.

The current agent model is configured in `packages/core/agent.ts`. Tool execution is capped per user turn to avoid runaway action loops.

## Safety Boundaries

Jarvis validates every model-selected tool call against the local registry before execution. File actions are scoped to the user's home directory, and destructive operations such as moving files to the recycle bin require confirmation before they run.

## Status

This is an early personal assistant prototype. The command UI, tool registry, OpenAI agent loop, and core desktop actions are implemented. Voice, wake-word, and richer automation modules are present in the package layout and are still evolving.
