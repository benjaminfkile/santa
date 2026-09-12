// Reads a CSS custom property from `<html>` so imperative canvases (map
// marker icons, user location) can pick up the current colour scheme's
// token. Returns null when the property has not resolved yet; consumers
// render nothing until it has.

export function readCssVar(name: string): string | null {
  if (typeof window === "undefined" || typeof getComputedStyle !== "function") return null;
  try {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value === "" ? null : value;
  } catch {
    return null;
  }
}
