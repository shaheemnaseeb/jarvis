use log::info;

/// Apps the assistant is allowed to launch. `open_app` rejects anything else,
/// so an AI-produced string can never reach the shell unfiltered.
const SUPPORTED_APPS: &[&str] = &["spotify", "chrome"];

/// Launch strategies per app for the current OS, tried in order. Every string
/// here is a compile-time constant — user/AI input only selects an entry.
#[cfg(target_os = "windows")]
fn launch_candidates(app_id: &str) -> Option<&'static [&'static [&'static str]]> {
    match app_id {
        "spotify" => Some(&[
            &["cmd", "/C", "start", "", "spotify"],
            &["cmd", "/C", "start", "", "spotify:"],
        ]),
        "chrome" => Some(&[&["cmd", "/C", "start", "", "chrome"]]),
        _ => None,
    }
}

#[cfg(target_os = "macos")]
fn launch_candidates(app_id: &str) -> Option<&'static [&'static [&'static str]]> {
    match app_id {
        "spotify" => Some(&[&["open", "-a", "Spotify"]]),
        "chrome" => Some(&[&["open", "-a", "Google Chrome"]]),
        _ => None,
    }
}

#[cfg(all(unix, not(target_os = "macos")))]
fn launch_candidates(app_id: &str) -> Option<&'static [&'static [&'static str]]> {
    match app_id {
        "spotify" => Some(&[
            &["spotify"],
            &["flatpak", "run", "com.spotify.Client"],
            &["xdg-open", "spotify:"],
        ]),
        "chrome" => Some(&[
            &["google-chrome"],
            &["google-chrome-stable"],
            &["chromium-browser"],
            &["chromium"],
        ]),
        _ => None,
    }
}

fn spawn_first_available(candidates: &[&[&str]]) -> Result<(), String> {
    let mut last_error = String::from("no launch command configured");

    for command_parts in candidates {
        let (program, args) = match command_parts.split_first() {
            Some(parts) => parts,
            None => continue,
        };

        match std::process::Command::new(program).args(args.iter()).spawn() {
            Ok(_) => return Ok(()),
            Err(error) => last_error = format!("{}: {}", program, error),
        }
    }

    Err(last_error)
}

#[tauri::command]
pub async fn open_app(app: String) -> Result<String, String> {
    info!("open_app called: {}", app);

    let app_id = app.trim().to_lowercase();

    let candidates = launch_candidates(&app_id).ok_or_else(|| {
        format!(
            "unsupported app '{}' — supported apps: {}",
            app,
            SUPPORTED_APPS.join(", ")
        )
    })?;

    spawn_first_available(candidates)
        .map(|_| format!("Launched {}", app))
        .map_err(|error| format!("failed to launch {}: {}", app, error))
}

#[tauri::command]
pub async fn open_url(url: String) -> Result<String, String> {
    info!("open_url called: {}", url);

    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err(format!("invalid url: {}", url));
    }

    open::that_detached(&url).map_err(|error| format!("failed to open {}: {}", url, error))?;

    Ok(format!("Opened {}", url))
}
