// docs/site.md section 7.8. Preview: fetches the bundle from
// GET /preview/document?token=..., stores it as store.preview, shows the
// Preview banner (through the shell reading store.preview), and renders
// the page whose slug matches. While mounted and visible it fetches again
// every 2000 ms with If-None-Match set to the last ETag, fetches once as
// soon as the tab becomes visible, and replaces store.preview only when
// the body text differs from the last one, so the page updates in place.
// A 404 renders "This preview link has expired" and stops polling. A
// failed fetch keeps the last render and tries again on the next tick;
// five failures in a row mark the banner Reconnecting until a success.
// Sets robots=noindex; clears store.preview on unmount.
// theme=light or theme=dark applies that theme while mounted without
// storing it, and the stored choice is applied again on unmount.

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { store, useStore } from "../store/useStore";
import { PageRenderer } from "../content/PageRenderer";
import { Loading } from "./Loading";
import { NotFound } from "./NotFound";
import { fetchPreviewDocument } from "../api/preview";
import { ApiRequestError } from "../api/errors";
import { selectHome } from "../content/selectPage";
import { releaseTheme, setTheme } from "../content/theme/colorScheme";
import { resetPreviewLive, setPreviewLive } from "./previewLive";
import * as btn from "../ui/Button.module.css";

type LoadState =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "expired" }
  | { kind: "error"; message: string };

const PREVIEW_POLL_MS = 2000;
const FAILURES_BEFORE_RECONNECTING = 5;

export function PreviewPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const pageSlug = params.get("page");
  const themeParam = params.get("theme");
  const theme = themeParam === "light" || themeParam === "dark" ? themeParam : null;
  const preview = useStore((s) => s.preview);
  const home = useStore(selectHome);
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    if (typeof document === "undefined") return;
    const meta = document.createElement("meta");
    meta.setAttribute("name", "robots");
    meta.setAttribute("content", "noindex");
    meta.setAttribute("data-preview-meta", "1");
    document.head.appendChild(meta);
    return () => {
      meta.remove();
    };
  }, []);

  useEffect(() => {
    if (theme === null) return;
    setTheme(theme, { persist: false });
    return () => {
      releaseTheme();
    };
  }, [theme]);

  const retryRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (token === "") {
      setState({ kind: "expired" });
      return;
    }
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
          setState((s) => (s.kind === "ready" ? s : { kind: "ready" }));
        }
      } catch (e) {
        if (stopped) return;
        if (e instanceof ApiRequestError && e.status === 404) {
          stopped = true;
          store.setState({ preview: null });
          resetPreviewLive();
          setState({ kind: "expired" });
          return;
        }
        failures += 1;
        if (failures >= FAILURES_BEFORE_RECONNECTING) {
          setPreviewLive({ reconnecting: true });
          if (lastText === null) {
            setState({ kind: "error", message: "Could not reach the server." });
          }
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

    retryRef.current = () => {
      if (stopped) return;
      setState({ kind: "loading" });
      clearTimer();
      if (!inFlight) void tick();
    };

    document.addEventListener("visibilitychange", onVisibility);
    if (visible()) void tick();
    return () => {
      stopped = true;
      clearTimer();
      document.removeEventListener("visibilitychange", onVisibility);
      retryRef.current = () => {};
      store.setState({ preview: null });
      resetPreviewLive();
    };
  }, [token]);

  const retry = useCallback(() => retryRef.current(), []);

  if (state.kind === "expired") {
    return (
      <main id="main">
        <h1>Preview</h1>
        <p>This preview link has expired.</p>
      </main>
    );
  }
  if (state.kind === "error") {
    return (
      <main id="main">
        <h1>Preview</h1>
        <p>{state.message}</p>
        <button type="button" className={btn.btn} onClick={retry}>Retry</button>
      </main>
    );
  }
  if (preview === null || preview.content === null) return <Loading />;

  const pages = preview.content.pages;
  const page =
    pageSlug === null || pageSlug === ""
      ? pickHomePreviewPage(pages, home)
      : pages.find((p) => p.slug === pageSlug) ?? null;
  if (page === null) return <NotFound />;
  return <PageRenderer page={page} bundle={preview} />;
}

function pickHomePreviewPage(
  pages: import("../contracts").ContentDocument["pages"],
  home: ReturnType<typeof selectHome>,
) {
  if (home.kind === "page") {
    const match = pages.find((p) => p.role === home.page.role);
    if (match) return match;
  }
  return pages.find((p) => p.role !== "none") ?? null;
}
