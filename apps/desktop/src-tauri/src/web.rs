use std::sync::OnceLock;

use log::info;
use reqwest::Client;

/// Keyless web lookups for the assistant's briefing: weather via wttr.in,
/// headlines via Google News RSS, and song playback via YouTube search.
/// None of these require an API key or account.

const YOUTUBE_SEARCH_URL: &str = "https://www.youtube.com/results?search_query=";
const YOUTUBE_WATCH_URL: &str = "https://www.youtube.com/watch?v=";
const GOOGLE_NEWS_RSS_URL: &str = "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en";
const MAX_HEADLINES: usize = 5;

/// wttr.in needs a curl-like user agent to return plain text instead of HTML.
const USER_AGENT: &str = "curl/8.0 (jarvis-desktop)";

fn http_client() -> &'static Client {
    static CLIENT: OnceLock<Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        Client::builder()
            .user_agent(USER_AGENT)
            .build()
            .expect("http client construction cannot fail")
    })
}

async fn fetch_text(url: &str) -> Result<String, String> {
    let response = http_client()
        .get(url)
        .send()
        .await
        .map_err(|error| format!("request failed: {}", error))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|error| format!("response read failed: {}", error))?;

    if !status.is_success() {
        return Err(format!("server returned {}", status));
    }

    Ok(body)
}

/// Percent-encodes a search phrase for use in a URL query (spaces become '+').
pub(crate) fn encode_query(raw: &str) -> String {
    let mut encoded = String::with_capacity(raw.len());

    for byte in raw.trim().bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' => {
                encoded.push(byte as char)
            }
            b' ' => encoded.push('+'),
            other => encoded.push_str(&format!("%{:02X}", other)),
        }
    }

    encoded
}

fn is_video_id(candidate: &str) -> bool {
    candidate.len() == 11
        && candidate
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
}

/// Pulls the first `"videoId":"..."` out of YouTube's search results page.
fn first_video_id(html: &str) -> Option<&str> {
    let marker = "\"videoId\":\"";
    let start = html.find(marker)? + marker.len();
    let rest = &html[start..];
    let end = rest.find('"')?;
    let candidate = &rest[..end];

    is_video_id(candidate).then_some(candidate)
}

#[tauri::command]
pub async fn play_song(query: String) -> Result<String, String> {
    let song = query.trim();

    if song.is_empty() {
        return Err("empty song query".to_string());
    }

    info!("play_song called: {}", song);

    // Prefer the Spotify app when it is installed and the account is
    // connected; anything else (including Spotify errors) falls back to
    // YouTube so the song always plays.
    match crate::spotify::try_play(song).await {
        Ok(Some(message)) => return Ok(message),
        Ok(None) => {}
        Err(error) => info!("Spotify playback unavailable ({}), using YouTube", error),
    }

    let search_url = format!("{}{}", YOUTUBE_SEARCH_URL, encode_query(song));
    let html = fetch_text(&search_url).await?;

    let video_id = first_video_id(&html)
        .ok_or_else(|| format!("no YouTube result found for '{}'", song))?;

    let watch_url = format!("{}{}", YOUTUBE_WATCH_URL, video_id);

    open::that_detached(&watch_url)
        .map_err(|error| format!("failed to open {}: {}", watch_url, error))?;

    Ok(format!("Playing {} on YouTube", song))
}

#[tauri::command]
pub async fn get_weather(city: String) -> Result<String, String> {
    let place = city.trim();

    info!("get_weather called: {}", place);

    // An empty location makes wttr.in geolocate by IP address.
    let location = if place.is_empty() || place.eq_ignore_ascii_case("here") {
        String::new()
    } else {
        encode_query(place)
    };

    let url = format!(
        "https://wttr.in/{}?format=%l:+%C,+%t+(feels+like+%f),+wind+%w,+humidity+%h",
        location
    );

    let report = fetch_text(&url).await?;
    let report = report.trim();

    if report.is_empty() || report.contains("Unknown location") {
        return Err(format!("could not find weather for '{}'", place));
    }

    Ok(report.to_string())
}

/// Replaces the XML entities that actually occur in Google News titles.
fn decode_entities(raw: &str) -> String {
    raw.replace("&amp;", "&")
        .replace("&#39;", "'")
        .replace("&quot;", "\"")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
}

#[tauri::command]
pub async fn get_news() -> Result<String, String> {
    info!("get_news called");

    let xml = fetch_text(GOOGLE_NEWS_RSS_URL).await?;

    // Channel-level <title> tags precede the first <item>; skip past them.
    let items = xml
        .find("<item>")
        .map(|index| &xml[index..])
        .ok_or_else(|| "no news items in feed".to_string())?;

    let mut headlines = Vec::new();
    let mut rest = items;

    while headlines.len() < MAX_HEADLINES {
        let Some(start) = rest.find("<title>") else { break };
        let after_tag = &rest[start + "<title>".len()..];
        let Some(end) = after_tag.find("</title>") else { break };

        headlines.push(decode_entities(after_tag[..end].trim()));
        rest = &after_tag[end..];
    }

    if headlines.is_empty() {
        return Err("could not parse any headlines".to_string());
    }

    Ok(format!("Top headlines:\n{}", headlines.join("\n")))
}
