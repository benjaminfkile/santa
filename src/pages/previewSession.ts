// docs/site.md section 7.8. The tab's preview session: the token and the
// optional theme a preview link carried. While a session is active the
// PreviewSession component polls the draft into store.preview, so every
// route renders from it through selectBundle. The token and theme are kept
// in sessionStorage under one key so a reload of any page in the tab
// resumes the session. Exit ends it; a 404 marks it expired, which drops
// the draft and the stored key and leaves the expired banner up until Exit.

import { useSyncExternalStore } from "react";
import { store } from "../store/useStore";
import { resetPreviewLive } from "./previewLive";

export type PreviewTheme = "light" | "dark";

export type PreviewSessionState = {
  token: string;
  theme: PreviewTheme | null;
  expired: boolean;
} | null;

export const PREVIEW_SESSION_KEY = "wmsfo.preview";

let state: PreviewSessionState = null;
const listeners = new Set<() => void>();
let retryHandler: () => void = () => {};

function emit(next: PreviewSessionState): void {
  state = next;
  listeners.forEach((l) => l());
}

function writeStored(token: string, theme: PreviewTheme | null): void {
  try {
    window.sessionStorage.setItem(PREVIEW_SESSION_KEY, JSON.stringify({ token, theme }));
  } catch {
    // ignore
  }
}

function clearStored(): void {
  try {
    window.sessionStorage.removeItem(PREVIEW_SESSION_KEY);
  } catch {
    // ignore
  }
}

function readStored(): { token: string; theme: PreviewTheme | null } | null {
  try {
    const raw = window.sessionStorage.getItem(PREVIEW_SESSION_KEY);
    if (raw === null) return null;
    const v = JSON.parse(raw) as { token?: unknown; theme?: unknown };
    if (typeof v.token !== "string" || v.token === "") return null;
    const theme = v.theme === "light" || v.theme === "dark" ? v.theme : null;
    return { token: v.token, theme };
  } catch {
    return null;
  }
}

export function getPreviewSession(): PreviewSessionState {
  return state;
}

// Starts a session for the token, or updates the theme of the running one.
// A different token, or the same token after it expired, drops the draft
// and the live state so nothing from the previous session shows.
export function startPreviewSession(token: string, theme: PreviewTheme | null): void {
  writeStored(token, theme);
  if (state !== null && state.token === token && !state.expired) {
    if (state.theme !== theme) emit({ ...state, theme });
    return;
  }
  store.setState({ preview: null });
  resetPreviewLive();
  emit({ token, theme, expired: false });
}

// Resumes the session kept in sessionStorage when none is running.
export function resumePreviewSession(): void {
  if (state !== null) return;
  const stored = readStored();
  if (stored === null) return;
  emit({ token: stored.token, theme: stored.theme, expired: false });
}

export function expirePreviewSession(): void {
  if (state === null) return;
  clearStored();
  store.setState({ preview: null });
  resetPreviewLive();
  emit({ ...state, expired: true });
}

export function endPreviewSession(): void {
  clearStored();
  store.setState({ preview: null });
  resetPreviewLive();
  if (state !== null) emit(null);
}

export function setPreviewRetry(handler: () => void): void {
  retryHandler = handler;
}

export function retryPreview(): void {
  retryHandler();
}

// The robots noindex meta, present while anything holds it.
let noindexHolds = 0;
let noindexMeta: HTMLMetaElement | null = null;

export function holdNoindex(): () => void {
  if (typeof document === "undefined") return () => {};
  noindexHolds += 1;
  if (noindexMeta === null) {
    noindexMeta = document.createElement("meta");
    noindexMeta.setAttribute("name", "robots");
    noindexMeta.setAttribute("content", "noindex");
    noindexMeta.setAttribute("data-preview-meta", "1");
    document.head.appendChild(noindexMeta);
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    noindexHolds -= 1;
    if (noindexHolds === 0 && noindexMeta !== null) {
      noindexMeta.remove();
      noindexMeta = null;
    }
  };
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function usePreviewSession(): PreviewSessionState {
  return useSyncExternalStore(subscribe, getPreviewSession, getPreviewSession);
}
