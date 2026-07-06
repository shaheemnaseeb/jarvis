import { invoke } from "@tauri-apps/api/core";

import type { PowerAction } from "../shared/types";

export async function systemInfo(): Promise<string> {
  return invoke<string>("system_info");
}

export async function systemPower(action: PowerAction): Promise<string> {
  return invoke<string>("system_power", { action });
}

export async function showDesktop(): Promise<string> {
  return invoke<string>("show_desktop");
}
