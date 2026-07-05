import { invoke } from "@tauri-apps/api/core";

export async function clipboardRead(): Promise<string> {
  return invoke<string>("clipboard_read");
}

export async function clipboardWrite(text: string): Promise<string> {
  return invoke<string>("clipboard_write", { text });
}
