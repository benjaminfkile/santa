// docs/site.md section 8.9. The `map` style's map host, in the `routemap`
// chunk with MapLibre: mounts the route map into its host and passes it
// the site appearance (`<html data-theme>`) whenever that changes, so
// light, dark, and system switch the map style live. Any failure (the
// archive, the style, WebGL) is logged once and reported through
// `onFail`, which hands the section back to the image rendering. The map
// is destroyed on unmount. `marks` are drawn as dots on the path; `pin`
// stands the Santa pin (the caller's `pinElement`) on a point, placed at
// once on mount and eased to each new point after, except when
// `reducedMotion` is set, where it moves at once. The caller renders the
// pin and reads the motion preference, so this chunk imports neither
// react-dom nor the icon and motion modules.

import { useEffect, useRef, useSyncExternalStore } from "react";
import { getResolved, subscribeScheme } from "../content/theme/colorScheme";
import { mountRouteMap, type Appearance, type LatLng, type RouteMapHandle } from "./index";
import * as styles from "./RouteMap.module.css";

function useAppearance(): Appearance {
  return useSyncExternalStore(subscribeScheme, getResolved, () => "light");
}

const NO_MARKS: readonly LatLng[] = [];

export type RouteMapProps = {
  path: readonly LatLng[];
  marks?: readonly LatLng[];
  pin?: LatLng | null;
  pinElement?: HTMLElement;
  reducedMotion?: boolean;
  ariaLabel?: string;
  onFail: () => void;
};

export function RouteMap({
  path,
  marks = NO_MARKS,
  pin = null,
  pinElement,
  reducedMotion = false,
  ariaLabel,
  onFail,
}: RouteMapProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<RouteMapHandle | null>(null);
  const appearance = useAppearance();
  const latest = useRef({ path, marks, pin, pinElement, appearance, reducedMotion, onFail });

  useEffect(() => {
    latest.current = { path, marks, pin, pinElement, appearance, reducedMotion, onFail };
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
      marks: latest.current.marks,
      appearance: latest.current.appearance,
      pinElement: latest.current.pinElement,
      onError: fail,
    })
      .then((handle) => {
        if (cancelled) {
          handle.destroy();
          return;
        }
        handleRef.current = handle;
        const now = latest.current;
        handle.update({ path: now.path, marks: now.marks, appearance: now.appearance });
        handle.setPin(now.pin, false);
      })
      .catch(fail);
    return () => {
      cancelled = true;
      handleRef.current?.destroy();
      handleRef.current = null;
    };
  }, []);

  useEffect(() => {
    handleRef.current?.update({ path, marks, appearance });
  }, [path, marks, appearance]);

  const pinLat = pin?.lat ?? null;
  const pinLng = pin?.lng ?? null;
  useEffect(() => {
    const point = pinLat === null || pinLng === null ? null : { lat: pinLat, lng: pinLng };
    handleRef.current?.setPin(point, !latest.current.reducedMotion);
  }, [pinLat, pinLng]);

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
