use std::sync::OnceLock;

use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine as _;
use log::debug;
use reqwest::Client;

const OPENAI_CHAT_COMPLETIONS_URL: &str = "https://api.openai.com/v1/chat/completions";
const OPENAI_TRANSCRIPTIONS_URL: &str = "https://api.openai.com/v1/audio/transcriptions";
const OPENAI_SPEECH_URL: &str = "https://api.openai.com/v1/audio/speech";

fn http_client() -> &'static Client {
    static CLIENT: OnceLock<Client> = OnceLock::new();
    CLIENT.get_or_init(Client::new)
}

fn openai_api_key() -> Result<String, String> {
    std::env::var("OPENAI_API_KEY")
        .map_err(|_| "OPENAI_API_KEY is missing from apps/desktop/.env".to_string())
}

async fn read_success_body(response: reqwest::Response) -> Result<Vec<u8>, String> {
    let status = response.status();
    let body = response
        .bytes()
        .await
        .map_err(|error| format!("OpenAI response read failed: {}", error))?;

    if !status.is_success() {
        return Err(format!(
            "OpenAI returned {}: {}",
            status,
            String::from_utf8_lossy(&body)
        ));
    }

    Ok(body.to_vec())
}

/// Forwards a chat completion request to OpenAI on behalf of the frontend.
///
/// This command is a deliberately "dumb" proxy: it attaches the API key and
/// endpoint, nothing else. Prompts, tool schemas, and response interpretation
/// live in the TypeScript orchestration layer so the key never reaches the
/// webview and AI logic never accumulates in Rust.
#[tauri::command]
pub async fn openai_chat(request: serde_json::Value) -> Result<serde_json::Value, String> {
    let api_key = openai_api_key()?;

    debug!("openai_chat forwarding request to OpenAI");

    let response = http_client()
        .post(OPENAI_CHAT_COMPLETIONS_URL)
        .bearer_auth(api_key)
        .json(&request)
        .send()
        .await
        .map_err(|error| format!("OpenAI request failed: {}", error))?;

    let body = read_success_body(response).await?;

    serde_json::from_slice(&body).map_err(|error| format!("invalid JSON from OpenAI: {}", error))
}

/// Transcribes recorded audio (base64-encoded) via OpenAI. The model choice
/// comes from TypeScript; this command only handles transport.
#[tauri::command]
pub async fn openai_transcribe(
    audio_base64: String,
    mime_type: String,
    model: String,
) -> Result<String, String> {
    let api_key = openai_api_key()?;

    let audio = BASE64
        .decode(audio_base64)
        .map_err(|error| format!("invalid base64 audio: {}", error))?;

    debug!("openai_transcribe: {} bytes of {}", audio.len(), mime_type);

    // OpenAI infers the container from the file extension, so derive it from
    // the mime type, e.g. "audio/webm;codecs=opus" -> "audio.webm".
    let extension = mime_type
        .split('/')
        .nth(1)
        .and_then(|subtype| subtype.split(';').next())
        .unwrap_or("webm")
        .to_string();

    let part = reqwest::multipart::Part::bytes(audio)
        .file_name(format!("audio.{}", extension))
        .mime_str(&mime_type)
        .map_err(|error| format!("invalid mime type '{}': {}", mime_type, error))?;

    let form = reqwest::multipart::Form::new()
        .text("model", model)
        .part("file", part);

    let response = http_client()
        .post(OPENAI_TRANSCRIPTIONS_URL)
        .bearer_auth(api_key)
        .multipart(form)
        .send()
        .await
        .map_err(|error| format!("OpenAI transcription request failed: {}", error))?;

    let body = read_success_body(response).await?;

    let parsed: serde_json::Value = serde_json::from_slice(&body)
        .map_err(|error| format!("invalid JSON from OpenAI: {}", error))?;

    parsed
        .get("text")
        .and_then(|value| value.as_str())
        .map(|text| text.to_string())
        .ok_or_else(|| format!("no 'text' in transcription response: {}", parsed))
}

/// Synthesizes speech via OpenAI and returns the audio as base64. Voice and
/// model selection come from the TypeScript request body.
#[tauri::command]
pub async fn openai_speech(request: serde_json::Value) -> Result<String, String> {
    let api_key = openai_api_key()?;

    debug!("openai_speech forwarding request to OpenAI");

    let response = http_client()
        .post(OPENAI_SPEECH_URL)
        .bearer_auth(api_key)
        .json(&request)
        .send()
        .await
        .map_err(|error| format!("OpenAI speech request failed: {}", error))?;

    let body = read_success_body(response).await?;

    Ok(BASE64.encode(body))
}
