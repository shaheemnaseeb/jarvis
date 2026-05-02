use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "tool", rename_all = "snake_case")]
pub enum ToolCall {
    OpenApp { args: OpenAppArgs },
    OpenUrl { args: OpenUrlArgs },
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OpenAppArgs {
    pub app: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OpenUrlArgs {
    pub url: String,
}