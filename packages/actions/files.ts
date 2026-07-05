import { invoke } from "@tauri-apps/api/core";

export async function searchFiles(query: string): Promise<string[]> {
  return invoke<string[]>("search_files", { query });
}

export async function openPath(path: string): Promise<string> {
  return invoke<string>("open_path", { path });
}

export async function createFolder(path: string): Promise<string> {
  return invoke<string>("create_folder", { path });
}
