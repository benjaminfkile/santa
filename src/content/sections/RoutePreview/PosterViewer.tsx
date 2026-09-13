// docs/site.md section 8.5. Route poster viewer: OpenSeadragon in its own
// `osd` chunk, imported when the section mounts. Tile source is the asset's
// Deep Zoom pyramid when present, otherwise an image source over the
// original url. Site's own controls in the .ibtn recipe: zoom in, zoom out,
// fit (viewport.goHome), and fullscreen (Fullscreen API on the frame, with
// a fixed-frame fallback where the API is missing). Keyboard: arrows pan,
// +/- zoom, 0 fits, F toggles fullscreen. Destroyed on unmount, rebuilt on
// a new media id. animationTime 0 under reduced motion.

import { useEffect, useRef, useState } from "react";
import type OpenSeadragon from "openseadragon";
import { copy } from "../../../copy/copy";
import { useReducedMotion } from "../../../lib/motion";
import * as styles from "./RoutePreview.module.css";
import * as ibtn from "../../../ui/IconButton.module.css";

export type PosterViewerProps = {
  mediaId: string;
  url: string;
  dzi: string | null;
  alt: string;
  ariaLabel?: string;
};

type Viewer = OpenSeadragon.Viewer;
type OSDFactory = (options: OpenSeadragon.Options) => OpenSeadragon.Viewer;
type OSDModule = {
  default: OSDFactory & { Point: new (x: number, y: number) => OpenSeadragon.Point };
};

function fullscreenSupported(): boolean {
  if (typeof document === "undefined") return false;
  const d = document as unknown as { fullscreenEnabled?: boolean; webkitFullscreenEnabled?: boolean };
  return d.fullscreenEnabled === true || d.webkitFullscreenEnabled === true;
}

function currentFullscreenElement(): Element | null {
  if (typeof document === "undefined") return null;
  const d = document as unknown as { fullscreenElement?: Element | null; webkitFullscreenElement?: Element | null };
  return d.fullscreenElement ?? d.webkitFullscreenElement ?? null;
}

function requestFullscreenOn(element: HTMLElement): void {
  const el = element as HTMLElement & {
    requestFullscreen?: () => Promise<void>;
    webkitRequestFullscreen?: () => Promise<void>;
  };
  if (typeof el.requestFullscreen === "function") {
    void el.requestFullscreen();
  } else if (typeof el.webkitRequestFullscreen === "function") {
    void el.webkitRequestFullscreen();
  }
}

function exitFullscreenNow(): void {
  const d = document as unknown as {
    exitFullscreen?: () => Promise<void>;
    webkitExitFullscreen?: () => Promise<void>;
  };
  if (typeof d.exitFullscreen === "function") {
    void d.exitFullscreen();
  } else if (typeof d.webkitExitFullscreen === "function") {
    void d.webkitExitFullscreen();
  }
}

