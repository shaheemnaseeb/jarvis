use log::info;

/// Power actions map to compile-time constant commands — the AI-supplied
/// string only selects an entry, it never reaches the shell.
#[cfg(target_os = "windows")]
fn power_command(action: &str) -> Option<&'static [&'static str]> {
    match action {
        "lock" => Some(&["rundll32", "user32.dll,LockWorkStation"]),
        "sleep" => Some(&["rundll32", "powrprof.dll,SetSuspendState", "0,1,0"]),
        "shutdown" => Some(&["shutdown", "/s", "/t", "5"]),
        "restart" => Some(&["shutdown", "/r", "/t", "5"]),
        _ => None,
    }
}

#[cfg(target_os = "macos")]
fn power_command(action: &str) -> Option<&'static [&'static str]> {
    match action {
        "lock" => Some(&["pmset", "displaysleepnow"]),
        "sleep" => Some(&["pmset", "sleepnow"]),
        "shutdown" => Some(&[
            "osascript",
            "-e",
            "tell application \"System Events\" to shut down",
        ]),
        "restart" => Some(&[
            "osascript",
            "-e",
            "tell application \"System Events\" to restart",
        ]),
        _ => None,
    }
}

#[cfg(all(unix, not(target_os = "macos")))]
fn power_command(action: &str) -> Option<&'static [&'static str]> {
    match action {
        "lock" => Some(&["loginctl", "lock-session"]),
        "sleep" => Some(&["systemctl", "suspend"]),
        "shutdown" => Some(&["systemctl", "poweroff"]),
        "restart" => Some(&["systemctl", "reboot"]),
        _ => None,
    }
}

#[tauri::command]
pub async fn system_power(action: String) -> Result<String, String> {
    info!("system_power called: {}", action);

    let command = power_command(action.as_str())
        .ok_or_else(|| format!("unsupported power action: {}", action))?;

    let (program, args) = command
        .split_first()
        .ok_or_else(|| "no power command configured".to_string())?;

    std::process::Command::new(program)
        .args(args.iter())
        .spawn()
        .map_err(|error| format!("failed to run {}: {}", program, error))?;

    let label = match action.as_str() {
        "lock" => "Locking the screen",
        "sleep" => "Putting the computer to sleep",
        "shutdown" => "Shutting down in a few seconds",
        "restart" => "Restarting in a few seconds",
        _ => "Done",
    };

    Ok(label.to_string())
}
