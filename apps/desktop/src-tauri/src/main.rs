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

        let app_name = app.to_lowercase();

        let candidates: Vec<Vec<String>> = match app_name.as_str() {
            "spotify" => vec![
                vec!["spotify".to_string()],
                vec![
                    "flatpak".to_string(),
                    "run".to_string(),
                    "com.spotify.Client".to_string(),
                ],
                vec!["xdg-open".to_string(), "spotify:".to_string()],
                vec![
                    "cmd.exe".to_string(),
                    "/C".to_string(),
                    "start".to_string(),
                    "".to_string(),
                    "spotify".to_string(),
                ],
            ],
            "chrome" => vec![
                vec!["google-chrome".to_string()],
                vec!["google-chrome-stable".to_string()],
                vec!["chromium-browser".to_string()],
                vec!["chromium".to_string()],
                vec![
                    "cmd.exe".to_string(),
                    "/C".to_string(),
                    "start".to_string(),
                    "".to_string(),
                    "chrome".to_string(),
                ],
            ],
            _ => vec![
                vec![app.clone()],
                vec!["xdg-open".to_string(), app.clone()],
            ],
        };

        let mut last_error: Option<String> = None;

        for command_parts in candidates {
            if command_parts.is_empty() {
                continue;
            }

            let executable = &command_parts[0];
            let args = &command_parts[1..];

            match Command::new(executable).args(args).spawn() {
                Ok(_) => return Ok(format!("Launched {}", app)),
                Err(error) => {
                    last_error = Some(format!("{} {}", executable, error));
                }
            }
        }

        return Err(format!(
            "failed to launch {}: {}",
            app,
            last_error.unwrap_or_else(|| "no launch command succeeded".to_string())
        ));
    }

    #[allow(unreachable_code)]
    Err("unsupported platform".to_string())
}

#[tauri::command]
async fn open_url(url: String) -> Result<String, String> {
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err(format!("invalid url: {}", url));
    }

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;

        Command::new("cmd")
            .args(["/C", "start", "", url.as_str()])
            .spawn()
            .map_err(|e| format!("failed to open {}: {}", url, e))?;

        return Ok(format!("Opened {}", url));
    }

    #[cfg(target_os = "macos")]
    {
        use std::process::Command;

        Command::new("open")
            .arg(url.as_str())
            .spawn()
            .map_err(|e| format!("failed to open {}: {}", url, e))?;

        return Ok(format!("Opened {}", url));
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        use std::process::Command;

        Command::new("xdg-open")
            .arg(url.as_str())
            .spawn()
            .map_err(|e| format!("failed to open {}: {}", url, e))?;

        return Ok(format!("Opened {}", url));
    }

    #[allow(unreachable_code)]
    Err("unsupported platform".to_string())
}

fn main() {
    tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![open_app, open_url])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
