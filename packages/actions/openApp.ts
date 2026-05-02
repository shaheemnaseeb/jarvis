import { invoke } from "@tauri-apps/api/core";

export async function openApp(app: string): Promise<string> {
  return invoke<string>("open_app", { app });
}
