"use client";
import { useLayoutEffect } from "react";
import type { UserPreferences } from "@/lib/db/schema";

/** Mirrors profile preferences into localStorage + the <html> dataset (see themeScript in app/layout). */
export function ThemeSync({ preferences }: { preferences: UserPreferences }) {
  const theme = preferences.theme ?? "dark";
  const density = preferences.density ?? "comfortable";
  useLayoutEffect(() => {
    try {
      localStorage.setItem("gsv-theme", theme);
      localStorage.setItem("gsv-density", density);
    } catch {
      /* private mode */
    }
    const apply = () => {
      const resolved =
        theme === "system"
          ? matchMedia("(prefers-color-scheme: light)").matches
            ? "light"
            : "dark"
          : theme;
      if (resolved === "light") document.documentElement.dataset.theme = "light";
      else delete document.documentElement.dataset.theme;
      if (density === "compact") document.documentElement.dataset.density = "compact";
      else delete document.documentElement.dataset.density;
    };
    apply();
    const mq = matchMedia("(prefers-color-scheme: light)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme, density]);
  return null;
}
