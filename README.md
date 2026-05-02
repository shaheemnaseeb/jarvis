# 🧠 Jarvis AI

> Voice-first AI assistant that understands commands and controls your computer.

A cross-platform desktop assistant inspired by Jarvis (Iron Man), built using modern web + AI technologies.

---

## 🚀 Vision

The goal of this project is to build a **voice-controlled personal assistant** that can:

- Listen to natural language commands
- Understand intent using AI
- Execute actions on your computer
- Automate everyday tasks

---

## ⚙️ Tech Stack

- **Tauri** — Cross-platform desktop app
- **React + TypeScript** — Frontend UI
- **Rust** — System-level command execution
- **OpenAI** — Command understanding & reasoning
- **Wake Word Engine** — “Hey Jarvis” detection
- **Playwright** *(planned)* — Browser automation

---

## ✨ Features (WIP)

- [ ] Wake word detection ("Hey Jarvis")
- [ ] Voice command recognition
- [ ] Open applications via voice
- [ ] Open websites via voice
- [ ] AI-based command parsing
- [ ] Spoken responses
- [ ] File system actions *(planned)*
- [ ] Browser automation *(planned)*

---

## 🧱 Project Structure

```bash
jarvis/
  apps/
    desktop/        # Tauri + React app
  packages/
    actions/        # System actions (open app, open URL)
    openai/         # AI integration layer
    wakeword/       # Wake phrase detection
    shared/         # Shared types and utilities

## Local Development

The OpenAI request is handled by the Rust backend in `apps/desktop/src-tauri`, and the frontend only calls the backend through Tauri `invoke()`.

### Environment

Put your local key in `apps/desktop/.env`:

```env
OPENAI_API_KEY=replace_with_my_temp_key
OPENAI_MODEL=gpt-4o-mini
```

This `.env` is ignored by git. Do not use `VITE_` variables for the OpenAI key.

### Run

```bash
npm --workspace apps/desktop run dev:tauri
```
