use crate::tool_call::{OpenAppArgs, OpenUrlArgs, ToolCall};
use log::debug;
use reqwest::Client;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<Choice>,
}

#[derive(Debug, Deserialize)]
struct Choice {
    message: Message,
}

#[derive(Debug, Deserialize)]
struct Message {
    content: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ModelToolCall {
    tool: Option<String>,
    args: Option<serde_json::Value>,
}

fn trim_json_block(content: &str) -> &str {
    let trimmed = content.trim();

    if let Some(stripped) = trimmed.strip_prefix("```json") {
        return stripped.trim().trim_end_matches("```").trim();
    }

    if let Some(stripped) = trimmed.strip_prefix("```") {
        return stripped.trim().trim_end_matches("```").trim();
    }

    trimmed
}

fn tool_call_from_json(content: &str) -> Result<Option<ToolCall>, String> {
    let parsed: ModelToolCall = serde_json::from_str(content)
        .map_err(|error| format!("failed to parse AI JSON content: {} -- raw: {}", error, content))?;

    match parsed.tool.as_deref() {
        Some("open_app") => {
            let app = parsed
                .args
                .as_ref()
                .and_then(|value| value.get("app"))
                .and_then(|value| value.as_str())
                .ok_or_else(|| "open_app missing 'app' arg".to_string())?;

            Ok(Some(ToolCall::OpenApp {
                args: OpenAppArgs {
                    app: app.to_string(),
                },
            }))
        }
        Some("open_url") => {
            let url = parsed
                .args
                .as_ref()
                .and_then(|value| value.get("url"))
                .and_then(|value| value.as_str())
                .ok_or_else(|| "open_url missing 'url' arg".to_string())?;

            Ok(Some(ToolCall::OpenUrl {
                args: OpenUrlArgs {
                    url: url.to_string(),
                },
            }))
        }
        Some(_) | None => Ok(None),
    }
}

#[tauri::command]
pub async fn parse_command_ai(text: String) -> Result<Option<ToolCall>, String> {
    let api_key = std::env::var("OPENAI_API_KEY")
        .map_err(|_| "OPENAI_API_KEY is missing from apps/desktop/.env".to_string())?;
    let model = std::env::var("OPENAI_MODEL").unwrap_or_else(|_| "gpt-4o-mini".to_string());

    debug!("parse_command_ai request text: {}", text);

    let client = Client::new();
    let body = serde_json::json!({
        "model": model,
        "temperature": 0,
        "messages": [
            {
                "role": "system",
                "content": "Convert the user command into a JSON tool call. Return only one of these objects: {\"tool\":\"open_app\",\"args\":{\"app\":\"spotify\"}}, {\"tool\":\"open_app\",\"args\":{\"app\":\"chrome\"}}, {\"tool\":\"open_url\",\"args\":{\"url\":\"https://youtube.com\"}}. If the command is unsupported, return {\"tool\":null}."
            },
            {
                "role": "user",
                "content": text
            }
        ]
    });

    let response = client
        .post("https://api.openai.com/v1/chat/completions")
        .bearer_auth(api_key)
        .json(&body)
        .send()
        .await
        .map_err(|error| format!("OpenAI request failed: {}", error))?;

    let status = response.status();
    let response_text = response
        .text()
        .await
        .map_err(|error| format!("OpenAI response read failed: {}", error))?;

    if !status.is_success() {
        return Err(format!("OpenAI returned {}: {}", status, response_text));
    }

    let completion: ChatCompletionResponse = serde_json::from_str(&response_text)
        .map_err(|error| format!("invalid json from OpenAI: {}", error))?;

    let content = completion
        .choices
        .first()
        .and_then(|choice| choice.message.content.as_deref())
        .ok_or_else(|| format!("no content in OpenAI response: {}", response_text))?;

    let json_content = trim_json_block(content);
    tool_call_from_json(json_content)
}