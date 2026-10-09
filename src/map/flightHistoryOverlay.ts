// docs/site.md section 8.5. Flight history overlay: a solid `Polyline`, a
// second `Polyline` of arrow symbols, and time-label markers at fixed
// elapsed intervals. Arrow step and label interval tables are pure and
// unit-tested. The points come from `snapshot.event.flightHistory.points`
// (route order, already thinned by the API). Below NAME_MIN_ZOOM a time
// label collapses to a dot marker titled with the label text (the native
// tooltip on hover); a click shows the full label for TIME_LABEL_PEEK_MS,
// then the dot again.

import { NAME_MIN_ZOOM } from "./viewpointsOverlay";
import type { MapTheme } from "./themes";

// How long a clicked time dot shows its full label.
export const TIME_LABEL_PEEK_MS = 2500;

export type HistoryPoint = { lat: number; lng: number; recordedAt?: string | null };

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

export function timeLabelsCollapsedForZoom(zoom: number): boolean {
  return zoom < NAME_MIN_ZOOM;
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
  points: HistoryPoint[],
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
    `<rect x="0.5" y="0.5" width="${width - 1}" height="23" rx="6" ry="6" fill="${theme.overlay.timeLabelBg}" fill-opacity="${theme.overlay.timeLabelOpacity}" stroke="${theme.overlay.timeLabelFg}" stroke-opacity="0.4"/>` +
    `<circle cx="12" cy="12" r="4" fill="${theme.overlay.routeColor}"/>` +
    `<text x="22" y="16" fill="${theme.overlay.timeLabelFg}" font-family="system-ui, sans-serif" font-size="12">${text}</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function timeDotSvgDataUri(theme: MapTheme): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12">` +
    `<circle cx="6" cy="6" r="5.5" fill="${theme.overlay.routeColor}" stroke="${theme.overlay.timeLabelFg}" stroke-opacity="0.4"/>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export type FlightHistoryOverlay = {
  redraw(theme: MapTheme, zoom: number, opts: { flightHistory: boolean; timeLabels: boolean }): void;
  destroy(): void;
};

export function createFlightHistoryOverlay(
  libs: { maps: google.maps.MapsLibrary; marker: google.maps.MarkerLibrary },
  map: google.maps.Map,
  points: HistoryPoint[] | null,
): FlightHistoryOverlay {
  let line: google.maps.Polyline | null = null;
  let arrows: google.maps.Polyline | null = null;
  let labels: google.maps.Marker[] = [];
  const timers = new Map<google.maps.Marker, ReturnType<typeof setTimeout>>();

  function clear() {
    for (const t of timers.values()) clearTimeout(t);
    timers.clear();
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
      if (!opts.flightHistory || points === null) return;
      const filtered = points.filter(
        (p): p is HistoryPoint =>
          typeof p.lat === "number" && typeof p.lng === "number",
      );
      if (filtered.length < 2) return;
      const path = filtered.map((p) => ({ lat: p.lat, lng: p.lng }));

      line = new libs.maps.Polyline({
        path,
        map,
        geodesic: true,
        strokeColor: theme.overlay.routeColor,
        strokeOpacity: theme.overlay.routeOpacity,
        strokeWeight: 2,
      });

      const step = arrowStepForZoom(zoom);
      const scale = arrowScaleForZoom(zoom);
      const arrowIcons: google.maps.IconSequence[] = [];
      for (let i = step; i < filtered.length; i += step) {
        arrowIcons.push({
          icon: {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale,
            strokeColor: theme.overlay.arrowColor,
            fillColor: theme.overlay.arrowColor,
            fillOpacity: 1,
          },
          offset: `${(i / filtered.length) * 100}%`,
        });
      }
      arrows = new libs.maps.Polyline({
        path,
        map,
        geodesic: true,
        strokeOpacity: 0,
        icons: arrowIcons,
      });

      if (opts.timeLabels) {
        const intervalMin = labelIntervalMinutesForZoom(zoom);
        const labelPts = pickLabelPoints(filtered, intervalMin);
        const collapsed = timeLabelsCollapsedForZoom(zoom);
        const dotUrl = collapsed ? timeDotSvgDataUri(theme) : "";
        for (const l of labelPts) {
          const url = timeLabelSvgDataUri(l.labelText, theme);
          const full = { url, anchor: new google.maps.Point(0, 12) };
          if (!collapsed) {
            const marker = new libs.marker.Marker({
              position: { lat: l.lat, lng: l.lng },
              map,
              icon: full,
              title: l.labelText,
              clickable: false,
            });
            labels.push(marker);
            continue;
          }
          const dot = { url: dotUrl, anchor: new google.maps.Point(6, 6) };
          const marker = new libs.marker.Marker({
            position: { lat: l.lat, lng: l.lng },
            map,
            icon: dot,
            title: l.labelText,
            clickable: true,
          });
          marker.addListener("click", () => {
            clearTimeout(timers.get(marker));
            marker.setIcon(full);
            timers.set(
              marker,
              setTimeout(() => {
                timers.delete(marker);
                marker.setIcon(dot);
              }, TIME_LABEL_PEEK_MS),
            );
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
