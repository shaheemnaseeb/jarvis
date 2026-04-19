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
