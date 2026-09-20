import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";

function unitPath() {
  return join(
    process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"),
    "systemd",
    "user",
    "csync-watch.service",
  );
}
function startupCmdPath() {
  return join(
    process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"),
    "Microsoft",
    "Windows",
    "Start Menu",
    "Programs",
    "Startup",
    "csync-watch.cmd",
  );
}

/**
 * Start `csync watch` with the user session. `scriptPath` is null when csync runs as a single
 * executable — then `exe` alone is the command. Returns a sentence describing what was done.
 */
export function install(exe, scriptPath) {
  const command = scriptPath ? `"${exe}" "${scriptPath}"` : `"${exe}"`;
  if (process.platform === "linux") {
    const p = unitPath();
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(
      p,
      `[Unit]\nDescription=ConfigSync companion — keeps game config files in sync\nAfter=network-online.target\n\n[Service]\nExecStart=${command} watch\nRestart=on-failure\nRestartSec=30\n\n[Install]\nWantedBy=default.target\n`,
    );
    execFileSync("systemctl", ["--user", "daemon-reload"]);
    execFileSync("systemctl", ["--user", "enable", "--now", "csync-watch"]);
    return `Installed and started systemd user unit ${p}. Logs: journalctl --user -u csync-watch -f`;
  }
  if (process.platform === "win32") {
    const p = startupCmdPath();
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, `@echo off\r\nstart "" /min ${command} watch\r\n`);
    return `Installed ${p}. It starts with Windows; run it once now or sign in again.`;
  }
  throw new Error("Autostart isn't supported on this OS yet. Run `csync watch` in a terminal.");
}

export function uninstall() {
  if (process.platform === "linux") {
    try {
      execFileSync("systemctl", ["--user", "disable", "--now", "csync-watch"], { stdio: "ignore" });
    } catch {
      // not installed
    }
    if (existsSync(unitPath())) unlinkSync(unitPath());
    return "Removed the csync-watch systemd user unit.";
  }
  if (process.platform === "win32") {
    if (existsSync(startupCmdPath())) unlinkSync(startupCmdPath());
    return "Removed csync-watch from the Startup folder.";
  }
  throw new Error("Autostart isn't supported on this OS yet.");
}
