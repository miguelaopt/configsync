export type SearchParams = Promise<Record<string, string | string[] | undefined>>;
export type Params<T extends string> = Promise<Record<T, string>>;
