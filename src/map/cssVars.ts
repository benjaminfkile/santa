// Reads a CSS custom property from `<html>` so imperative canvases (map
// marker icons, user location) can pick up the current colour scheme's
// token. Returns the fallback if the property is empty or reading fails
// (jsdom, missing property).

export function readCssVar(name: string, fallback: string): string {
  if (typeof window === "undefined" || typeof getComputedStyle !== "function") return fallback;
  try {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value === "" ? fallback : value;
  } catch {
    return fallback;
  }
}
