// docs/site.md section 4 and contracts.md 4.3. The scan beacon for the
// printed-code route: a keepalive fetch with credentials omitted, so the
// request survives the navigation that follows it and its preflight passes
// the wildcard origin the edge answers with (a credentialed beacon, which is
// what navigator.sendBeacon sends, cannot). The API answers 204 whether or
// not the tag exists (contracts 4.3 Public), so we never read the response.

import { env } from "../config/env";

export function sendScanBeacon(tag: string, referrer: string): void {
  const url = `${env.API_BASE_URL}/qr-codes/${encodeURIComponent(tag)}/scans`;
  const body = JSON.stringify({ referrer });
  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
    credentials: "omit",
  }).catch(() => {});
}
