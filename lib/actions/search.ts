"use server";
import { z } from "zod";
import { searchAll } from "@/lib/data/search";
import { runAction } from "./shared";

export async function searchAction(query: string) {
  return runAction(z.object({ query: z.string().max(200) }), { query }, async (v, userId) => {
    return searchAll(userId, v.query, 6);
  });
}
