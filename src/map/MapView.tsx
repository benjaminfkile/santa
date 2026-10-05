// docs/site.md sections 8.1 - 8.3. React host for the map element: loads
// the Google Maps libraries, builds the controller, and passes it to
// children through a render prop. A load failure that outlasts the
// automatic retries is reported as a `map_error` with the source "load"
// and handed to the caller as `error` so it can render the "map
// unavailable" panel.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { reportMapError } from "../lib/analytics";
import { loadMaps } from "./loadMaps";
import { createMapController, type MapController, type MapControllerOptions } from "./mapController";
import type { MapsLibs } from "./loadMaps";
import * as styles from "./MapView.module.css";

export type MapViewProps = {
  options: MapControllerOptions;
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
    (async () => {
      try {
        const libs = await loadMaps();
        if (cancelled) return;
        onLibs?.(libs);
        const c = createMapController(libs, el, options);
        controllerRef.current = c;
        if (!cancelled) {
          autoRetriesLeftRef.current = AUTO_RETRIES;
          setController(c);
          onController?.(c);
        } else {
          c.destroy();
        }
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
