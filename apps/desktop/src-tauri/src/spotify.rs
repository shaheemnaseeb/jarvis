use std::io::{Read, Write};
use std::net::TcpListener;
use std::path::PathBuf;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine as _;
use log::info;
use rand::Rng;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::commands::launch_supported_app;
use crate::web::encode_query;

/// Spotify Web API integration using the OAuth authorization-code flow with
/// PKCE. A public client needs no secret: only SPOTIFY_CLIENT_ID in .env.
/// The refresh token is stored in the user's config directory, so connecting
/// is a one-time browser approval.

const AUTHORIZE_URL: &str = "https://accounts.spotify.com/authorize";
const TOKEN_URL: &str = "https://accounts.spotify.com/api/token";
const API_BASE_URL: &str = "https://api.spotify.com/v1";

/// Must exactly match a redirect URI registered in the Spotify app settings.
const REDIRECT_PORT: u16 = 8898;
const REDIRECT_URI: &str = "http://127.0.0.1:8898/callback";

const SCOPES: &str = "user-modify-playback-state user-read-playback-state";

/// How long the connect flow waits for the user to approve in the browser.
const AUTH_WAIT: Duration = Duration::from_secs(180);

/// How long to wait for the Spotify app to register as a playback device
/// after being launched.
const DEVICE_WAIT_ATTEMPTS: usize = 10;
const DEVICE_POLL_INTERVAL: Duration = Duration::from_secs(1);

#[derive(Serialize, Deserialize)]
struct StoredAuth {
    access_token: String,
    refresh_token: String,
    /// Unix timestamp (seconds) after which access_token is stale.
    expires_at: u64,
}

fn client_id() -> Result<String, String> {
    std::env::var("SPOTIFY_CLIENT_ID").map_err(|_| {
        "Spotify is not configured: add SPOTIFY_CLIENT_ID to apps/desktop/.env".to_string()
    })
}

fn auth_file() -> Result<PathBuf, String> {
    dirs::config_dir()
        .map(|dir| dir.join("jarvis").join("spotify-auth.json"))
        .ok_or_else(|| "could not determine the config directory".to_string())
}

fn load_auth() -> Option<StoredAuth> {
    let contents = std::fs::read_to_string(auth_file().ok()?).ok()?;
    serde_json::from_str(&contents).ok()
}

fn save_auth(auth: &StoredAuth) -> Result<(), String> {
    let path = auth_file()?;

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create {}: {}", parent.display(), error))?;
    }

    let json = serde_json::to_string(auth).map_err(|error| error.to_string())?;
    std::fs::write(&path, json)
        .map_err(|error| format!("failed to save Spotify auth: {}", error))
}

fn now_unix() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_secs())
        .unwrap_or(0)
}

/// Whether the Spotify desktop app is installed on this machine.
#[cfg(target_os = "windows")]
pub(crate) fn app_installed() -> bool {
    // Installing Spotify registers the spotify: URI scheme; querying the
    // registry class is reliable for both the installer and Store versions.
    std::process::Command::new("reg")
        .args(["query", "HKCU\\Software\\Classes\\spotify"])
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
        || std::process::Command::new("reg")
            .args(["query", "HKCR\\spotify"])
            .output()
            .map(|output| output.status.success())
            .unwrap_or(false)
}

#[cfg(target_os = "macos")]
pub(crate) fn app_installed() -> bool {
    std::path::Path::new("/Applications/Spotify.app").exists()
}

#[cfg(all(unix, not(target_os = "macos")))]
pub(crate) fn app_installed() -> bool {
    let in_path = std::process::Command::new("which")
        .arg("spotify")
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false);

    in_path
        || std::process::Command::new("flatpak")
            .args(["info", "com.spotify.Client"])
            .output()
            .map(|output| output.status.success())
            .unwrap_or(false)
}

fn random_string(length: usize) -> String {
    const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let mut rng = rand::thread_rng();

    (0..length)
        .map(|_| CHARSET[rng.gen_range(0..CHARSET.len())] as char)
        .collect()
}

