// Tauri core process: the desktop shell (window, later tray and shortcuts) and the
// PowerSync plugin, which owns the local SQLite file. Queries and rules stay in
// TypeScript (packages/data, packages/core) — see PLAN.md §4–7.
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_powersync::init())
        .setup(|app| {
            // The plugin opens the database inside the app data folder but doesn't create it.
            std::fs::create_dir_all(app.path().app_data_dir()?)?;
            // Settings → Startup: "Open when the computer starts" (off until you turn it on;
            // Windows keeps the on/off itself). "--autostart" lets a later version start quietly.
            #[cfg(desktop)]
            app.handle().plugin(tauri_plugin_autostart::init(
                tauri_plugin_autostart::MacosLauncher::LaunchAgent,
                Some(vec!["--autostart"]),
            ))?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
