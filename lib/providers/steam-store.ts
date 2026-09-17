/**
 * Public Steam store search — no API key, no account. Used only to suggest names and covers.
 * Covers are hot-linked from Steam's CDN (https), never copied into the repo.
 */
export type SteamHit = { appId: number; name: string; coverUrl: string };

export const steamCoverUrl = (appId: number) =>
  `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`;

/** Never throws: `[]` on any failure or when the query is shorter than 2 characters. */
export async function searchSteamStore(
  q: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SteamHit[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  try {
    const url = `https://store.steampowered.com/api/storesearch/?cc=us&l=en&term=${encodeURIComponent(term)}`;
    const res = await fetchImpl(url, {
      signal: AbortSignal.timeout(5000),
      headers: { accept: "application/json" },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { items?: { id: number; name: string }[] };
    return (json.items ?? [])
      .slice(0, 8)
      .map((i) => ({ appId: i.id, name: i.name, coverUrl: steamCoverUrl(i.id) }));
  } catch {
    return [];
  }
}
