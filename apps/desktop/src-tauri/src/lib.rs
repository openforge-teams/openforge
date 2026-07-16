use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tauri::Manager;

#[derive(Serialize)]
struct DirEntry {
    name: String,
    path: String,
    is_directory: bool,
}

#[tauri::command(rename_all = "snake_case")]
fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
fn write_file(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = PathBuf::from(&path).parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
fn list_dir(path: String) -> Result<Vec<DirEntry>, String> {
    let entries = fs::read_dir(&path).map_err(|e| e.to_string())?;
    let mut result = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let meta = entry.metadata().map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();
        let entry_path = entry.path().to_string_lossy().to_string();
        result.push(DirEntry {
            name,
            path: entry_path,
            is_directory: meta.is_dir(),
        });
    }

    result.sort_by(|a, b| {
        match (a.is_directory, b.is_directory) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(result)
}

#[tauri::command(rename_all = "snake_case")]
fn run_command(cwd: String, cmd: String) -> Result<String, String> {
    let output = if cfg!(target_os = "windows") {
        Command::new("cmd")
            .args(["/C", &cmd])
            .current_dir(&cwd)
            .output()
    } else {
        Command::new("sh")
            .args(["-c", &cmd])
            .current_dir(&cwd)
            .output()
    }
    .map_err(|e| e.to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    if output.status.success() {
        Ok(stdout.to_string())
    } else {
        Ok(format!("{stdout}{stderr}"))
    }
}

#[tauri::command(rename_all = "snake_case")]
fn get_home_config(app: tauri::AppHandle) -> Result<String, String> {
    app.path()
        .app_data_dir()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
fn watch_project(_path: String) -> Result<(), String> {
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            read_file,
            write_file,
            list_dir,
            run_command,
            get_home_config,
            watch_project,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
