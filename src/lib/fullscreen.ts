// docs/site.md sections 8.5 and 8.9. Fullscreen API helpers.
// `fullscreenSupported` is true only for the unprefixed element API:
// `document.fullscreenEnabled === true` and a `requestFullscreen` function
// on the target. iPhone Safari reports `webkitFullscreenEnabled` but only
// takes video fullscreen, so it reads as unsupported and callers use the
// takeover (`useFullscreen`, `TakeoverPortal`). The webkit prefixed names
// are only the call fallback once that check has passed. Requests and
// exits never throw; a rejected request resolves false. `lockBodyScroll`
// stops the body scrolling until every lock it handed out is released.

type FullscreenDocument = Document & {
  fullscreenEnabled?: boolean;
  webkitFullscreenEnabled?: boolean;
  fullscreenElement?: Element | null;
  webkitFullscreenElement?: Element | null;
  exitFullscreen?: () => Promise<void>;
  webkitExitFullscreen?: () => Promise<void>;
};

type FullscreenElement = HTMLElement & {
  requestFullscreen?: () => Promise<void>;
  webkitRequestFullscreen?: () => Promise<void> | void;
};

export const FULLSCREEN_EVENTS = ["fullscreenchange", "webkitfullscreenchange"] as const;

// How long a request may take to produce a `fullscreenchange` before the
// caller treats it as refused.
export const FULLSCREEN_CONFIRM_MS = 1000;

export function fullscreenSupported(element: HTMLElement): boolean {
  if (typeof document === "undefined") return false;
  const d = document as FullscreenDocument;
  return d.fullscreenEnabled === true && typeof (element as FullscreenElement).requestFullscreen === "function";
}

export function currentFullscreenElement(): Element | null {
  if (typeof document === "undefined") return null;
  const d = document as FullscreenDocument;
  return d.fullscreenElement ?? d.webkitFullscreenElement ?? null;
}

export async function requestFullscreenOn(element: HTMLElement): Promise<boolean> {
  const el = element as FullscreenElement;
  try {
    if (typeof el.requestFullscreen === "function") {
      await el.requestFullscreen();
      return true;
    }
    if (typeof el.webkitRequestFullscreen === "function") {
      await el.webkitRequestFullscreen();
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export function exitFullscreenNow(): void {
  const d = document as FullscreenDocument;
  try {
    if (typeof d.exitFullscreen === "function") {
      void d.exitFullscreen().catch(() => {});
    } else if (typeof d.webkitExitFullscreen === "function") {
      void d.webkitExitFullscreen();
    }
  } catch {
    // already out of fullscreen
  }
}

let locks = 0;
let lockedFrom = "";

export function lockBodyScroll(): () => void {
  const body = document.body;
  if (locks === 0) {
    lockedFrom = body.style.overflow;
    body.style.overflow = "hidden";
  }
  locks += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks -= 1;
    if (locks === 0) body.style.overflow = lockedFrom;
  };
}
