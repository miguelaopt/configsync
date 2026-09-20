"use client";
import * as React from "react";
import { z } from "zod";

/**
 * A short per-account list kept in this browser's localStorage — "Recent imports", "Recent
 * exports". Not a server log: it is a convenience, and every write is allowed to fail.
 */
export function createRecentStore<T extends z.ZodType>(name: string, schema: T, max = 8) {
  type Item = z.infer<T>;
  const key = (userId: string) => `configsync:${name}:${userId}`;
  const event = `configsync:${name}-changed`;

  const read = (userId: string) => {
    try {
      return localStorage.getItem(key(userId));
    } catch {
      return null;
    }
  };
  const parse = (raw: string | null): Item[] => {
    try {
      const result = z.array(schema).safeParse(JSON.parse(raw ?? "[]"));
      return result.success ? (result.data as Item[]) : [];
    } catch {
      return [];
    }
  };
  const write = (userId: string, items: Item[]) => {
    try {
      localStorage.setItem(key(userId), JSON.stringify(items.slice(0, max)));
      window.dispatchEvent(new Event(event));
    } catch {
      /* Storage is optional. */
    }
  };
  const subscribe = (listener: () => void) => {
    window.addEventListener(event, listener);
    window.addEventListener("storage", listener);
    return () => {
      window.removeEventListener(event, listener);
      window.removeEventListener("storage", listener);
    };
  };

  return {
    /** Newest first. */
    add: (userId: string, item: Item) => write(userId, [item, ...parse(read(userId))]),
    removeAt: (userId: string, index: number) =>
      write(
        userId,
        parse(read(userId)).filter((_, i) => i !== index),
      ),
    useItems: (userId: string): Item[] => {
      const raw = React.useSyncExternalStore(
        subscribe,
        () => read(userId),
        () => null,
      );
      return React.useMemo(() => parse(raw), [raw]);
    },
  };
}
