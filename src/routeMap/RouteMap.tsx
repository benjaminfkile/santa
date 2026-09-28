// docs/site.md section 8.9. The `map` style's map host, in the `routemap`
// chunk with MapLibre: mounts the route map into its host and passes it
// the site appearance (`<html data-theme>`) whenever that changes, so
// light, dark, and system switch the map style live. Any failure (the
// archive, the style, WebGL) is logged once and reported through
// `onFail`, which hands the section back to the image rendering. The map
// is destroyed on unmount.

import { useEffect, useRef, useSyncExternalStore } from "react";
import { getResolved, subscribeScheme } from "../content/theme/colorScheme";
import { mountRouteMap, type Appearance, type LatLng, type RouteMapHandle } from "./index";
import * as styles from "./RouteMap.module.css";

function useAppearance(): Appearance {
  return useSyncExternalStore(subscribeScheme, getResolved, () => "light");
}

export type RouteMapProps = {
  path: readonly LatLng[];
  ariaLabel?: string;
  onFail: () => void;
};

export function RouteMap({ path, ariaLabel, onFail }: RouteMapProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<RouteMapHandle | null>(null);
  const appearance = useAppearance();
  const latest = useRef({ path, appearance, onFail });

  useEffect(() => {
    latest.current = { path, appearance, onFail };
  });

  useEffect(() => {
    const host = hostRef.current;
    if (host === null) return;
    let cancelled = false;
    let reported = false;
    function fail(error: unknown): void {
      if (cancelled || reported) return;
      reported = true;
      console.warn("route map: falling back to the poster", error);
      latest.current.onFail();
    }
    mountRouteMap({
      container: host,
      path: latest.current.path,
      appearance: latest.current.appearance,
      onError: fail,
    })
      .then((handle) => {
        if (cancelled) {
          handle.destroy();
          return;
        }
        handleRef.current = handle;
        handle.update({ path: latest.current.path, appearance: latest.current.appearance });
      })
      .catch(fail);
    return () => {
      cancelled = true;
      handleRef.current?.destroy();
      handleRef.current = null;
    };
  }, []);

  useEffect(() => {
    handleRef.current?.update({ path, appearance });
  }, [path, appearance]);

  return (
    <div
      ref={hostRef}
      className={styles.routeMapHost}
      role="region"
      aria-label={ariaLabel}
      data-testid="route-map"
      data-appearance={appearance}
    />
  );
}
