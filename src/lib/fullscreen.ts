// docs/site.md sections 8.5 and 8.9. Fullscreen API helpers with the
// webkit prefixed names as a second choice. `fullscreenSupported` is false
// where the API is missing (iPhone Safari), where callers use their own
// fixed-over-the-viewport fallback. Requests and exits never throw; a
// rejected request resolves false.

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

export function fullscreenSupported(): boolean {
  if (typeof document === "undefined") return false;
  const d = document as FullscreenDocument;
  return d.fullscreenEnabled === true || d.webkitFullscreenEnabled === true;
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
