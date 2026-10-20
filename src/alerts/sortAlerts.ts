// docs/site.md sections 7.7 and 13.1. The snapshot's alerts newest first:
// by `createdAt`, then by id.

import type { SnapshotAlert } from "../contracts";

export function sortAlerts(alerts: SnapshotAlert[]): SnapshotAlert[] {
  const list = alerts.slice();
  list.sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    return b.id - a.id;
  });
  return list;
}
