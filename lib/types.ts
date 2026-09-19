export type SearchParams = Promise<Record<string, string | string[] | undefined>>;
export type Params<T extends string> = Promise<Record<T, string>>;

/** How the games library is ordered. Shared by the page and the (client) toolbar. */
export type GameSort = "updated" | "name" | "presets";
export const GAME_SORTS: { value: GameSort; label: string }[] = [
  { value: "updated", label: "Recently updated" },
  { value: "name", label: "Name" },
  { value: "presets", label: "Most presets" },
];
