import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { env } from "@/lib/env";

// One connection pool per process (Next.js dev re-evaluates modules; cache on globalThis).
const globalForDb = globalThis as unknown as { __gsvSql?: ReturnType<typeof postgres> };

const sql =
  globalForDb.__gsvSql ??
  postgres(env.DATABASE_URL, {
    max: env.NODE_ENV === "production" ? 10 : 5,
    prepare: false,
  });

if (env.NODE_ENV !== "production") globalForDb.__gsvSql = sql;

export const db = drizzle(sql, { schema });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export { schema };
