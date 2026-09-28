// docs/site.md section 8.9. The route map's fullscreen state over the
// element that wraps the map frame and the slider. `toggle` enters
// through the Fullscreen API where it is available and through the
// takeover (the same element fixed over the viewport, see
// `.routeMapStageTakeover`) where it is not or where the request is
// refused, and leaves whichever is up. Escape leaves both. While the
// takeover is up the body does not scroll. The mode is "api" only while
// the document's fullscreen element is the wrapper, so leaving through
// the browser's own controls turns it off too.

import { useCallback, useEffect, useState, type RefObject } from "react";
import {
  FULLSCREEN_EVENTS,
  currentFullscreenElement,
  exitFullscreenNow,
  fullscreenSupported,
  requestFullscreenOn,
} from "../../../lib/fullscreen";

export type RouteMapFullscreenMode = "off" | "api" | "takeover";

export type RouteMapFullscreen = {
  mode: RouteMapFullscreenMode;
  toggle: () => void;
};

export function useRouteMapFullscreen(ref: RefObject<HTMLElement | null>): RouteMapFullscreen {
  const [mode, setMode] = useState<RouteMapFullscreenMode>("off");

  useEffect(() => {
    function onChange(): void {
      const el = ref.current;
      const inside = el !== null && currentFullscreenElement() === el;
      setMode((m) => (inside ? "api" : m === "api" ? "off" : m));
    }
    for (const name of FULLSCREEN_EVENTS) document.addEventListener(name, onChange);
    return () => {
      for (const name of FULLSCREEN_EVENTS) document.removeEventListener(name, onChange);
    };
  }, [ref]);

  // Leaving "api" (the button, Escape, or an unmount) exits the document's
  // fullscreen when the wrapper still holds it.
  useEffect(() => {
    if (mode !== "api") return;
    const el = ref.current;
    return () => {
      if (el !== null && currentFullscreenElement() === el) exitFullscreenNow();
    };
  }, [mode, ref]);

  const exit = useCallback((): void => setMode("off"), []);

  const toggle = useCallback((): void => {
    const el = ref.current;
    if (el === null) return;
    if (mode !== "off") {
      exit();
      return;
    }
    if (!fullscreenSupported()) {
      setMode("takeover");
      return;
    }
    void requestFullscreenOn(el).then((entered) => {
      if (!entered) setMode("takeover");
    });
  }, [ref, mode, exit]);

  useEffect(() => {
    if (mode === "off") return;
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key !== "Escape") return;
      event.preventDefault();
      exit();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mode, exit]);

  useEffect(() => {
    if (mode !== "takeover") return;
    const body = document.body;
    const previous = body.style.overflow;
    body.style.overflow = "hidden";
    return () => {
      body.style.overflow = previous;
    };
  }, [mode]);

  return { mode, toggle };
}
