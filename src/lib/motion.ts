// docs/site.md section 17. prefers-reduced-motion helpers.

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function getMediaQuery(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  return window.matchMedia(QUERY);
}

export function prefersReducedMotion(): boolean {
  return getMediaQuery()?.matches ?? false;
}

function subscribe(cb: () => void): () => void {
  const mq = getMediaQuery();
  if (mq === null) return () => {};
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, prefersReducedMotion, () => false);
}
