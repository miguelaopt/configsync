import { describe, expect, it } from "vitest";
import { searchSteamStore } from "@/lib/providers/steam-store";

const ok = (body: unknown) =>
  (async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;

describe("searchSteamStore", () => {
  it("maps store results to name, app id and header image", async () => {
    const r = await searchSteamStore(
      "counter",
      ok({ items: [{ id: 730, name: "Counter-Strike 2" }] }),
    );
    expect(r).toEqual([
      {
        appId: 730,
        name: "Counter-Strike 2",
        coverUrl: "https://cdn.cloudflare.steamstatic.com/steam/apps/730/header.jpg",
      },
    ]);
  });
  it("returns [] for short queries and on errors", async () => {
    expect(await searchSteamStore("c", ok({ items: [] }))).toEqual([]);
    const boom = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    expect(await searchSteamStore("counter", boom)).toEqual([]);
  });
});
