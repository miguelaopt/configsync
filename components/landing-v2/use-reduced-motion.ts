"use client";
import * as React from "react";

const QUERY = "(prefers-reduced-motion: reduce)";
const get = () => window.matchMedia(QUERY).matches;
const subscribe = (cb: () => void) => {
  const m = window.matchMedia(QUERY);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

/** The visitor's reduced-motion setting; false while rendering on the server. */
export function useReducedMotion() {
  return React.useSyncExternalStore(subscribe, get, () => false);
}
