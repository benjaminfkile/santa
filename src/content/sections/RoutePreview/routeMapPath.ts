// docs/site.md section 8.9. The points of `event.routeMap.path` with
// numeric coordinates, in order.

import type { Snapshot } from "../../../contracts";

export type LatLng = { lat: number; lng: number };

type RouteMapData = NonNullable<NonNullable<Snapshot["event"]>["routeMap"]>;

export function routeMapPath(routeMap: RouteMapData | null | undefined): LatLng[] {
  const out: LatLng[] = [];
  for (const p of routeMap?.path ?? []) {
    if (typeof p.lat === "number" && typeof p.lng === "number" && Number.isFinite(p.lat) && Number.isFinite(p.lng)) {
      out.push({ lat: p.lat, lng: p.lng });
    }
  }
  return out;
}
