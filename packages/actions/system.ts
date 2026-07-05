import { invoke } from "@tauri-apps/api/core";

export async function systemInfo(): Promise<string> {
  return invoke<string>("system_info");
}
