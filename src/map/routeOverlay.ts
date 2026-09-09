// docs/site.md section 8.5. Route overlay: a solid `Polyline`, a second
// `Polyline` of arrow symbols, and time-label markers at fixed elapsed
// intervals. Arrow step and label interval tables are pure and unit-tested.

import type { Route } from "../contracts";
import type { MapTheme } from "./themes";

export type RoutePoint = { lat: number; lng: number; recordedAt?: string | null };

export function arrowStepForZoom(zoom: number): number {
  if (zoom >= 15) return 20;
  if (zoom >= 13) return 40;
  if (zoom >= 11) return 80;
  if (zoom >= 9) return 150;
  return 250;
}

export function arrowScaleForZoom(zoom: number): number {
  return zoom >= 9 ? 3 : 2;
}

export function labelIntervalMinutesForZoom(zoom: number): number {
  return zoom > 12 ? 5 : 20;
}

export function formatLabelText(minutes: number): string {
  const totalMinutes = Math.max(0, Math.floor(minutes));
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} hr`;
  return `${hours} hr ${mins} min`;
}

export type LabelPoint = {
  lat: number;
  lng: number;
  minutesElapsed: number;
  labelText: string;
};

export function pickLabelPoints(
  points: RoutePoint[],
  intervalMinutes: number,
): LabelPoint[] {
  if (points.length === 0 || intervalMinutes <= 0) return [];
  let baseMs: number | null = null;
  const out: LabelPoint[] = [];
  let nextIntervalMinutes = intervalMinutes;
  for (const p of points) {
    if (p.recordedAt === null || p.recordedAt === undefined || p.recordedAt === "") continue;
    const t = Date.parse(p.recordedAt);
    if (Number.isNaN(t)) continue;
    if (baseMs === null) {
      baseMs = t;
      continue;
    }
    const elapsedMin = (t - baseMs) / 60000;
    if (elapsedMin >= nextIntervalMinutes) {
      const marked = Math.floor(elapsedMin / intervalMinutes) * intervalMinutes;
      out.push({
        lat: p.lat,
        lng: p.lng,
        minutesElapsed: marked,
        labelText: formatLabelText(marked),
      });
      nextIntervalMinutes = marked + intervalMinutes;
    }
  }
  return out;
}

export function timeLabelSvgDataUri(text: string, theme: MapTheme): string {
  const width = 8 + text.length * 7 + 20;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="24" viewBox="0 0 ${width} 24">` +
    `<rect x="0.5" y="0.5" width="${width - 1}" height="23" rx="6" ry="6" fill="${theme.timeLabelBg}" fill-opacity="${theme.timeLabelOpacity}" stroke="${theme.timeLabelFg}" stroke-opacity="0.4"/>` +
    `<circle cx="12" cy="12" r="4" fill="${theme.routeColor}"/>` +
    `<text x="22" y="16" fill="${theme.timeLabelFg}" font-family="system-ui, sans-serif" font-size="12">${text}</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export type RouteOverlay = {
  redraw(theme: MapTheme, zoom: number, opts: { routeLines: boolean; timeLabels: boolean }): void;
  destroy(): void;
};

export function createRouteOverlay(
  libs: { maps: google.maps.MapsLibrary; marker: google.maps.MarkerLibrary },
  map: google.maps.Map,
  route: Route | null,
): RouteOverlay {
  let line: google.maps.Polyline | null = null;
  let arrows: google.maps.Polyline | null = null;
  let labels: google.maps.Marker[] = [];

  function clear() {
    line?.setMap(null);
    line = null;
    arrows?.setMap(null);
    arrows = null;
    for (const m of labels) m.setMap(null);
    labels = [];
  }

  return {
    redraw(theme, zoom, opts) {
      clear();
      const points = (route?.points ?? []).filter(
        (p): p is RoutePoint =>
          typeof p.lat === "number" && typeof p.lng === "number",
      );
      if (points.length < 2) return;
      const path = points.map((p) => ({ lat: p.lat, lng: p.lng }));

      if (opts.routeLines) {
        line = new libs.maps.Polyline({
          path,
          map,
          geodesic: true,
          strokeColor: theme.routeColor,
          strokeOpacity: theme.routeOpacity,
          strokeWeight: 2,
        });

        const step = arrowStepForZoom(zoom);
        const scale = arrowScaleForZoom(zoom);
        const arrowIcons: google.maps.IconSequence[] = [];
        for (let i = step; i < points.length; i += step) {
          arrowIcons.push({
            icon: {
              path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
              scale,
              strokeColor: theme.arrowColor,
              fillColor: theme.arrowColor,
              fillOpacity: 1,
            },
            offset: `${(i / points.length) * 100}%`,
          });
        }
        arrows = new libs.maps.Polyline({
          path,
          map,
          geodesic: true,
          strokeOpacity: 0,
          icons: arrowIcons,
        });
      }

      if (opts.timeLabels) {
        const intervalMin = labelIntervalMinutesForZoom(zoom);
        const labelPts = pickLabelPoints(points, intervalMin);
        for (const l of labelPts) {
          const url = timeLabelSvgDataUri(l.labelText, theme);
          const marker = new libs.marker.Marker({
            position: { lat: l.lat, lng: l.lng },
            map,
            icon: { url, anchor: new google.maps.Point(0, 12) },
            title: l.labelText,
            clickable: false,
          });
          labels.push(marker);
        }
      }
    },
    destroy() {
      clear();
    },
  };
}
