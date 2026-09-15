use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, fs, path::PathBuf, process::Command};

#[derive(Serialize, Deserialize, Clone)]
struct AppData { groups: Vec<serde_json::Value>, draws: Vec<serde_json::Value>, #[serde(default)] settings: serde_json::Value }

fn data_path() -> PathBuf {
    std::env::current_exe().expect("executable path").parent().expect("executable directory").join("data").join("draw.sqlite")
}

fn probability_path() -> PathBuf {
    std::env::current_exe().expect("executable path").parent().expect("executable directory").join("data").join("probabilities").join("probabilities.txt")
}

fn connection() -> Result<Connection, String> {
    let path = data_path();
    if let Some(parent) = path.parent() { fs::create_dir_all(parent).map_err(|error| error.to_string())?; }
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    connection.execute("CREATE TABLE IF NOT EXISTS app_data (id INTEGER PRIMARY KEY CHECK (id = 1), payload TEXT NOT NULL)", []).map_err(|error| error.to_string())?;
    Ok(connection)
}

#[tauri::command]
fn load_data() -> Result<AppData, String> {
    let connection = connection()?;
    match connection.query_row("SELECT payload FROM app_data WHERE id = 1", [], |row| row.get::<_, String>(0)) {
        Ok(text) => serde_json::from_str(&text).map_err(|error| error.to_string()),
        Err(rusqlite::Error::QueryReturnedNoRows) => Err("no saved data".to_string()),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
fn save_data(data: AppData) -> Result<(), String> {
    let connection = connection()?;
    let payload = serde_json::to_string(&data).map_err(|error| error.to_string())?;
    connection.execute("INSERT INTO app_data (id, payload) VALUES (1, ?1) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload", params![payload]).map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn load_probabilities() -> Result<HashMap<String, f64>, String> {
    let mut values = HashMap::new();
    let text = match fs::read_to_string(probability_path()) {
        Ok(text) => text,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(values),
        Err(error) => return Err(error.to_string()),
    };
    for line in text.lines() {
        let parts: Vec<_> = line.splitn(3, '-').map(str::trim).collect();
        if parts.len() != 3 { continue; }
        if let Ok(probability) = parts[2].trim_end_matches('%').parse::<f64>() {
            if probability > 0.0 { values.insert(format!("{}-{}", parts[0], parts[1]), probability); }
        }
    }
    Ok(values)
}

#[tauri::command]
fn open_github() -> Result<(), String> {
    Command::new("cmd")
        .args(["/C", "start", "", "https://github.com/Zephyrus-L/4class-draw-lots"])
        .spawn()
        .map(|_| ())
        .map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default().invoke_handler(tauri::generate_handler![load_data, save_data, load_probabilities, open_github]).run(tauri::generate_context!()).expect("error while running application");
}
