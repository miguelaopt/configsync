# ConfigSync desktop (Windows)

A Tauri window around the companion. It does nothing itself: every read, write and request is
`csync.exe --json`, shipped inside the app as a sidecar. See
`docs/superpowers/specs/2026-09-23-windows-desktop-app-design.md`.

## Try it on Windows (nothing to install)

The `Desktop` workflow builds the `.msi` on every PR that touches `desktop/` or `companion/`
(or by hand: Actions → Desktop → Run workflow). Open the run, download the `configsync-msi`
artifact, unzip, install. Windows SmartScreen warns because it is unsigned: More info → Run anyway.

## Build it on Windows

Once: install [Rust](https://rustup.rs) (default MSVC toolchain), Visual Studio Build Tools with
"Desktop development with C++", Node 22 and pnpm. WebView2 ships with Windows 11.

    curl.exe -fsSL https://configsync.app/csync-windows-x64.exe -o public/csync-windows-x64.exe
    pnpm desktop:dev

`pnpm desktop:build` produces the `.msi` under `desktop/src-tauri/target/release/bundle/msi/`.

## On Linux

Only for working on the window: install `rustup` and `webkit2gtk-4.1`, run
`pnpm build:companion`, then `pnpm desktop:dev`. The product has no Linux GUI.

## Tests

    node --test "desktop/test/**/*.test.js"