export function PosterViewer({ mediaId, url, dzi, alt, ariaLabel }: PosterViewerProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const osdRef = useRef<OSDModule | null>(null);
  const reducedMotion = useReducedMotion();
  const [fullscreen, setFullscreen] = useState<boolean>(false);
  const [fallbackFullscreen, setFallbackFullscreen] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (host === null) return;
    void import("openseadragon").then((mod) => {
      if (cancelled) return;
      const osd = mod as unknown as OSDModule;
      osdRef.current = osd;
      const OSD = osd.default;
      const tileSource = dzi !== null && dzi.length > 0
        ? dzi
        : { type: "image", url };
      const viewer = OSD({
        element: host,
        tileSources: tileSource,
        showNavigationControl: false,
        gestureSettingsMouse: { clickToZoom: false },
        gestureSettingsTouch: { pinchToZoom: true },
        minZoomImageRatio: 0.8,
        maxZoomPixelRatio: 1,
        visibilityRatio: 1,
        constrainDuringPan: true,
        animationTime: reducedMotion ? 0 : undefined,
      });
      viewerRef.current = viewer;
    });
    return () => {
      cancelled = true;
      if (viewerRef.current !== null) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [mediaId, url, dzi, reducedMotion]);

  useEffect(() => {
    const frame = frameRef.current;
    if (frame === null) return;
    function onChange() {
      const el = currentFullscreenElement();
      const inFullscreen = el === frame;
      setFullscreen(inFullscreen);
      viewerRef.current?.forceResize();
    }
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  useEffect(() => {
    if (!fallbackFullscreen) return;
    const id = window.setTimeout(() => {
      viewerRef.current?.forceResize();
    }, 0);
    return () => window.clearTimeout(id);
  }, [fallbackFullscreen]);

  function makePoint(x: number, y: number): OpenSeadragon.Point {
    const mod = osdRef.current;
    if (mod !== null) {
      return new mod.default.Point(x, y);
    }
    return { x, y } as OpenSeadragon.Point;
  }

  function zoomIn() {
    const v = viewerRef.current;
    if (v === null) return;
    v.viewport.zoomBy(1.4);
    v.viewport.applyConstraints();
  }
  function zoomOut() {
    const v = viewerRef.current;
    if (v === null) return;
    v.viewport.zoomBy(1 / 1.4);
    v.viewport.applyConstraints();
  }
  function fit() {
    viewerRef.current?.viewport.goHome();
  }
  function toggleFullscreen() {
    const frame = frameRef.current;
    if (frame === null) return;
    if (fullscreenSupported()) {
      if (currentFullscreenElement() === frame) {
        exitFullscreenNow();
      } else {
        requestFullscreenOn(frame);
      }
    } else {
      setFallbackFullscreen((v) => !v);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const v = viewerRef.current;
    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        v?.viewport.panBy(makePoint(-0.05, 0));
        break;
      case "ArrowRight":
        e.preventDefault();
        v?.viewport.panBy(makePoint(0.05, 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        v?.viewport.panBy(makePoint(0, -0.05));
        break;
      case "ArrowDown":
        e.preventDefault();
        v?.viewport.panBy(makePoint(0, 0.05));
        break;
      case "+":
      case "=":
        e.preventDefault();
        zoomIn();
        break;
      case "-":
      case "_":
        e.preventDefault();
        zoomOut();
        break;
      case "0":
        e.preventDefault();
        fit();
        break;
      case "f":
      case "F":
        e.preventDefault();
        toggleFullscreen();
        break;
    }
  }

  const inFullscreen = fullscreen || fallbackFullscreen;
  const frameClass = fallbackFullscreen
    ? `${styles.routePoster} ${styles.routePosterFullscreen}`
    : styles.routePoster;

  const label = ariaLabel ?? alt;

  return (
    <div
      ref={frameRef}
      key={mediaId}
      className={frameClass}
      data-testid="poster-viewer"
      data-fullscreen={inFullscreen ? "on" : "off"}
      tabIndex={0}
      role="region"
      aria-label={label}
      onKeyDown={onKeyDown}
    >
      <div ref={hostRef} className={styles.routePosterHost} data-testid="poster-viewer-host" />
      <div className={styles.routePosterControls}>
        <button
          type="button"
          className={ibtn.ibtn}
          aria-label={copy.map.poster.zoomIn}
          onClick={zoomIn}
          data-testid="poster-zoom-in"
        >
          <PlusIcon />
        </button>
        <button
          type="button"
          className={ibtn.ibtn}
          aria-label={copy.map.poster.zoomOut}
          onClick={zoomOut}
          data-testid="poster-zoom-out"
        >
          <MinusIcon />
        </button>
        <button
          type="button"
          className={ibtn.ibtn}
          aria-label={copy.map.poster.fit}
          onClick={fit}
          data-testid="poster-fit"
        >
          <TargetIcon />
        </button>
        <button
          type="button"
          className={ibtn.ibtn}
          aria-label={inFullscreen ? copy.map.poster.exitFullscreen : copy.map.poster.fullscreen}
          aria-pressed={inFullscreen}
          onClick={toggleFullscreen}
          data-testid="poster-fullscreen"
        >
          {inFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
        </button>
      </div>
    </div>
  );
}

const strokeProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "1.75",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" {...strokeProps} aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function MinusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" {...strokeProps} aria-hidden>
      <path d="M5 12h14" />
    </svg>
  );
}
function TargetIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" {...strokeProps} aria-hidden>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  );
}
function FullscreenIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" {...strokeProps} aria-hidden>
      <path d="M4 9V4h5" />
      <path d="M20 9V4h-5" />
      <path d="M4 15v5h5" />
      <path d="M20 15v5h-5" />
    </svg>
  );
}
function ExitFullscreenIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" {...strokeProps} aria-hidden>
      <path d="M9 4v5H4" />
      <path d="M15 4v5h5" />
      <path d="M9 20v-5H4" />
      <path d="M15 20v-5h5" />
    </svg>
  );
}