/// Blocks until the OAuth redirect arrives on the loopback listener, then
/// returns the authorization code. Runs on a blocking thread.
fn wait_for_callback(expected_state: &str) -> Result<String, String> {
    let listener = TcpListener::bind(("127.0.0.1", REDIRECT_PORT))
        .map_err(|error| format!("could not listen on port {}: {}", REDIRECT_PORT, error))?;
    listener
        .set_nonblocking(true)
        .map_err(|error| format!("listener setup failed: {}", error))?;

    let deadline = Instant::now() + AUTH_WAIT;

    loop {
        match listener.accept() {
            Ok((mut stream, _)) => {
                let mut buffer = [0u8; 4096];
                let read = stream.read(&mut buffer).unwrap_or(0);
                let request = String::from_utf8_lossy(&buffer[..read]);

                // First line looks like: GET /callback?code=...&state=... HTTP/1.1
                let query = request
                    .lines()
                    .next()
                    .and_then(|line| line.split_whitespace().nth(1))
                    .and_then(|path| path.split_once('?'))
                    .map(|(_, query)| query)
                    .unwrap_or("");

                let mut code = None;
                let mut state = None;
                let mut denied = false;

                for pair in query.split('&') {
                    match pair.split_once('=') {
                        Some(("code", value)) => code = Some(value.to_string()),
                        Some(("state", value)) => state = Some(value.to_string()),
                        Some(("error", _)) => denied = true,
                        _ => {}
                    }
                }

                let (status, message) = if denied {
                    ("200 OK", "Spotify access was declined. You can close this tab.")
                } else if code.is_some() && state.as_deref() == Some(expected_state) {
                    ("200 OK", "Jarvis is connected to Spotify. You can close this tab.")
                } else {
                    ("400 Bad Request", "Unexpected request. You can close this tab.")
                };

                let _ = stream.write_all(
                    format!(
                        "HTTP/1.1 {}\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\n{}",
                        status, message
                    )
                    .as_bytes(),
                );

                if denied {
                    return Err("the user declined Spotify access".to_string());
                }

                if let (Some(code), true) = (code, state.as_deref() == Some(expected_state)) {
                    return Ok(code);
                }
                // Ignore stray requests (e.g. favicon) and keep waiting.
            }
            Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                if Instant::now() > deadline {
                    return Err("timed out waiting for Spotify approval".to_string());
                }
                std::thread::sleep(Duration::from_millis(300));
            }
            Err(error) => return Err(format!("callback listener failed: {}", error)),
        }
    }
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    expires_in: u64,
}

async fn request_tokens(form: &[(&str, &str)]) -> Result<TokenResponse, String> {
    let response = reqwest::Client::new()
        .post(TOKEN_URL)
        .form(form)
        .send()
        .await
        .map_err(|error| format!("Spotify token request failed: {}", error))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|error| format!("Spotify token response read failed: {}", error))?;

    if !status.is_success() {
        return Err(format!("Spotify token endpoint returned {}: {}", status, body));
    }

    serde_json::from_str(&body).map_err(|error| format!("invalid token response: {}", error))
}

fn stored_auth_from(response: TokenResponse, previous_refresh: Option<String>) -> StoredAuth {
    StoredAuth {
        access_token: response.access_token,
        refresh_token: response
            .refresh_token
            .or(previous_refresh)
            .unwrap_or_default(),
        expires_at: now_unix() + response.expires_in,
    }
}

/// Returns a valid access token, refreshing it when stale. None means the
/// user has never connected Spotify.
async fn ensure_access_token() -> Result<Option<String>, String> {
    let Some(auth) = load_auth() else {
        return Ok(None);
    };

    if auth.expires_at > now_unix() + 60 {
        return Ok(Some(auth.access_token));
    }

    let client_id = client_id()?;
    let response = request_tokens(&[
        ("grant_type", "refresh_token"),
        ("refresh_token", &auth.refresh_token),
        ("client_id", &client_id),
    ])
    .await?;

    let refreshed = stored_auth_from(response, Some(auth.refresh_token));
    save_auth(&refreshed)?;

    Ok(Some(refreshed.access_token))
}

