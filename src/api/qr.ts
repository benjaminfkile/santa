// docs/site.md section 4 and contracts.md 4.3. The scan beacon for the
// printed-code route. Uses navigator.sendBeacon when available; falls back
// to fetch with keepalive so the request survives the navigation that
// follows it. The API answers 204 whether or not the tag exists (contracts
// 4.3 Public), so we never read the response.

import { env } from "../config/env";

export function sendScanBeacon(tag: string, referrer: string): void {
  const url = `${env.API_BASE_URL}/qr-codes/${encodeURIComponent(tag)}/scans`;
  const body = JSON.stringify({ referrer });
  const nav = typeof navigator === "undefined" ? null : navigator;
  if (nav !== null && typeof nav.sendBeacon === "function") {
    const blob = new Blob([body], { type: "application/json" });
    nav.sendBeacon(url, blob);
    return;
  }
  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
    credentials: "omit",
  }).catch(() => {});
}
