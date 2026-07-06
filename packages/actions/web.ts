import { invoke } from "@tauri-apps/api/core";

export async function playSong(query: string): Promise<string> {
  return invoke<string>("play_song", { query });
}

export async function getWeather(city: string): Promise<string> {
  return invoke<string>("get_weather", { city });
}

export async function getNews(): Promise<string> {
  return invoke<string>("get_news");
}

export async function spotifyConnect(): Promise<string> {
  return invoke<string>("spotify_connect");
}
