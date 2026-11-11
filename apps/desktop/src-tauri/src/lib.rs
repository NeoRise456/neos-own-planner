// Tauri core process. No commands yet: the dashboard runs on mock data in the
// webview. The data layer (SeaORM + SQLite, tauri-specta) arrives in phase 2
// — see PLAN.md §5–6.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
