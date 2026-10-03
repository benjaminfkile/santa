// docs/site.md section 7.7, Alerts bell. An alert's id as a number; the
// API sends int64 ids as a number or a string.

import type { AlertItem } from "../api/subscriptions";

export function alertId(row: AlertItem): number {
  const v = row.id;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}
