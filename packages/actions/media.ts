import { invoke } from "@tauri-apps/api/core";

import type { MediaAction, VolumeAction } from "../shared/types";

export async function mediaControl(action: MediaAction): Promise<string> {
  return invoke<string>("media_control", { action });
}

export async function volumeControl(action: VolumeAction): Promise<string> {
  return invoke<string>("volume_control", { action });
}
