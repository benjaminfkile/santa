// docs/site.md section 7.5. Resolve {event:*} placeholders from the current
// snapshot. Times are formatted in the viewer's timezone; the optional
// `timeZone` argument overrides it for tests.

import type { Snapshot } from "../../contracts";

type EventFields = NonNullable<Snapshot["event"]>;
type PlaceholderField = "name" | "year" | "scheduledAt";

function formatScheduledAt(date: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

export function resolvePlaceholder(
  event: EventFields | null | undefined,
  field: PlaceholderField,
  timeZone?: string,
): string {
  if (!event) return "";
  if (field === "name") return event.name ?? "";
  if (field === "year") return event.year !== undefined && event.year !== null ? String(event.year) : "";
  const scheduledAt = event.scheduledAt ?? null;
  if (scheduledAt === null || scheduledAt === "") return "";
  const d = new Date(scheduledAt);
  if (Number.isNaN(d.getTime())) return "";
  return formatScheduledAt(d, timeZone);
}
