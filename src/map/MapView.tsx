// docs/site.md sections 8.1 - 8.3. React host for the map element: loads
// the Google Maps libraries, builds the controller, and passes it to
// children through a render prop. A load failure hands the caller an
// `error` so it can render the "map unavailable" panel.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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

export function MapView({ options, onController, onLibs, className, children }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<MapController | null>(null);
  const [controller, setController] = useState<MapController | null>(null);
  const [error, setError] = useState<unknown | null>(null);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
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
          setController(c);
          onController?.(c);
        } else {
          c.destroy();
        }
      } catch (e) {
        if (!cancelled) setError(e);
      }
    })();
    return () => {
      cancelled = true;
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
    <div className={className ?? styles.mapView} style={{ position: "relative", width: "100%", height: "100%" }}>
      <div
        ref={containerRef}
        className={styles.mapViewCanvas}
        style={{ position: "absolute", inset: 0 }}
        aria-label="Santa tracker map"
        role="region"
      />
      {children?.({ controller, error, retry })}
    </div>
  );
}
