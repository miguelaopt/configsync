// No console window behind the app in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, WindowEvent, Wry,
};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};
use tauri_plugin_shell::{
    process::{CommandChild, CommandEvent},
    ShellExt,
};

/// Passed by the autostart entry, so a start with Windows stays in the tray.
const STARTED_WITH_WINDOWS: &str = "--tray";

/// The `csync watch` the tray started, if it is running.
struct Watch(Mutex<Option<CommandChild>>);

/// A file in the app's config dir remembers "Keep games in sync" between launches.
fn remember(app: &AppHandle, on: bool) {
    if let Ok(dir) = app.path().app_config_dir() {
        let flag = dir.join("watch-on");
        let _ = if on {
            std::fs::create_dir_all(&dir).and_then(|_| std::fs::write(flag, ""))
        } else {
            std::fs::remove_file(flag)
        };
    }
}

fn remembered(app: &AppHandle) -> bool {
    app.path()
        .app_config_dir()
        .map(|d| d.join("watch-on").exists())
        .unwrap_or(false)
}

/// `csync watch --install` puts a watch in the Startup folder. The app owns the watch now, so it
/// removes that one: two watches would both apply presets.
fn remove_cli_autostart() {
    if let Ok(appdata) = std::env::var("APPDATA") {
        let cmd = std::path::Path::new(&appdata)
            .join(r"Microsoft\Windows\Start Menu\Programs\Startup\csync-watch.cmd");
        let _ = std::fs::remove_file(cmd);
    }
}

/// Starts or stops the sidecar's `csync watch`, and the app's own start with Windows with it. The
/// watch keeps every game's files equal to the preset chosen for this PC, and never writes while
/// a game runs.
fn set_watch(app: &AppHandle, item: &CheckMenuItem<Wry>, on: bool) {
    let state = app.state::<Watch>();
    let mut current = state.0.lock().unwrap();
    if let Some(child) = current.take() {
        let _ = child.kill();
    }
    let mut running = false;
    if on {
        if let Ok((mut events, child)) =
            app.shell().sidecar("csync").and_then(|c| c.args(["watch"]).spawn())
        {
            let pid = child.pid();
            *current = Some(child);
            running = true;
            // If it exits by itself (signed out, no Pro, crash), the tick goes off.
            let (app, item) = (app.clone(), item.clone());
            tauri::async_runtime::spawn(async move {
                while let Some(event) = events.recv().await {
                    if let CommandEvent::Terminated(_) = event {
                        let state = app.state::<Watch>();
                        let mut current = state.0.lock().unwrap();
                        if current.as_ref().map(|c| c.pid()) == Some(pid) {
                            current.take();
                            let _ = item.set_checked(false);
                        }
                        break;
                    }
                }
            });
        }
    }
    let _ = item.set_checked(running);
    remember(app, on);
    let _ = if on {
        remove_cli_autostart();
        app.autolaunch().enable()
    } else {
        app.autolaunch().disable()
    };
}

fn show(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// The window is the UI; the tray keeps `csync watch` running after it is closed.
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec![STARTED_WITH_WINDOWS]),
        ))
        .manage(Watch(Mutex::new(None)))
        .setup(|app| {
            let open = MenuItem::with_id(app, "open", "Open ConfigSync", true, None::<&str>)?;
            let watch = CheckMenuItem::with_id(
                app,
                "watch",
                "Keep games in sync",
                true,
                false,
                None::<&str>,
            )?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(
                app,
                &[&open, &watch, &PredefinedMenuItem::separator(app)?, &quit],
            )?;
            let item = watch.clone();
            TrayIconBuilder::with_id("main")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("ConfigSync")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "open" => show(app),
                    // The menu has already flipped the tick; follow it.
                    "watch" => set_watch(app, &item, item.is_checked().unwrap_or(false)),
                    "quit" => {
                        if let Some(child) = app.state::<Watch>().0.lock().unwrap().take() {
                            let _ = child.kill();
                        }
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show(tray.app_handle());
                    }
                })
                .build(app)?;
            if remembered(app.handle()) {
                set_watch(app.handle(), &watch, true);
            }
            // The window starts hidden; only a start with Windows leaves it in the tray.
            if !std::env::args().any(|a| a == STARTED_WITH_WINDOWS) {
                show(app.handle());
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running ConfigSync");
}