/// One-time account link: opens the browser for approval, catches the
/// redirect on localhost, and stores the resulting tokens.
#[tauri::command]
pub async fn spotify_connect() -> Result<String, String> {
    let client_id = client_id()?;

    info!("spotify_connect: starting PKCE flow");

    let verifier = random_string(64);
    let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
    let state = random_string(32);

    let authorize_url = format!(
        "{}?response_type=code&client_id={}&redirect_uri={}&scope={}&state={}&code_challenge_method=S256&code_challenge={}",
        AUTHORIZE_URL,
        encode_query(&client_id),
        encode_query(REDIRECT_URI),
        encode_query(SCOPES),
        state,
        challenge,
    );

    open::that_detached(&authorize_url)
        .map_err(|error| format!("failed to open the browser: {}", error))?;

    let code = tauri::async_runtime::spawn_blocking(move || wait_for_callback(&state))
        .await
        .map_err(|error| format!("callback wait failed: {}", error))??;

    let response = request_tokens(&[
        ("grant_type", "authorization_code"),
        ("code", &code),
        ("redirect_uri", REDIRECT_URI),
        ("client_id", &client_id),
        ("code_verifier", &verifier),
    ])
    .await?;

    if response.refresh_token.is_none() {
        return Err("Spotify did not return a refresh token".to_string());
    }

    save_auth(&stored_auth_from(response, None))?;

    Ok("Spotify is connected. Songs will now play in the Spotify app.".to_string())
}

async fn api_get(token: &str, path: &str) -> Result<serde_json::Value, String> {
    let response = reqwest::Client::new()
        .get(format!("{}{}", API_BASE_URL, path))
        .bearer_auth(token)
        .send()
        .await
        .map_err(|error| format!("Spotify request failed: {}", error))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|error| format!("Spotify response read failed: {}", error))?;

    if !status.is_success() {
        return Err(format!("Spotify returned {}: {}", status, body));
    }

    serde_json::from_str(&body).map_err(|error| format!("invalid JSON from Spotify: {}", error))
}

/// Finds the best track for a query. Returns (uri, "Song by Artist").
async fn search_track(token: &str, query: &str) -> Result<(String, String), String> {
    let result = api_get(
        token,
        &format!("/search?type=track&limit=1&q={}", encode_query(query)),
    )
    .await?;

    let track = result["tracks"]["items"]
        .get(0)
        .ok_or_else(|| format!("no Spotify track found for '{}'", query))?;

    let uri = track["uri"]
        .as_str()
        .ok_or_else(|| "track has no uri".to_string())?
        .to_string();

    let name = track["name"].as_str().unwrap_or(query);
    let artist = track["artists"][0]["name"].as_str().unwrap_or("");

    let label = if artist.is_empty() {
        name.to_string()
    } else {
        format!("{} by {}", name, artist)
    };

    Ok((uri, label))
}

/// Returns a device id to play on, preferring the active one. Launches the
/// Spotify app and waits for it to register when no device is available.
async fn playback_device(token: &str) -> Result<String, String> {
    for attempt in 0..DEVICE_WAIT_ATTEMPTS {
        let result = api_get(token, "/me/player/devices").await?;

        let devices = result["devices"].as_array().cloned().unwrap_or_default();

        let chosen = devices
            .iter()
            .find(|device| device["is_active"].as_bool().unwrap_or(false))
            .or_else(|| devices.first());

        if let Some(id) = chosen.and_then(|device| device["id"].as_str()) {
            return Ok(id.to_string());
        }

        if attempt == 0 {
            info!("no Spotify device found, launching the app");
            launch_supported_app("spotify")?;
        }

        tokio::time::sleep(DEVICE_POLL_INTERVAL).await;
    }

    Err("the Spotify app did not become available for playback".to_string())
}

/// Attempts playback in the Spotify app. Ok(None) means Spotify is not
/// installed or not connected — the caller should fall back to YouTube.
pub(crate) async fn try_play(query: &str) -> Result<Option<String>, String> {
    if !app_installed() {
        return Ok(None);
    }

    let Some(token) = ensure_access_token().await? else {
        return Ok(None);
    };

    let (uri, label) = search_track(&token, query).await?;
    let device_id = playback_device(&token).await?;

    let response = reqwest::Client::new()
        .put(format!(
            "{}/me/player/play?device_id={}",
            API_BASE_URL, device_id
        ))
        .bearer_auth(&token)
        .json(&serde_json::json!({ "uris": [uri] }))
        .send()
        .await
        .map_err(|error| format!("Spotify play request failed: {}", error))?;

    let status = response.status();

    if status.as_u16() == 403 {
        return Err("Spotify Premium is required to start playback".to_string());
    }

    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Spotify play returned {}: {}", status, body));
    }

    Ok(Some(format!("Playing {} on Spotify", label)))
}
