import { readdirSync, readFileSync, readlinkSync } from "node:fs";
import { basename } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

/** Windows `tasklist /fo csv /nh` → image names. */
export function parseTasklist(csv) {
  return csv
    .split(/\r?\n/)
    .filter((l) => l.startsWith('"'))
    .map((l) => l.slice(1, l.indexOf('",')));
}

/** Lower-cased executable names of every running process. */
export async function runningProcessNames() {
  const names = new Set();
  if (process.platform === "win32") {
    const { stdout } = await run("tasklist", ["/fo", "csv", "/nh"]);
    for (const n of parseTasklist(stdout)) names.add(n.toLowerCase());
    return names;
  }
  try {
    for (const pid of readdirSync("/proc").filter((d) => /^\d+$/.test(d))) {
      try {
        names.add(readFileSync(`/proc/${pid}/comm`, "utf8").trim().toLowerCase());
      } catch {
        // process exited between readdir and read
      }
      try {
        // comm is the *thread* name, which a program can rename — node calls itself
        // "node-MainThread" — so take the executable behind it as well, or a game that renames
        // its main thread reads as "not running" and the write guard opens.
        names.add(basename(readlinkSync(`/proc/${pid}/exe`)).toLowerCase());
      } catch {
        // exited, kernel thread, or another user's process: no readable exe link
      }
    }
  } catch {
    const { stdout } = await run("ps", ["-eo", "comm="]); // macOS: no /proc
    for (const l of stdout.split("\n"))
      if (l.trim()) names.add(l.trim().split("/").pop().toLowerCase());
  }
  return names;
}

/** Any of the game's process names is running. /proc/<pid>/comm is cut at 15 chars, so match that too. */
export function isRunning(game, names) {
  return (game.processNames ?? []).some((p) => {
    const n = p.toLowerCase();
    return names.has(n) || names.has(n.slice(0, 15));
  });
}

/**
 * Throws unless the game is closed. Fails closed: if the process list cannot be read the error
 * propagates, because "we could not tell" must never be treated as "not running".
 * `readNames` is the seam the tests use; nothing else should pass it.
 */
export async function assertGameClosed(game, readNames = runningProcessNames) {
  if (isRunning(game, await readNames()))
    throw new Error(`${game.name} is running. Close it and apply again.`);
}
