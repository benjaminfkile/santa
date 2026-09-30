// docs/site.md section 18. Frame loop and backing store rules for the
// decorative canvases (snow). A decorative canvas never allocates more
// than two device pixels per CSS pixel, and its requestAnimationFrame
// loop runs only while the document is visible and the layer intersects
// the viewport; it resumes on the next frame when both hold again.

export const DECORATIVE_MAX_DPR = 2;

// The device pixel ratio a decorative canvas sizes its backing store by:
// the screen's ratio, at least 1 and at most DECORATIVE_MAX_DPR.
export function decorativeDpr(raw: number | undefined = globalThis.window?.devicePixelRatio): number {
  const dpr = typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : 1;
  return Math.min(Math.max(dpr, 1), DECORATIVE_MAX_DPR);
}

export type DecorativeLoop = {
  // Whether a frame is scheduled right now.
  isRunning: () => boolean;
  stop: () => void;
};

// Calls `frame` at once and then once per animation frame while the
// document is visible and `target` intersects the viewport. Without
// IntersectionObserver the layer counts as on screen. `stop` cancels the frame and every listener.
export function startDecorativeLoop(target: Element, frame: () => void): DecorativeLoop {
  let visible = typeof document === "undefined" || document.visibilityState !== "hidden";
  let onScreen = true;
  let stopped = false;
  let raf = 0;

  function tick(): void {
    raf = 0;
    if (stopped || !visible || !onScreen) return;
    frame();
    raf = window.requestAnimationFrame(tick);
  }

  function sync(): void {
    const shouldRun = !stopped && visible && onScreen;
    if (shouldRun && raf === 0) {
      raf = window.requestAnimationFrame(tick);
    } else if (!shouldRun && raf !== 0) {
      window.cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  function onVisibility(): void {
    visible = document.visibilityState !== "hidden";
    sync();
  }
  document.addEventListener("visibilitychange", onVisibility);

  let observer: IntersectionObserver | null = null;
  if (typeof IntersectionObserver === "function") {
    observer = new IntersectionObserver((entries) => {
      const last = entries[entries.length - 1];
      if (last === undefined) return;
      onScreen = last.isIntersecting;
      sync();
    });
    observer.observe(target);
  }

  // The first frame paints at once, as the layer mounts.
  tick();

  return {
    isRunning: () => raf !== 0,
    stop: () => {
      stopped = true;
      sync();
      document.removeEventListener("visibilitychange", onVisibility);
      observer?.disconnect();
      observer = null;
    },
  };
}
