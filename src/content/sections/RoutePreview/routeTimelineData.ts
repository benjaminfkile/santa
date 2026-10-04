// docs/site.md section 8.9. The entries of `event.routeMap.timeline` with
// numeric minutes and coordinates, in minute order; the elapsed flight
// time of a minute count in the "1h 15m" form (minutes only under an
// hour, hours plus minutes from one hour, no padding); and the map's
// time labels, one at every interior multiple of the interval
// (TIME_LABEL_EVERY minutes unless given; never minute 0 and never the
// final entry, where the start and end markers stand). An interval of 0
// gives no labels.

import type { Snapshot } from "../../../contracts";

export type TimelineEntry = { minutes: number; lat: number; lng: number };

export type TimelineLabel = { lat: number; lng: number; label: string };

export const TIME_LABEL_EVERY = 15;

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

export function formatElapsed(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return hours === 0 ? `${rest}m` : `${hours}h ${rest}m`;
}

export function routeTimeLabels(
  timeline: readonly TimelineEntry[],
  every: number = TIME_LABEL_EVERY,
): TimelineLabel[] {
  const out: TimelineLabel[] = [];
  if (!(every > 0)) return out;
  for (let i = 1; i < timeline.length - 1; i++) {
    const { minutes, lat, lng } = timeline[i];
    if (minutes > 0 && minutes % every === 0) {
      out.push({ lat, lng, label: formatElapsed(minutes) });
    }
  }
  return out;
}
