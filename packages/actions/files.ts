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

export async function moveFile(from: string, to: string): Promise<string> {
  return invoke<string>("move_file", { from, to });
}

export async function copyFile(from: string, to: string): Promise<string> {
  return invoke<string>("copy_file", { from, to });
}

export async function deletePath(path: string): Promise<string> {
  return invoke<string>("delete_path", { path });
}

export async function readFile(path: string): Promise<string> {
  return invoke<string>("read_file", { path });
}
