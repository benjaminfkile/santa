// docs/site.md section 8.9. The route map's inputs. The event's
// `routeMapConfig` in the snapshot gives the display and the controls;
// the site settings give the viewpoints and the places. Each value
// resolves on its own: the config's value, else the default. A null or
// absent config, block, or key reads as absent, and so does a value
// outside its contract set.
//  - `display`: the five display values, defaulting to labels every 15
//    minutes, arrows on, medium arrows, normal width, and medium labels.
//    The named sizes become the style's scales through DISPLAY_SCALES.
//  - `controls`: the fullscreen and terrain switches, each true unless
//    the config says false.
//  - resolveViewpoints: the site settings' `viewpoints` entries with a name
//    and numeric coordinates, each with its icon when it is a well formed
//    reference and its description when it is a string; absent without
//    a list.
//  - resolvePlaces: the site settings' `places`, one string kind list per
//    map (`tracker` and `routeMap`), each absent unless that part is an
//    object whose `kinds` is a list.

import type { IconRef, Snapshot } from "../../../contracts";
import type { ViewpointData } from "./RouteViewpoints";

export type RouteMapConfig = NonNullable<NonNullable<Snapshot["event"]>["routeMapConfig"]>;

type ArrowSize = "small" | "medium" | "large" | "xlarge";
type RouteWidth = "thin" | "normal" | "thick" | "xthick";
type LabelSize = "small" | "medium" | "large";
type TimeLabelInterval = 0 | 5 | 10 | 15 | 30;

export const DISPLAY_SCALES: {
  arrowSize: Readonly<Record<ArrowSize, number>>;
  routeWidth: Readonly<Record<RouteWidth, number>>;
  labelSize: Readonly<Record<LabelSize, number>>;
} = {
  arrowSize: { small: 0.75, medium: 1, large: 1.5, xlarge: 2 },
  routeWidth: { thin: 0.75, normal: 1, thick: 1.5, xthick: 2 },
  labelSize: { small: 0.8, medium: 1, large: 1.3 },
};

export const DISPLAY_DEFAULTS: {
  timeLabelIntervalMinutes: TimeLabelInterval;
  arrows: boolean;
  arrowSize: ArrowSize;
  routeWidth: RouteWidth;
  labelSize: LabelSize;
} = {
  timeLabelIntervalMinutes: 15,
  arrows: true,
  arrowSize: "medium",
  routeWidth: "normal",
  labelSize: "medium",
};

const INTERVALS: readonly number[] = [0, 5, 10, 15, 30];

export type ResolvedRouteMapDisplay = {
  timeLabelIntervalMinutes: TimeLabelInterval;
  arrows: boolean;
  arrowScale: number;
  routeWidthScale: number;
  labelScale: number;
};

export type ResolvedRouteMapConfig = {
  display: ResolvedRouteMapDisplay;
  controls: { fullscreen: boolean; terrain: boolean };
};

export type ResolvedPlaces = {
  tracker: string[] | undefined;
  routeMap: string[] | undefined;
};

function isInterval(v: unknown): v is TimeLabelInterval {
  return typeof v === "number" && INTERVALS.includes(v);
}

function isArrowSize(v: unknown): v is ArrowSize {
  return typeof v === "string" && Object.hasOwn(DISPLAY_SCALES.arrowSize, v);
}

function isRouteWidth(v: unknown): v is RouteWidth {
  return typeof v === "string" && Object.hasOwn(DISPLAY_SCALES.routeWidth, v);
}

function isLabelSize(v: unknown): v is LabelSize {
  return typeof v === "string" && Object.hasOwn(DISPLAY_SCALES.labelSize, v);
}

function isCoordinate(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function asIcon(v: unknown): IconRef | null {
  if (v === null || typeof v !== "object") return null;
  const icon = v as { source?: unknown; id?: unknown };
  if ((icon.source !== "library" && icon.source !== "media") || typeof icon.id !== "string") return null;
  return v as IconRef;
}

export function resolveViewpoints(list: unknown): ViewpointData[] | undefined {
  if (!Array.isArray(list)) return undefined;
  const out: ViewpointData[] = [];
  for (const item of list as unknown[]) {
    if (item === null || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    const { name, lat, lng, description } = entry;
    if (typeof name !== "string" || name === "" || !isCoordinate(lat) || !isCoordinate(lng)) continue;
    const viewpoint: ViewpointData = { name, lat, lng };
    const icon = asIcon(entry.icon);
    if (icon !== null) viewpoint.icon = icon;
    if (typeof description === "string") viewpoint.description = description;
    out.push(viewpoint);
  }
  return out;
}

function placeKinds(part: unknown): string[] | undefined {
  if (part === null || typeof part !== "object") return undefined;
  const kinds = (part as { kinds?: unknown }).kinds;
  if (!Array.isArray(kinds)) return undefined;
  return (kinds as unknown[]).filter((k): k is string => typeof k === "string");
}

export function resolvePlaces(places: unknown): ResolvedPlaces {
  const p = places !== null && typeof places === "object" ? (places as Record<string, unknown>) : {};
  return { tracker: placeKinds(p.tracker), routeMap: placeKinds(p.routeMap) };
}

export function resolveRouteMapDisplay(display: RouteMapConfig["display"]): ResolvedRouteMapDisplay {
  const d = display ?? {};
  const arrowSize = isArrowSize(d.arrowSize) ? d.arrowSize : DISPLAY_DEFAULTS.arrowSize;
  const routeWidth = isRouteWidth(d.routeWidth) ? d.routeWidth : DISPLAY_DEFAULTS.routeWidth;
  const labelSize = isLabelSize(d.labelSize) ? d.labelSize : DISPLAY_DEFAULTS.labelSize;
  return {
    timeLabelIntervalMinutes: isInterval(d.timeLabelIntervalMinutes)
      ? d.timeLabelIntervalMinutes
      : DISPLAY_DEFAULTS.timeLabelIntervalMinutes,
    arrows: typeof d.arrows === "boolean" ? d.arrows : DISPLAY_DEFAULTS.arrows,
    arrowScale: DISPLAY_SCALES.arrowSize[arrowSize],
    routeWidthScale: DISPLAY_SCALES.routeWidth[routeWidth],
    labelScale: DISPLAY_SCALES.labelSize[labelSize],
  };
}

export function resolveRouteMapConfig(config: RouteMapConfig | null | undefined): ResolvedRouteMapConfig {
  return {
    display: resolveRouteMapDisplay(config?.display),
    controls: {
      fullscreen: config?.controls?.fullscreen !== false,
      terrain: config?.controls?.terrain !== false,
    },
  };
}
