use enigo::{Direction, Enigo, Key, Keyboard, Settings};

/// One Windows volume key press changes volume by 2/100, so a "volume up"
/// command presses several times to make an audible difference.
const VOLUME_STEP_PRESSES: usize = 5;

fn press(key: Key, times: usize) -> Result<(), String> {
    let mut enigo =
        Enigo::new(&Settings::default()).map_err(|error| format!("input unavailable: {}", error))?;

    for _ in 0..times {
        enigo
            .key(key, Direction::Click)
            .map_err(|error| format!("key press failed: {}", error))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn media_control(action: String) -> Result<String, String> {
    let (key, label) = match action.as_str() {
        "play_pause" => (Key::MediaPlayPause, "Toggled playback"),
        "next" => (Key::MediaNextTrack, "Skipped to the next track"),
        "previous" => (Key::MediaPrevTrack, "Went back a track"),
        _ => return Err(format!("unsupported media action: {}", action)),
    };

    press(key, 1)?;
    Ok(label.to_string())
}

#[tauri::command]
pub async fn volume_control(action: String) -> Result<String, String> {
    let (key, times, label) = match action.as_str() {
        "up" => (Key::VolumeUp, VOLUME_STEP_PRESSES, "Volume up"),
        "down" => (Key::VolumeDown, VOLUME_STEP_PRESSES, "Volume down"),
        "mute" => (Key::VolumeMute, 1, "Toggled mute"),
        _ => return Err(format!("unsupported volume action: {}", action)),
    };

    press(key, times)?;
    Ok(label.to_string())
}
