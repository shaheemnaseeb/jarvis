use log::info;

fn spawn_command(program: &str, args: &[&str]) -> Result<(), String> {
    std::process::Command::new(program)
        .args(args)
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("failed to run {}: {}", program, error))
}

#[tauri::command]
pub async fn open_app(app: String) -> Result<String, String> {
    info!("open_app called: {}", app);

    #[cfg(target_os = "windows")]
    {
        spawn_command("cmd", &["/C", "start", "", &app])?;
        return Ok(format!("Launched {}", app));
    }

    #[cfg(target_os = "macos")]
    {
        spawn_command("open", &["-a", &app])?;
        return Ok(format!("Launched {}", app));
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let app_name = app.to_lowercase();
        let candidates: Vec<Vec<String>> = match app_name.as_str() {
            "spotify" => vec![
                vec!["spotify".to_string()],
                vec!["flatpak".to_string(), "run".to_string(), "com.spotify.Client".to_string()],
                vec!["xdg-open".to_string(), "spotify:".to_string()],
                vec!["cmd.exe".to_string(), "/C".to_string(), "start".to_string(), "".to_string(), "spotify".to_string()],
            ],
            "chrome" => vec![
                vec!["google-chrome".to_string()],
                vec!["google-chrome-stable".to_string()],
                vec!["chromium-browser".to_string()],
                vec!["chromium".to_string()],
                vec!["cmd.exe".to_string(), "/C".to_string(), "start".to_string(), "".to_string(), "chrome".to_string()],
            ],
            _ => vec![vec![app.clone()], vec!["xdg-open".to_string(), app.clone()]],
        };

        let mut last_error: Option<String> = None;

        for command_parts in candidates {
            if command_parts.is_empty() {
                continue;
            }

            let executable = &command_parts[0];
            let args = &command_parts[1..];

            match std::process::Command::new(executable).args(args).spawn() {
                Ok(_) => return Ok(format!("Launched {}", app)),
                Err(error) => last_error = Some(format!("{} {}", executable, error)),
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
pub async fn open_url(url: String) -> Result<String, String> {
    info!("open_url called: {}", url);

    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err(format!("invalid url: {}", url));
    }

    #[cfg(target_os = "windows")]
    {
        spawn_command("cmd", &["/C", "start", "", &url])?;
        return Ok(format!("Opened {}", url));
    }

    #[cfg(target_os = "macos")]
    {
        spawn_command("open", &[&url])?;
        return Ok(format!("Opened {}", url));
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        spawn_command("xdg-open", &[&url])?;
        return Ok(format!("Opened {}", url));
    }

    #[allow(unreachable_code)]
    Err("unsupported platform".to_string())
}