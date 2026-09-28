// docs/site.md section 8.9. The entries of `event.routeMap.timeline` with
// numeric minutes and coordinates, in minute order, and the time label of
// one entry: the wall time `scheduledAt` plus the entry's minutes in the
// viewer's timezone (formatted as every event time is), or the elapsed
// time as +h:mm when the event has no `scheduledAt`.

import type { Snapshot } from "../../../contracts";
import { formatEventTime } from "../../../lib/time";

export type TimelineEntry = { minutes: number; lat: number; lng: number };

type RouteMapData = NonNullable<NonNullable<Snapshot["event"]>["routeMap"]>;

function finite(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

export function routeMapTimeline(routeMap: RouteMapData | null | undefined): TimelineEntry[] {
  const out: TimelineEntry[] = [];
  for (const e of routeMap?.timeline ?? []) {
    if (finite(e.minutes) && finite(e.lat) && finite(e.lng)) {
      out.push({ minutes: e.minutes, lat: e.lat, lng: e.lng });
    }
  }
  return out.sort((a, b) => a.minutes - b.minutes);
}

export function formatOffset(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return `+${hours}:${rest < 10 ? `0${rest}` : rest}`;
}

export function routeTimeLabel(
  scheduledAt: string | null | undefined,
  minutes: number,
  timeZone?: string,
): string {
  const start = scheduledAt ? Date.parse(scheduledAt) : Number.NaN;
  if (Number.isNaN(start)) return formatOffset(minutes);
  return formatEventTime(new Date(start + minutes * 60_000).toISOString(), timeZone);
}
