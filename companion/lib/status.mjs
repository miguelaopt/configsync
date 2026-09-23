import { api } from "./api.mjs";
import { readFiles } from "./apply.mjs";
import { loadState } from "./state.mjs";

/**
 * Everything the desktop window shows, in one call — and a useful `csync status` for a person.
 *
 * Composes three endpoints that already exist, so nothing on the server changes. The target
 * preset comes from `/default`, which is Free, rather than `/sync`, which is Pro: the window
 * has to work identically on both plans.
 */
export async function status(config) {
  if (!config) return { loggedIn: false };
  const client = api(config);
  const [me, catalog] = await Promise.all([client.get("/me"), client.get("/catalog")]);
  const state = loadState();
  const games = [];
  for (const game of catalog.games) {
    const { found } = readFiles(game, { log: () => {} });
    games.push({
      id: game.id,
      name: game.name,
      installed: found.length > 0,
      files: found.length,
      target: await targetFor(client, game.id, config.device),
      applied: state.applied?.[game.id] ?? null,
    });
  }
  return {
    loggedIn: true,
    url: config.url,
    device: config.device,
    user: me.user,
    plan: me.plan,
    games,
  };
}

/**
 * The preset this PC should run for a game, or null when the account has no Default for it yet.
 * A new account has none at all, and the window still has to render — so a 404 is an answer,
 * while anything else is a failure worth surfacing.
 */
async function targetFor(client, gameId, device) {
  try {
    const t = await client.get(
      `/default?game=${encodeURIComponent(gameId)}&device=${encodeURIComponent(device)}`,
    );
    return { presetSlug: t.presetSlug, presetName: t.presetName, version: t.version };
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}
