"use server";
import { z } from "zod";
import { CATALOG } from "@/lib/catalog";
import { listDeviceGames } from "@/lib/data/devices";
import { searchSteamStore } from "@/lib/providers/steam-store";
import { runAction } from "./shared";

const catalogIdFor = (source: "steam" | "epic", appId: string) =>
  CATALOG.find((g) =>
    source === "steam" ? String(g.steamAppId) === appId : g.epicAppName === appId,
  )?.id ?? null;

/** Name suggestions for the Add-game form: games installed on the user's devices, then Steam. */
export async function searchGamesAction(q: string) {
  return runAction(z.object({ q: z.string().max(80) }), { q }, async (v, userId) => {
    const [installed, steam] = await Promise.all([
      listDeviceGames(userId, v.q),
      searchSteamStore(v.q),
    ]);
    return {
      installed: installed.map((g) => ({
        device: g.device,
        source: g.source,
        appId: g.appId,
        name: g.name,
        catalogId: catalogIdFor(g.source, g.appId),
      })),
      steam: steam.map((s) => ({ ...s, catalogId: catalogIdFor("steam", String(s.appId)) })),
    };
  });
}
