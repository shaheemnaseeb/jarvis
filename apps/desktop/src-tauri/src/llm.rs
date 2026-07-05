use std::sync::OnceLock;

use log::debug;
use reqwest::Client;

const OPENAI_CHAT_COMPLETIONS_URL: &str = "https://api.openai.com/v1/chat/completions";

fn http_client() -> &'static Client {
    static CLIENT: OnceLock<Client> = OnceLock::new();
    CLIENT.get_or_init(Client::new)
}

/// Forwards a chat completion request to OpenAI on behalf of the frontend.
///
/// This command is a deliberately "dumb" proxy: it attaches the API key and
/// endpoint, nothing else. Prompts, tool schemas, and response interpretation
/// live in the TypeScript orchestration layer so the key never reaches the
/// webview and AI logic never accumulates in Rust.
#[tauri::command]
pub async fn openai_chat(request: serde_json::Value) -> Result<serde_json::Value, String> {
    let api_key = std::env::var("OPENAI_API_KEY")
        .map_err(|_| "OPENAI_API_KEY is missing from apps/desktop/.env".to_string())?;

    debug!("openai_chat forwarding request to OpenAI");

    let response = http_client()
        .post(OPENAI_CHAT_COMPLETIONS_URL)
        .bearer_auth(api_key)
        .json(&request)
        .send()
        .await
        .map_err(|error| format!("OpenAI request failed: {}", error))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|error| format!("OpenAI response read failed: {}", error))?;

    if !status.is_success() {
        return Err(format!("OpenAI returned {}: {}", status, body));
    }

    debug!("openai_chat response body: {}", body);

    serde_json::from_str(&body).map_err(|error| format!("invalid JSON from OpenAI: {}", error))
}
