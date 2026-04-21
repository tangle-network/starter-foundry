// Tray-only daemon: no window ships by default. The user interacts via
// the tray menu and receives feedback through native OS notifications.
//
// Menu items are registered up-front with stable ids so the handler can
// dispatch to Tauri commands (keeps business logic separable from the
// menu wiring).

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    Manager,
};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_notification::NotificationExt;

#[tauri::command]
fn sync_now(app: tauri::AppHandle) -> Result<(), String> {
    // Replace with real sync work; this stub sends a confirmation
    // notification so agents can smoke-test the tray → notification
    // pipeline end-to-end on first run.
    app.notification()
        .builder()
        .title("Sync complete")
        .body("All local changes are up to date.")
        .show()
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--autostart"]),
        ))
        .invoke_handler(tauri::generate_handler![sync_now])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let status = MenuItem::with_id(app, "status", "● Idle", false, None::<&str>)?;
            let sep1 = PredefinedMenuItem::separator(app)?;
            let sync = MenuItem::with_id(app, "sync", "Sync now", true, None::<&str>)?;
            let logs = MenuItem::with_id(app, "logs", "Open logs…", true, None::<&str>)?;
            let prefs = MenuItem::with_id(app, "prefs", "Preferences…", true, None::<&str>)?;
            let sep2 = PredefinedMenuItem::separator(app)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

            let menu = Menu::with_items(
                app,
                &[&status, &sep1, &sync, &logs, &prefs, &sep2, &quit],
            )?;

            // Fallback to a transparent 16×16 placeholder when no icon files have been
            // generated yet. Run `pnpm tauri icon <source.png>` to replace it.
            let icon = app.default_window_icon()
                .cloned()
                .unwrap_or_else(|| tauri::image::Image::new_owned(vec![0u8; 16 * 16 * 4], 16, 16));
            let _tray = TrayIconBuilder::with_id("main")
                .icon(icon)
                .menu(&menu)
                .tooltip("{{projectName}}")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "sync" => {
                        let _ = sync_now(app.clone());
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    "logs" | "prefs" => {
                        // Lazy-create a hidden webview here if/when the
                        // project needs a real settings pane. Left as a
                        // no-op so the daemon stays windowless by default.
                        let _ = app.notification()
                            .builder()
                            .title("{{projectName}}")
                            .body("Settings pane not wired yet — extend in src-tauri/src/lib.rs.")
                            .show();
                    }
                    _ => {}
                })
                .build(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri tray daemon");
}
