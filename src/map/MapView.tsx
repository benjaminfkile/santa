// docs/site.md sections 8.1 - 8.4 and 8.10. React host for the map
// element: on the `google` renderer it loads the Google Maps libraries and
// the starting theme's style body in parallel, builds the Google
// controller once both are in hand, and passes it to children through a
// render prop. A failure of either is a load failure. A load failure that
// outlasts the automatic retries is reported as a `map_error` with the
// source "load" and handed to the caller as `error` so it can render the
// "map unavailable" panel.
// On the `maplibre` renderer it loads the MapLibre controller through the
// caller's `maplibre.load` (the `tracker-maplibre` chunk, imported by the
// Map section) and the theme's body in parallel and builds that
// controller instead, never loading Google. A failed chunk, a failed body
// or MapLibre style, or a lost WebGL context tears the MapLibre map down
// and falls back once: `maplibre.onFallback` answers the Google theme, and
// the Google controller is built in the same container as above.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { reportMapError } from "../lib/analytics";
import { loadMaps } from "./loadMaps";
import { createMapController, type MapController, type MapControllerOptions } from "./mapController";
import type { MapsLibs } from "./loadMaps";
import type { MapTheme } from "./themes";
import type { FallbackReason, Renderer } from "./renderer";
import type { LatLng } from "./bounds";
import type { TrackerMap } from "../mapHost/themeStyle";

export type MaplibreModule = typeof import("../mapHost/maplibreController");
import * as styles from "./MapView.module.css";

// The controller's options without the style body, which MapView fetches;
// a null theme (the event enables no theme for this renderer) fails the load.
export type MapViewOptions = Omit<MapControllerOptions, "theme" | "style"> & {
  theme: MapTheme | null;
  renderer?: Renderer;
  maplibre?: {
    load: () => Promise<MaplibreModule>;
    trackerMap: TrackerMap;
    // The fix in hand when the map is built.
    fix: () => LatLng | null;
    // Called once when MapLibre fails; answers the Google theme to build.
    onFallback: (reason: FallbackReason) => MapTheme | null;
  };
};

export type MapViewProps = {
  options: MapViewOptions;
  onController?: (c: MapController | null) => void;
  onLibs?: (libs: MapsLibs) => void;
  className?: string;
  children?: (state: { controller: MapController | null; error: unknown | null; retry: () => void }) => ReactNode;
};

// A transient library-load failure (a network blip at the moment the live
// screen mounts) retries by itself before the error is surfaced. `retry`
// starts a fresh set of attempts.
const AUTO_RETRIES = 3;
const AUTO_RETRY_BASE_MS = 1000;

export function MapView({ options, onController, onLibs, className, children }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<MapController | null>(null);
  const [controller, setController] = useState<MapController | null>(null);
  const [error, setError] = useState<unknown | null>(null);
  const [attempt, setAttempt] = useState(0);
  const autoRetriesLeftRef = useRef(AUTO_RETRIES);
  // Set once MapLibre has failed: the Google theme the map falls back to.
  const fallbackRef = useRef<{ theme: MapTheme | null } | null>(null);

  const retry = useCallback(() => {
    autoRetriesLeftRef.current = AUTO_RETRIES;
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: number | undefined;
    const el = containerRef.current;
    if (el === null) return;
    const ml = options.maplibre;

    function adopt(c: MapController): void {
      controllerRef.current = c;
      autoRetriesLeftRef.current = AUTO_RETRIES;
      setController(c);
      onController?.(c);
    }

    function fallBack(reason: FallbackReason, error: unknown): void {
      if (cancelled || ml === undefined || fallbackRef.current !== null) return;
      console.warn("map: MapLibre failed, falling back to Google", error);
      const c = controllerRef.current;
      if (c !== null) {
        c.destroy();
        controllerRef.current = null;
        setController(null);
        onController?.(null);
      }
      fallbackRef.current = { theme: ml.onFallback(reason) };
      setAttempt((n) => n + 1);
    }

    async function buildMaplibre(load: NonNullable<typeof ml>, container: HTMLElement): Promise<void> {
      const theme = options.theme;
      if (theme === null) {
        fallBack("style_failed", new Error("The event has no map theme"));
        return;
      }
      const chunk = load.load();
      const body = theme.getStyle();
      body.catch(() => {});
      let mod: MaplibreModule;
      try {
        mod = await chunk;
      } catch (e) {
        fallBack("chunk_failed", e);
        return;
      }
      let style: Awaited<typeof body>;
      try {
        style = await body;
      } catch (e) {
        fallBack("style_failed", e);
        return;
      }
      if (cancelled) return;
      try {
        adopt(
          mod.createMaplibreController(container, {
            ...options,
            theme,
            style,
            trackerMap: load.trackerMap,
            fix: load.fix(),
            onFail: (reason, error) => fallBack(reason, error),
          }),
        );
      } catch (e) {
        fallBack("style_failed", e);
      }
    }

    (async () => {
      if (options.renderer === "maplibre" && ml !== undefined && fallbackRef.current === null) {
        await buildMaplibre(ml, el);
        return;
      }
      try {
        const theme = fallbackRef.current !== null ? fallbackRef.current.theme : options.theme;
        if (theme === null) throw new Error("The event has no map theme");
        const [libs, style] = await Promise.all([loadMaps(), theme.getStyle()]);
        if (cancelled) return;
        onLibs?.(libs);
        adopt(createMapController(libs, el, { ...options, theme, style }));
      } catch (e) {
        if (cancelled) return;
        if (autoRetriesLeftRef.current > 0) {
          const backoff =
            AUTO_RETRY_BASE_MS * 2 ** (AUTO_RETRIES - autoRetriesLeftRef.current);
          autoRetriesLeftRef.current -= 1;
          retryTimer = window.setTimeout(() => setAttempt((n) => n + 1), backoff);
        } else {
          reportMapError("load", e);
          setError(e);
        }
      }
    })();
    return () => {
      cancelled = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      const c = controllerRef.current;
      if (c !== null) {
        c.destroy();
        controllerRef.current = null;
      }
      setController(null);
      onController?.(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  return (
    <div className={className ?? styles.mapView}>
      <div
        ref={containerRef}
        className={styles.mapViewCanvas}
        data-map-canvas=""
        style={{ position: "absolute", inset: 0 }}
        aria-label="Santa tracker map"
        role="region"
      />
      {children?.({ controller, error, retry })}
    </div>
  );
}
