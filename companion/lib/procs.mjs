import { readdirSync, readFileSync } from "node:fs";
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
