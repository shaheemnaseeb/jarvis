use log::info;

/// Apps the assistant is allowed to launch. `open_app` rejects anything else,
/// so an AI-produced string can never reach the shell unfiltered.
const SUPPORTED_APPS: &[&str] = &[
    "spotify",
    "chrome",
    "edge",
    "notepad",
    "calculator",
    "vscode",
    "explorer",
    "terminal",
    "settings",
];

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
        "edge" => Some(&[&["cmd", "/C", "start", "", "msedge"]]),
        "notepad" => Some(&[&["cmd", "/C", "start", "", "notepad"]]),
        "calculator" => Some(&[&["cmd", "/C", "start", "", "calc"]]),
        "vscode" => Some(&[&["cmd", "/C", "start", "", "code"]]),
        "explorer" => Some(&[&["explorer"]]),
        "terminal" => Some(&[
            &["cmd", "/C", "start", "", "wt"],
            &["cmd", "/C", "start", "", "cmd"],
        ]),
        "settings" => Some(&[&["cmd", "/C", "start", "", "ms-settings:"]]),
        _ => None,
    }
}

#[cfg(target_os = "macos")]
fn launch_candidates(app_id: &str) -> Option<&'static [&'static [&'static str]]> {
    match app_id {
        "spotify" => Some(&[&["open", "-a", "Spotify"]]),
        "chrome" => Some(&[&["open", "-a", "Google Chrome"]]),
        "edge" => Some(&[&["open", "-a", "Microsoft Edge"]]),
        "notepad" => Some(&[&["open", "-a", "TextEdit"]]),
        "calculator" => Some(&[&["open", "-a", "Calculator"]]),
        "vscode" => Some(&[&["open", "-a", "Visual Studio Code"]]),
        "explorer" => Some(&[&["open", "."]]),
        "terminal" => Some(&[&["open", "-a", "Terminal"]]),
        "settings" => Some(&[&["open", "-a", "System Settings"]]),
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
        "edge" => Some(&[&["microsoft-edge"], &["microsoft-edge-stable"]]),
        "notepad" => Some(&[&["gedit"], &["kate"], &["mousepad"]]),
        "calculator" => Some(&[&["gnome-calculator"], &["kcalc"]]),
        "vscode" => Some(&[&["code"]]),
        "explorer" => Some(&[&["xdg-open", "."]]),
        "terminal" => Some(&[&["gnome-terminal"], &["konsole"], &["x-terminal-emulator"]]),
        "settings" => Some(&[&["gnome-control-center"], &["systemsettings"]]),
        _ => None,
    }
}

/// Launches a supported app by its allowlisted identifier. Shared with the
/// Spotify integration, which needs the app running before playback.
pub(crate) fn launch_supported_app(app_id: &str) -> Result<(), String> {
    let candidates = launch_candidates(app_id)
        .ok_or_else(|| format!("unsupported app '{}'", app_id))?;
    spawn_first_available(candidates)
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

    if !SUPPORTED_APPS.contains(&app_id.as_str()) {
        return Err(format!(
            "unsupported app '{}' — supported apps: {}",
            app,
            SUPPORTED_APPS.join(", ")
        ));
    }

    launch_supported_app(&app_id)
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
