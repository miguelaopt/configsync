/**
 * Puts the companion binaries where Tauri expects its sidecar: binaries/csync-<target triple>.
 * Copies whichever `pnpm build:companion` (or a download from configsync.app) left in public/.
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";

const PAIRS = {
  "public/csync-windows-x64.exe": "csync-x86_64-pc-windows-msvc.exe",
  "public/csync-linux-x64": "csync-x86_64-unknown-linux-gnu",
};
const dir = "desktop/src-tauri/binaries";
mkdirSync(dir, { recursive: true });
const copied = Object.entries(PAIRS).filter(([from]) => existsSync(from));
if (copied.length === 0)
  throw new Error(
    "No companion binary in public/. Run pnpm build:companion, or download csync-windows-x64.exe from configsync.app into public/.",
  );
for (const [from, to] of copied) copyFileSync(from, `${dir}/${to}`);
console.log(copied.map(([, to]) => `${dir}/${to}`).join("\n"));
