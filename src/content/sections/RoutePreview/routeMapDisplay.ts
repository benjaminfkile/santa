// docs/site.md section 8.9. The route map's four display values, each
// resolved on its own: the section's `display`, else the site settings'
// `routeMap` block, else the default (labels every 15 minutes, arrows
// on, medium arrows, normal width). A value outside its contract set
// reads as absent at that level. The named sizes become the style's
// scales through DISPLAY_SCALES.

import type { RouteMapDisplay, SiteSettings } from "../../../contracts";

type ArrowSize = NonNullable<RouteMapDisplay["arrowSize"]>;
type RouteWidth = NonNullable<RouteMapDisplay["routeWidth"]>;
type TimeLabelInterval = NonNullable<RouteMapDisplay["timeLabelIntervalMinutes"]>;

export const DISPLAY_SCALES: {
  arrowSize: Readonly<Record<ArrowSize, number>>;
  routeWidth: Readonly<Record<RouteWidth, number>>;
} = {
  arrowSize: { small: 0.75, medium: 1, large: 1.5, xlarge: 2 },
  routeWidth: { thin: 0.75, normal: 1, thick: 1.5, xthick: 2 },
};

export const DISPLAY_DEFAULTS: Required<RouteMapDisplay> = {
  timeLabelIntervalMinutes: 15,
  arrows: true,
  arrowSize: "medium",
  routeWidth: "normal",
};

const INTERVALS: readonly number[] = [0, 5, 10, 15, 30];

export type ResolvedRouteMapDisplay = {
  timeLabelIntervalMinutes: TimeLabelInterval;
  arrows: boolean;
  arrowScale: number;
  routeWidthScale: number;
};

type Level = Partial<Record<keyof RouteMapDisplay, unknown>> | null | undefined;

function pick<T>(levels: readonly Level[], key: keyof RouteMapDisplay, valid: (v: unknown) => v is T, fallback: T): T {
  for (const level of levels) {
    const value = level?.[key];
    if (valid(value)) return value;
  }
  return fallback;
}

function isInterval(v: unknown): v is TimeLabelInterval {
  return typeof v === "number" && INTERVALS.includes(v);
}

function isBoolean(v: unknown): v is boolean {
  return typeof v === "boolean";
}

function isArrowSize(v: unknown): v is ArrowSize {
  return typeof v === "string" && Object.hasOwn(DISPLAY_SCALES.arrowSize, v);
}

function isRouteWidth(v: unknown): v is RouteWidth {
  return typeof v === "string" && Object.hasOwn(DISPLAY_SCALES.routeWidth, v);
}

export function resolveRouteMapDisplay(
  section: RouteMapDisplay | null | undefined,
  settings: SiteSettings | null | undefined,
): ResolvedRouteMapDisplay {
  const levels: readonly Level[] = [section, settings?.routeMap];
  const arrowSize = pick(levels, "arrowSize", isArrowSize, DISPLAY_DEFAULTS.arrowSize);
  const routeWidth = pick(levels, "routeWidth", isRouteWidth, DISPLAY_DEFAULTS.routeWidth);
  return {
    timeLabelIntervalMinutes: pick(
      levels,
      "timeLabelIntervalMinutes",
      isInterval,
      DISPLAY_DEFAULTS.timeLabelIntervalMinutes,
    ),
    arrows: pick(levels, "arrows", isBoolean, DISPLAY_DEFAULTS.arrows),
    arrowScale: DISPLAY_SCALES.arrowSize[arrowSize],
    routeWidthScale: DISPLAY_SCALES.routeWidth[routeWidth],
  };
}
