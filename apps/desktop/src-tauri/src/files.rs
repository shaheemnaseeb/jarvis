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

/// Resolves a destination: if it points at an existing directory the source's
/// file name is appended (so "move X to Documents" does the natural thing).
/// Existing destinations are always rejected — no silent overwrites.
fn resolve_destination(source: &Path, to_raw: &str) -> Result<PathBuf, String> {
    let mut target = resolve_in_home(to_raw)?;

    if target.is_dir() {
        let name = source
            .file_name()
            .ok_or_else(|| "invalid source file name".to_string())?;
        target = target.join(name);
    }

    if target.exists() {
        return Err(format!(
            "destination already exists: {}",
            target.display()
        ));
    }

    match target.parent() {
        Some(parent) if parent.exists() => Ok(target),
        Some(parent) => Err(format!(
            "destination folder does not exist: {}",
            parent.display()
        )),
        None => Err("invalid destination".to_string()),
    }
}

#[tauri::command]
pub async fn move_file(from: String, to: String) -> Result<String, String> {
    info!("move_file called: {} -> {}", from, to);

    let source = resolve_in_home(&from)?;

    if !source.exists() {
        return Err(format!("source does not exist: {}", source.display()));
    }

    let target = resolve_destination(&source, &to)?;

    std::fs::rename(&source, &target).map_err(|error| {
        format!(
            "failed to move {} to {}: {}",
            source.display(),
            target.display(),
            error
        )
    })?;

    Ok(format!("Moved {} to {}", source.display(), target.display()))
}

#[tauri::command]
pub async fn copy_file(from: String, to: String) -> Result<String, String> {
    info!("copy_file called: {} -> {}", from, to);

    let source = resolve_in_home(&from)?;

    if !source.is_file() {
        return Err(format!(
            "source is not a file: {}",
            source.display()
        ));
    }

    let target = resolve_destination(&source, &to)?;

    std::fs::copy(&source, &target).map_err(|error| {
        format!(
            "failed to copy {} to {}: {}",
            source.display(),
            target.display(),
            error
        )
    })?;

    Ok(format!("Copied {} to {}", source.display(), target.display()))
}

/// Deletes by moving to the system recycle bin — never permanent removal.
#[tauri::command]
pub async fn delete_path(path: String) -> Result<String, String> {
    info!("delete_path called: {}", path);

    let absolute = resolve_in_home(&path)?;

    if !absolute.exists() {
        return Err(format!("path does not exist: {}", absolute.display()));
    }

    trash::delete(&absolute)
        .map_err(|error| format!("failed to delete {}: {}", absolute.display(), error))?;

    Ok(format!("Moved {} to the recycle bin", absolute.display()))
}

const MAX_READ_BYTES: u64 = 32_768;

#[tauri::command]
pub async fn read_file(path: String) -> Result<String, String> {
    use std::io::Read;

    info!("read_file called: {}", path);

    let absolute = resolve_in_home(&path)?;

    if !absolute.is_file() {
        return Err(format!("not a file: {}", absolute.display()));
    }

    let file = std::fs::File::open(&absolute)
        .map_err(|error| format!("failed to open {}: {}", absolute.display(), error))?;

    let total_len = file
        .metadata()
        .map(|metadata| metadata.len())
        .unwrap_or(0);

    let mut buffer = Vec::new();
    file.take(MAX_READ_BYTES)
        .read_to_end(&mut buffer)
        .map_err(|error| format!("failed to read {}: {}", absolute.display(), error))?;

    if buffer.contains(&0) {
        return Err(format!(
            "{} looks like a binary file, not text",
            absolute.display()
        ));
    }

    let mut text = String::from_utf8_lossy(&buffer).into_owned();

    if total_len > MAX_READ_BYTES {
        text.push_str("\n...(file truncated)");
    }

    Ok(text)
}

const MAX_WRITE_BYTES: usize = 65_536;

/// Writes a new text file — never overwrites an existing one, mirroring the
/// no-silent-overwrite rule used by move/copy.
#[tauri::command]
pub async fn write_file(path: String, content: String) -> Result<String, String> {
    info!("write_file called: {}", path);

    let absolute = resolve_in_home(&path)?;

    if absolute.exists() {
        return Err(format!("already exists: {}", absolute.display()));
    }

    if content.len() > MAX_WRITE_BYTES {
        return Err("content too large to write".to_string());
    }

    match absolute.parent() {
        Some(parent) if parent.exists() => {}
        Some(parent) => {
            return Err(format!(
                "folder does not exist: {} (create it first with create_folder)",
                parent.display()
            ))
        }
        None => return Err("invalid destination".to_string()),
    }

    std::fs::write(&absolute, content)
        .map_err(|error| format!("failed to write {}: {}", absolute.display(), error))?;

    Ok(format!("Wrote {}", absolute.display()))
}

/// Appends a line of text to a file, creating it if needed. Additive only,
/// so unlike write_file it may target an existing file without confirmation.
#[tauri::command]
pub async fn append_file(path: String, content: String) -> Result<String, String> {
    use std::io::Write;

    info!("append_file called: {}", path);

    let absolute = resolve_in_home(&path)?;

    if content.len() > MAX_WRITE_BYTES {
        return Err("content too large to write".to_string());
    }

    if absolute.is_dir() {
        return Err(format!("is a folder, not a file: {}", absolute.display()));
    }

    match absolute.parent() {
        Some(parent) if parent.exists() => {}
        Some(parent) => {
            return Err(format!(
                "folder does not exist: {} (create it first with create_folder)",
                parent.display()
            ))
        }
        None => return Err("invalid destination".to_string()),
    }

    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&absolute)
        .map_err(|error| format!("failed to open {}: {}", absolute.display(), error))?;

    writeln!(file, "{}", content.trim_end())
        .map_err(|error| format!("failed to append to {}: {}", absolute.display(), error))?;

    Ok(format!("Added to {}", absolute.display()))
}

const MAX_LIST_ENTRIES: usize = 100;

#[tauri::command]
pub async fn list_folder(path: String) -> Result<Vec<String>, String> {
    info!("list_folder called: {}", path);

    let absolute = resolve_in_home(&path)?;

    if !absolute.is_dir() {
        return Err(format!("not a folder: {}", absolute.display()));
    }

    let entries = std::fs::read_dir(&absolute)
        .map_err(|error| format!("failed to list {}: {}", absolute.display(), error))?;

    let mut names: Vec<String> = entries
        .filter_map(|entry| entry.ok())
        .take(MAX_LIST_ENTRIES)
        .map(|entry| {
            let mut name = entry.file_name().to_string_lossy().into_owned();
            if entry.file_type().map(|kind| kind.is_dir()).unwrap_or(false) {
                name.push('/');
            }
            name
        })
        .collect();

    // Folders (trailing '/') sort together, then case-insensitive by name.
    names.sort_by_key(|name| (!name.ends_with('/'), name.to_lowercase()));

    Ok(names)
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
