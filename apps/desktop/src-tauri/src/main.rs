#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod clipboard;
mod commands;
mod files;
mod input;
mod llm;
mod power;
mod spotify;
mod system;
mod web;

use dotenvy::dotenv;
use log::info;

fn main() {
    dotenv().ok();
    env_logger::init();

    info!("jarvis-desktop starting");

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::open_app,
            commands::open_url,
            clipboard::clipboard_read,
            clipboard::clipboard_write,
            input::media_control,
            input::volume_control,
            input::show_desktop,
            files::search_files,
            files::open_path,
            files::create_folder,
            files::move_file,
            files::copy_file,
            files::delete_path,
            files::read_file,
            files::write_file,
            files::append_file,
            files::list_folder,
            system::system_info,
            power::system_power,
            web::play_song,
            web::get_weather,
            web::get_news,
            spotify::spotify_connect,
            llm::openai_chat,
            llm::openai_transcribe,
            llm::openai_speech,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
