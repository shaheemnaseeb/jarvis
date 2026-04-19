#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[tauri::command]
async fn open_app(app: String) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;

        Command::new("cmd")
            .args(["/C", "start", "", app.as_str()])
            .spawn()
            .map_err(|e| format!("failed to launch {}: {}", app, e))?;

        return Ok(format!("Launched {}", app));
    }

    #[cfg(target_os = "macos")]
    {
        use std::process::Command;

        Command::new("open")
            .args(["-a", app.as_str()])
            .spawn()
            .map_err(|e| format!("failed to launch {}: {}", app, e))?;

        return Ok(format!("Launched {}", app));
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        use std::process::Command;

        Command::new(app.as_str())
            .spawn()
            .map_err(|e| format!("failed to launch {}: {}", app, e))?;

        return Ok(format!("Launched {}", app));
    }

    #[allow(unreachable_code)]
    Err("unsupported platform".to_string())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![open_app])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
