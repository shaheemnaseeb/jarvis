use std::path::{Component, Path, PathBuf};

use log::info;
use walkdir::WalkDir;

const MAX_RESULTS: usize = 20;
const MAX_DEPTH: usize = 6;
const MAX_ENTRIES_SCANNED: usize = 50_000;

/// Directories that are never worth searching and huge enough to matter.
const SKIPPED_DIRS: &[&str] = &[
    "node_modules",
    "target",
    "AppData",
    "Library",
    "dist",
    "build",
    "__pycache__",
    "venv",
];

fn home_dir() -> Result<PathBuf, String> {
    dirs::home_dir().ok_or_else(|| "could not determine the home directory".to_string())
}

/// Resolves a user/AI-supplied path and enforces the home-directory sandbox:
/// relative paths are joined to home, '..' is rejected outright, and absolute
/// paths must already live under home.
fn resolve_in_home(raw: &str) -> Result<PathBuf, String> {
    let path = Path::new(raw.trim());

    if path
        .components()
        .any(|component| matches!(component, Component::ParentDir))
    {
        return Err("paths may not contain '..'".to_string());
    }

    let home = home_dir()?;
    let absolute = if path.is_absolute() {
        path.to_path_buf()
    } else {
        home.join(path)
    };

    if !absolute.starts_with(&home) {
        return Err(format!(
            "access outside the home directory is not allowed: {}",
            absolute.display()
        ));
    }

    Ok(absolute)
}

fn is_searchable(entry: &walkdir::DirEntry) -> bool {
    if !entry.file_type().is_dir() {
        return true;
    }

    match entry.file_name().to_str() {
        Some(name) => !name.starts_with('.') && !SKIPPED_DIRS.contains(&name),
        None => false,
    }
}

#[tauri::command]
pub async fn search_files(query: String) -> Result<Vec<String>, String> {
    let needle = query.trim().to_lowercase();

    if needle.is_empty() {
        return Err("empty search query".to_string());
    }

    info!("search_files called: {}", needle);

    let home = home_dir()?;

    // The walk is blocking work, so keep it off the async runtime's core.
    tauri::async_runtime::spawn_blocking(move || {
        let mut results = Vec::new();
        let mut scanned = 0usize;

        for entry in WalkDir::new(&home)
            .max_depth(MAX_DEPTH)
            .into_iter()
            .filter_entry(is_searchable)
        {
            let Ok(entry) = entry else { continue };

            scanned += 1;
            if scanned > MAX_ENTRIES_SCANNED || results.len() >= MAX_RESULTS {
                break;
            }

            if entry
                .file_name()
                .to_string_lossy()
                .to_lowercase()
                .contains(&needle)
            {
                results.push(entry.path().display().to_string());
            }
        }

        Ok(results)
    })
    .await
    .map_err(|error| format!("file search failed: {}", error))?
}

#[tauri::command]
pub async fn open_path(path: String) -> Result<String, String> {
    info!("open_path called: {}", path);

    let absolute = resolve_in_home(&path)?;

    if !absolute.exists() {
        return Err(format!("path does not exist: {}", absolute.display()));
    }

    open::that_detached(&absolute)
        .map_err(|error| format!("failed to open {}: {}", absolute.display(), error))?;

    Ok(format!("Opened {}", absolute.display()))
}

#[tauri::command]
pub async fn create_folder(path: String) -> Result<String, String> {
    info!("create_folder called: {}", path);

    let absolute = resolve_in_home(&path)?;

    if absolute.exists() {
        return Err(format!("already exists: {}", absolute.display()));
    }

    std::fs::create_dir_all(&absolute)
        .map_err(|error| format!("failed to create {}: {}", absolute.display(), error))?;

    Ok(format!("Created folder {}", absolute.display()))
}
