// docs/site.md section 4. The returnTo query parameter is a site path.
// Anything that isn't a same-origin path is treated as "/".

export function readReturnTo(search: URLSearchParams): string {
  const raw = search.get("returnTo") ?? "";
  if (raw === "") return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

export function withReturnTo(base: string, returnTo: string): string {
  if (returnTo === "" || returnTo === "/") return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}returnTo=${encodeURIComponent(returnTo)}`;
}
