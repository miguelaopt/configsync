"use client";
import { useLayoutEffect } from "react";
import type { UserPreferences } from "@/lib/db/schema";

/** Mirrors the density preference into localStorage + <html> (see densityScript in app/layout). */
export function ThemeSync({ preferences }: { preferences: UserPreferences }) {
  const density = preferences.density ?? "comfortable";
  useLayoutEffect(() => {
    try {
      localStorage.setItem("csync-density", density);
    } catch {
      /* private mode */
    }
    if (density === "compact") document.documentElement.dataset.density = "compact";
    else delete document.documentElement.dataset.density;
  }, [density]);
  return null;
}
