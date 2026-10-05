// docs/site.md sections 8.1 and 16. Gated GA4 loader, the router
// page-view hook, and the `map_error` event. Three independent conditions must all hold for analytics to run:
//
//   1. `settings.analyticsEnabled` is true in the bundle captured at the
//      first snapshot. A later publish that flips it off stops page views
//      at the next navigation.
//   2. Both `VITE_ANALYTICS_ID` and `VITE_ANALYTICS_ORIGINS` are set.
//   3. `window.location.origin` is in the origins list.
//
// Two events are sent: `page_view` per navigation, and `map_error` when
// the map fails to load or throws, carrying only its source ("load" or
// "render") and the error's description. No user identifier, email, or
// location is ever sent.

import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { env } from "../config/env";
import { useStore } from "../store/useStore";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let initialized = false;

export function initAnalytics(): boolean {
  if (initialized) return true;
  if (!env.ANALYTICS_ID) return false;
  if (env.ANALYTICS_ORIGINS.length === 0) return false;
  if (!env.ANALYTICS_ORIGINS.includes(window.location.origin)) return false;

  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(env.ANALYTICS_ID)}`;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", env.ANALYTICS_ID, { send_page_view: false });
  initialized = true;
  return true;
}

export function resetAnalyticsForTests(): void {
  initialized = false;
  delete window.dataLayer;
  delete window.gtag;
}

export function sendPageView(path: string): void {
  if (!initialized || !window.gtag || !env.ANALYTICS_ID) return;
  window.gtag("event", "page_view", {
    page_path: path,
    send_to: env.ANALYTICS_ID,
  });
}

export function sendEvent(name: string, params: Record<string, string>): void {
  if (!initialized || !window.gtag || !env.ANALYTICS_ID) return;
  window.gtag("event", name, { ...params, send_to: env.ANALYTICS_ID });
}

const REASON_MAX = 160;

// One line naming an error: an Error's name when it says more than "Error",
// then its message; a non-empty string as it is; anything else "Unknown
// error". Trimmed to 160 characters.
export function describeError(error: unknown): string {
  let text = "";
  if (error instanceof Error) {
    const message = error.message.trim();
    const name = error.name && error.name !== "Error" ? error.name : "";
    text = name && message ? `${name}: ${message}` : name || message;
  } else if (typeof error === "string") {
    text = error.trim();
  }
  if (text === "") text = "Unknown error";
  return text.length > REASON_MAX ? text.slice(0, REASON_MAX) : text;
}

export type MapErrorSource = "load" | "render";

export function reportMapError(source: MapErrorSource, error: unknown): void {
  const reason = describeError(error);
  console.error(`map_error ${source}: ${reason}`);
  sendEvent("map_error", { map_error_source: source, map_error_reason: reason });
}

export function usePageViews(): void {
  const location = useLocation();
  const enabledInBundle = useStore((s) => {
    const bundle = s.snapshot?.content ?? null;
    if (bundle === null) return null;
    return Boolean(
      (bundle as { settings?: { analyticsEnabled?: boolean } }).settings?.analyticsEnabled,
    );
  });

  useEffect(() => {
    if (enabledInBundle !== true) return;
    if (!initAnalytics()) return;
    sendPageView(location.pathname + location.search);
  }, [enabledInBundle, location.pathname, location.search]);
}
