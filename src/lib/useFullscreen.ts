// docs/site.md sections 8.5 and 8.9. Fullscreen state over one element.
// `toggle` enters through the Fullscreen API where `fullscreenSupported`
// says the element takes it, and through the takeover (the element
// rendered by `TakeoverPortal` fixed over the viewport under
// document.body) everywhere else. The mode is "api" only while the
// document's fullscreen element is the element, read from the
// fullscreenchange events alone, so leaving through the browser's own
// controls turns it off too. A request that rejects, or that brings no
// fullscreenchange within FULLSCREEN_CONFIRM_MS, falls back to the
// takeover. The same `toggle` leaves whichever is up, Escape leaves both
// unless something inside already handled it, and a route change or an
// unmount leaves both.

import { useCallback, useContext, useEffect, useRef, useState, type RefObject } from "react";
import { UNSAFE_LocationContext } from "react-router-dom";
import {
  FULLSCREEN_CONFIRM_MS,
  FULLSCREEN_EVENTS,
  currentFullscreenElement,
  exitFullscreenNow,
  fullscreenSupported,
  requestFullscreenOn,
} from "./fullscreen";

export type FullscreenMode = "off" | "api" | "takeover";

export type Fullscreen = {
  mode: FullscreenMode;
  toggle: () => void;
  exit: () => void;
};

export function useFullscreen(ref: RefObject<HTMLElement | null>): Fullscreen {
  const [mode, setMode] = useState<FullscreenMode>("off");
  // The timer of a request still waiting for its fullscreenchange.
  const pending = useRef<number | null>(null);

  const settle = useCallback((): boolean => {
    if (pending.current === null) return false;
    window.clearTimeout(pending.current);
    pending.current = null;
    return true;
  }, []);

  useEffect(() => {
    function onChange(): void {
      const el = ref.current;
      const inside = el !== null && currentFullscreenElement() === el;
      if (inside) settle();
      setMode((m) => (inside ? "api" : m === "api" ? "off" : m));
    }
    for (const name of FULLSCREEN_EVENTS) document.addEventListener(name, onChange);
    return () => {
      for (const name of FULLSCREEN_EVENTS) document.removeEventListener(name, onChange);
      settle();
    };
  }, [ref, settle]);

  // Leaving "api" through an unmount exits the document's fullscreen when
  // the element still holds it.
  useEffect(() => {
    if (mode !== "api") return;
    const el = ref.current;
    return () => {
      if (el !== null && currentFullscreenElement() === el) exitFullscreenNow();
    };
  }, [mode, ref]);

  const exit = useCallback((): void => {
    settle();
    const el = ref.current;
    if (el !== null && currentFullscreenElement() === el) exitFullscreenNow();
    setMode((m) => (m === "takeover" ? "off" : m));
  }, [ref, settle]);

  const toggle = useCallback((): void => {
    const el = ref.current;
    if (el === null || pending.current !== null) return;
    if (mode !== "off") {
      exit();
      return;
    }
    if (!fullscreenSupported(el)) {
      setMode("takeover");
      return;
    }
    pending.current = window.setTimeout(() => {
      pending.current = null;
      setMode(currentFullscreenElement() === el ? "api" : "takeover");
    }, FULLSCREEN_CONFIRM_MS);
    void requestFullscreenOn(el).then((entered) => {
      if (!entered && settle()) setMode("takeover");
    });
  }, [ref, mode, exit, settle]);

  useEffect(() => {
    if (mode === "off") return;
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      exit();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mode, exit]);

  // A route change leaves fullscreen. Outside a router there is no route.
  const pathname = useContext(UNSAFE_LocationContext)?.location.pathname ?? null;
  const seenPath = useRef(pathname);
  useEffect(() => {
    if (seenPath.current === pathname) return;
    seenPath.current = pathname;
    exit();
  }, [pathname, exit]);

  return { mode, toggle, exit };
}
