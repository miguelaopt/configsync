/**
 * One decision per game per tick. `remote` is the vault's Default (`{ presetSlug, version }` or
 * null), `applied` what this machine last wrote, `running` whether the game's process is up.
 */
export function decide({ remote, applied, running }) {
  if (!remote) return "skip";
  if (applied && applied.presetSlug === remote.presetSlug && applied.version === remote.version)
    return "skip";
  return running ? "wait" : "apply";
}
