// docs/site.md section 7.8. Mounted once above the routes, so it survives
// navigation. On mount it resumes a session kept in sessionStorage. While
// a session is active it holds the robots noindex meta, applies the
// session's theme without storing it, and follows the draft: while the
// tab is visible it fetches the document every 2000 ms with If-None-Match
// set to the last ETag, fetches once as soon as the tab becomes visible,
// and replaces store.preview only when the body text differs from the
// last one. A 404 expires the session and stops polling. A failed fetch
// keeps the last draft and tries again on the next tick; five failures in
// a row mark the banner Reconnecting until a success. Renders nothing.

import { useEffect } from "react";
import { store } from "../store/useStore";
import { fetchPreviewDocument } from "../api/preview";
import { ApiRequestError } from "../api/errors";
import { releaseTheme, setTheme } from "../content/theme/colorScheme";
import { resetPreviewLive, setPreviewLive } from "../pages/previewLive";
import {
  expirePreviewSession,
  holdNoindex,
  resumePreviewSession,
  setPreviewRetry,
  usePreviewSession,
} from "../pages/previewSession";

const PREVIEW_POLL_MS = 2000;
const FAILURES_BEFORE_RECONNECTING = 5;

export function PreviewSession() {
  const session = usePreviewSession();
  const active = session !== null && !session.expired;
  const token = active ? session.token : null;
  const theme = active ? session.theme : null;

  useEffect(() => {
    resumePreviewSession();
  }, []);

  useEffect(() => {
    if (!active) return;
    return holdNoindex();
  }, [active]);

  useEffect(() => {
    if (theme === null) return;
    setTheme(theme, { persist: false });
    return () => {
      releaseTheme();
    };
  }, [theme]);

  useEffect(() => {
    if (token === null) return;
    let stopped = false;
    let inFlight = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let etag: string | null = null;
    let lastText: string | null = null;
    let failures = 0;

    const clearTimer = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    };
    const visible = () => document.visibilityState === "visible";
    const schedule = () => {
      clearTimer();
      if (stopped || !visible()) return;
      timer = setTimeout(() => void tick(), PREVIEW_POLL_MS);
    };

    const tick = async () => {
      timer = null;
      if (stopped || inFlight) return;
      inFlight = true;
      try {
        const res = await fetchPreviewDocument(token, etag);
        if (stopped) return;
        failures = 0;
        setPreviewLive({ reconnecting: false });
        if (res.kind === "ok") {
          etag = res.etag;
          if (res.text !== lastText) {
            lastText = res.text;
            store.setState({ preview: res.bundle });
            setPreviewLive({ lastChangeAt: Date.now() });
          }
        }
      } catch (e) {
        if (stopped) return;
        if (e instanceof ApiRequestError && e.status === 404) {
          stopped = true;
          expirePreviewSession();
          return;
        }
        failures += 1;
        if (failures >= FAILURES_BEFORE_RECONNECTING) {
          setPreviewLive({ reconnecting: true });
        }
      } finally {
        inFlight = false;
        schedule();
      }
    };

    const onVisibility = () => {
      if (stopped) return;
      clearTimer();
      if (visible() && !inFlight) void tick();
    };

    setPreviewRetry(() => {
      if (stopped) return;
      setPreviewLive({ reconnecting: false });
      clearTimer();
      if (!inFlight) void tick();
    });

    document.addEventListener("visibilitychange", onVisibility);
    if (visible()) void tick();
    return () => {
      stopped = true;
      clearTimer();
      document.removeEventListener("visibilitychange", onVisibility);
      setPreviewRetry(() => {});
      store.setState({ preview: null });
      resetPreviewLive();
    };
  }, [token]);

  return null;
}
