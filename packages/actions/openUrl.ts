import { invoke } from "@tauri-apps/api/core";

export async function openUrl(url: string): Promise<string> {
  return invoke<string>("open_url", { url });
}
