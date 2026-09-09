// docs/site.md section 7.4. RoutePreview: `svg`: the points as a normalized
// SVG path, no Maps load; `map`: the route viewer of section 8 with
// `fitRoute()` and no Santa marker; `emptyText` when `route` is null.

import { Suspense, lazy, useMemo } from "react";
import type { SectionComponent } from "../../registry";
import type { Route } from "../../../contracts";
import { Inline } from "../../inline/Inline";
import { useSnapshotEvent } from "../../blocks/useSnapshotEvent";
import { useStore } from "../../../store/useStore";

const LazyRoutePreviewMap = lazy(() =>
  import("./RoutePreviewMap").then((mod) => ({ default: mod.RoutePreviewMap })),
);

type RoutePreviewData = {
  heading?: string | null;
  style?: "svg" | "map";
  emptyText?: string | null;
};

const SVG_WIDTH = 1200;
const SVG_HEIGHT = 300;
const PADDING = 20;

type Point = { x: number; y: number };

function normalizePoints(route: Route): Point[] {
  const points = (route.points ?? []).filter(
    (p) => typeof p.lat === "number" && typeof p.lng === "number",
  ) as { lat: number; lng: number }[];
  if (points.length === 0) return [];
  let minLat = points[0].lat;
  let maxLat = points[0].lat;
  let minLng = points[0].lng;
  let maxLng = points[0].lng;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }
  const rangeLng = maxLng - minLng || 1;
  const rangeLat = maxLat - minLat || 1;
  const w = SVG_WIDTH - PADDING * 2;
  const h = SVG_HEIGHT - PADDING * 2;
  return points.map((p) => ({
    x: PADDING + ((p.lng - minLng) / rangeLng) * w,
    y: PADDING + (1 - (p.lat - minLat) / rangeLat) * h,
  }));
}

function pointsToPath(points: Point[]): string {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  const move = `M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`;
  const segments = rest.map((p) => `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`);
  return [move, ...segments].join(" ");
}

export const RoutePreview: SectionComponent = ({ data, bundle }) => {
  const d = (data ?? {}) as RoutePreviewData;
  const style = d.style ?? "svg";
  const emptyText = d.emptyText ?? null;
  const route = useStore((s) => s.route);
  const event = useSnapshotEvent();

  const path = useMemo(() => (route ? pointsToPath(normalizePoints(route)) : ""), [route]);

  if (route === null || path === "") {
    if (emptyText) {
      return (
        <div className="route-preview route-preview--empty">
          {d.heading ? (
            <h2 className="route-preview__heading">
              <Inline text={d.heading} bundle={bundle} event={event} />
            </h2>
          ) : null}
          <p className="route-preview__empty-text">
            <Inline text={emptyText} bundle={bundle} event={event} />
          </p>
        </div>
      );
    }
    return null;
  }

  return (
    <div className={`route-preview route-preview--${style}`}>
      {d.heading ? (
        <h2 className="route-preview__heading">
          <Inline text={d.heading} bundle={bundle} event={event} />
        </h2>
      ) : null}
      {style === "map" ? (
        <div
          className="route-preview__map-wrapper"
          data-style="map"
          data-testid="route-preview-map"
        >
          <Suspense fallback={<div className="route-preview__map-loading" aria-busy />}>
            <LazyRoutePreviewMap />
          </Suspense>
        </div>
      ) : (
        <svg
          className="route-preview__svg"
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={route.name ?? "Route preview"}
        >
          <path
            d={path}
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            data-testid="route-polyline"
          />
        </svg>
      )}
    </div>
  );
};

