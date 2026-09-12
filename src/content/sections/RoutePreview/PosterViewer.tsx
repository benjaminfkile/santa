// docs/site.md section 8.5. Route poster viewer: one <img> in a clipped
// touch-action:none frame positioned by CSS transform. Fit on load,
// clamp between fit and 6x fit, drag with pointer capture, wheel zoom
// about the cursor, pinch zoom about the midpoint, double-tap zoom, three
// buttons (zoom in, zoom out, fit), arrow keys pan, +/- zoom. Loads no map.

import { useCallback, useEffect, useRef, useState } from "react";
import { copy } from "../../../copy/copy";
import { clampScale, fitTransform, zoomAbout } from "./posterMath";

export type PosterViewerProps = {
  src: string;
  srcSet?: string;
  sizes?: string;
  alt: string;
  width?: number;
  height?: number;
};

type Transform = { x: number; y: number; scale: number };

const DOUBLE_TAP_ZOOM = 2;
const KEY_PAN = 40;
const KEY_ZOOM_FACTOR = 1.2;
const WHEEL_ZOOM_IN = 1.15;
const WHEEL_ZOOM_OUT = 1 / 1.15;
const BUTTON_ZOOM_FACTOR = 1.5;

export function PosterViewer({ src, srcSet, sizes, alt, width, height }: PosterViewerProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const pinchRef = useRef<{ distance: number; midX: number; midY: number; scale: number } | null>(null);
  const lastTapRef = useRef<number>(0);
  const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const [imgSize, setImgSize] = useState<{ width: number; height: number } | null>(
    width !== undefined && height !== undefined && width > 0 && height > 0
      ? { width, height }
      : null,
  );
  const [frameSize, setFrameSize] = useState<{ width: number; height: number } | null>(null);
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 });
  const [minScale, setMinScale] = useState<number>(1);

  const refit = useCallback(() => {
    if (frameSize === null || imgSize === null) return;
    if (frameSize.width <= 0 || frameSize.height <= 0) return;
    const fit = fitTransform(frameSize, imgSize);
    setMinScale(fit.scale);
    setTransform(fit);
  }, [frameSize, imgSize]);

  useEffect(() => {
    refit();
  }, [refit]);

  useEffect(() => {
    const frame = frameRef.current;
    if (frame === null || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const rect = frame.getBoundingClientRect();
      setFrameSize({ width: rect.width, height: rect.height });
    });
    ro.observe(frame);
    const rect = frame.getBoundingClientRect();
    setFrameSize({ width: rect.width, height: rect.height });
    return () => ro.disconnect();
  }, []);

  const onImgLoad = useCallback(() => {
    const img = imgRef.current;
    if (img !== null && img.naturalWidth > 0 && img.naturalHeight > 0) {
      setImgSize({ width: img.naturalWidth, height: img.naturalHeight });
    }
  }, []);

  const zoomAtScreen = useCallback(
    (factor: number, sx: number, sy: number) => {
      const frame = frameRef.current;
      if (frame === null) return;
      const rect = frame.getBoundingClientRect();
      const anchor = { x: sx - rect.left, y: sy - rect.top };
      setTransform((cur) => zoomAbout(cur, factor, anchor, minScale));
    },
    [minScale],
  );

  const zoomAtCenter = useCallback(
    (factor: number) => {
      if (frameSize === null) return;
      setTransform((cur) =>
        zoomAbout(cur, factor, { x: frameSize.width / 2, y: frameSize.height / 2 }, minScale),
      );
    },
    [frameSize, minScale],
  );

  useEffect(() => {
    const frame = frameRef.current;
    if (frame === null) return;
    // React attaches wheel with `passive: true` by default; add our own so
    // we can preventDefault and stop the page from scrolling while zooming.
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      zoomAtScreen(e.deltaY < 0 ? WHEEL_ZOOM_IN : WHEEL_ZOOM_OUT, e.clientX, e.clientY);
    }
    frame.addEventListener("wheel", onWheel, { passive: false });
    return () => frame.removeEventListener("wheel", onWheel);
  }, [zoomAtScreen]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (target.closest(".ibtn") !== null) return;
      const frame = frameRef.current;
      if (frame === null) return;
      frame.setPointerCapture(e.pointerId);
      activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (activePointers.current.size === 2) {
        const pts = [...activePointers.current.values()];
        const dx = pts[0].x - pts[1].x;
        const dy = pts[0].y - pts[1].y;
        pinchRef.current = {
          distance: Math.hypot(dx, dy),
          midX: (pts[0].x + pts[1].x) / 2,
          midY: (pts[0].y + pts[1].y) / 2,
          scale: transform.scale,
        };
        dragRef.current = null;
        return;
      }

      const now = performance.now();
      if (now - lastTapRef.current < 300) {
        zoomAtScreen(DOUBLE_TAP_ZOOM, e.clientX, e.clientY);
        lastTapRef.current = 0;
        return;
      }
      lastTapRef.current = now;

      dragRef.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
      frame.classList.add("route-poster--drag");
    },
    [transform.x, transform.y, transform.scale, zoomAtScreen],
  );

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointers.current.has(e.pointerId)) {
      activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    if (pinchRef.current !== null && activePointers.current.size >= 2) {
      const pts = [...activePointers.current.values()];
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const dist = Math.hypot(dx, dy);
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      const factor = dist / pinchRef.current.distance;
      pinchRef.current = { distance: dist, midX, midY, scale: pinchRef.current.scale };
      const frame = frameRef.current;
      if (frame === null) return;
      const rect = frame.getBoundingClientRect();
      setTransform((cur) => zoomAbout(cur, factor, { x: midX - rect.left, y: midY - rect.top }, minScale));
      return;
    }
    if (dragRef.current === null) return;
    const drag = dragRef.current;
    setTransform((cur) => ({ ...cur, x: e.clientX - drag.x, y: e.clientY - drag.y }));
  }, [minScale]);

  const onPointerEnd = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    activePointers.current.delete(e.pointerId);
    if (activePointers.current.size < 2) {
      pinchRef.current = null;
    }
    dragRef.current = null;
    frameRef.current?.classList.remove("route-poster--drag");
  }, []);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        setTransform((cur) => ({ ...cur, x: cur.x + KEY_PAN }));
        break;
      case "ArrowRight":
        e.preventDefault();
        setTransform((cur) => ({ ...cur, x: cur.x - KEY_PAN }));
        break;
      case "ArrowUp":
        e.preventDefault();
        setTransform((cur) => ({ ...cur, y: cur.y + KEY_PAN }));
        break;
      case "ArrowDown":
        e.preventDefault();
        setTransform((cur) => ({ ...cur, y: cur.y - KEY_PAN }));
        break;
      case "+":
      case "=":
        e.preventDefault();
        zoomAtCenter(KEY_ZOOM_FACTOR);
        break;
      case "-":
      case "_":
        e.preventDefault();
        zoomAtCenter(1 / KEY_ZOOM_FACTOR);
        break;
    }
  }, [zoomAtCenter]);

  const fit = useCallback(() => refit(), [refit]);
  const clampedScale = clampScale(transform.scale, minScale);
  const style = {
    transform: `translate(${transform.x}px, ${transform.y}px) scale(${clampedScale})`,
    transformOrigin: "0 0",
  };

  return (
    <div
      ref={frameRef}
      className="route-poster"
      data-testid="poster-viewer"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      <img
        ref={imgRef}
        className="route-poster__img"
        src={src}
        srcSet={srcSet}
        sizes={sizes}
        alt={alt}
        width={width}
        height={height}
        onLoad={onImgLoad}
        style={style}
        draggable={false}
      />
      <div className="route-poster__controls">
        <button
          type="button"
          className="ibtn"
          aria-label={copy.map.poster.zoomIn}
          onClick={() => zoomAtCenter(BUTTON_ZOOM_FACTOR)}
          data-testid="poster-zoom-in"
        >
          <PlusIcon />
        </button>
        <button
          type="button"
          className="ibtn"
          aria-label={copy.map.poster.zoomOut}
          onClick={() => zoomAtCenter(1 / BUTTON_ZOOM_FACTOR)}
          data-testid="poster-zoom-out"
        >
          <MinusIcon />
        </button>
        <button
          type="button"
          className="ibtn"
          aria-label={copy.map.poster.fit}
          onClick={fit}
          data-testid="poster-fit"
        >
          <TargetIcon />
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
