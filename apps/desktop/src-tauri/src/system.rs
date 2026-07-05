use sysinfo::System;

const BYTES_PER_GB: f64 = 1_073_741_824.0;

#[tauri::command]
pub async fn system_info() -> Result<String, String> {
    let mut sys = System::new_all();
    sys.refresh_all();

    let os_name = System::name().unwrap_or_else(|| "Unknown OS".to_string());
    let os_version = System::os_version().unwrap_or_default();
    let host = System::host_name().unwrap_or_else(|| "unknown".to_string());

    let cpu_brand = sys
        .cpus()
        .first()
        .map(|cpu| cpu.brand().trim().to_string())
        .unwrap_or_else(|| "unknown CPU".to_string());
    let cpu_count = sys.cpus().len();

    let used_gb = sys.used_memory() as f64 / BYTES_PER_GB;
    let total_gb = sys.total_memory() as f64 / BYTES_PER_GB;

    Ok(format!(
        "{} {} on {}. CPU: {} with {} logical cores. Memory: {:.1} of {:.1} GB in use.",
        os_name, os_version, host, cpu_brand, cpu_count, used_gb, total_gb
    ))
}
