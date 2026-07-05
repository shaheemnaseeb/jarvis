use arboard::Clipboard;

fn clipboard() -> Result<Clipboard, String> {
    Clipboard::new().map_err(|error| format!("clipboard unavailable: {}", error))
}

#[tauri::command]
pub async fn clipboard_read() -> Result<String, String> {
    clipboard()?
        .get_text()
        .map_err(|error| format!("failed to read clipboard: {}", error))
}

#[tauri::command]
pub async fn clipboard_write(text: String) -> Result<String, String> {
    clipboard()?
        .set_text(text)
        .map(|_| "Copied to clipboard".to_string())
        .map_err(|error| format!("failed to write clipboard: {}", error))
}
