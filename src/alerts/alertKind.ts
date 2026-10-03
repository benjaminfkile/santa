// docs/site.md section 13.1. The label of an alert's kind: an
// "event_message" alert reads as an update, every other kind (the
// contract's "event_status" among them) as a status.

import { copy } from "../copy/copy";

export function alertKindLabel(kind: string | null | undefined): string {
  return kind === "event_message" ? copy.alerts.kindUpdate : copy.alerts.kindStatus;
}
