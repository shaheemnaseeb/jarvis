#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod openai;
mod tool_call;

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
            openai::parse_command_ai,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
