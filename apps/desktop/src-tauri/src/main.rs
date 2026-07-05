#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod clipboard;
mod commands;
mod files;
mod input;
mod llm;
mod system;

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
            files::search_files,
            files::open_path,
            files::create_folder,
            system::system_info,
            llm::openai_chat,
            llm::openai_transcribe,
            llm::openai_speech,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
