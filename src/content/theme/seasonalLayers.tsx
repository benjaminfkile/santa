// docs/site.md section 7.7. Two seasonal layers: a canvas of small, slow,
// translucent flakes coloured by --snow behind the page's cards (white
// flakes with a thin cool outline over the map, the same on every map
// style), and a string of 7 px bulbs on a 1 px wire under the header. Off
// the live screen snow follows the published `snowDefault` alone. On the
// live screen snow is off until the viewer presses the tracker menu's
// Snow button, and that choice is stored with the tracker's other choices
// (sections/Map/trackerToggles.ts), so a refresh and the next visit keep
// it. The lights follow the site setting alone. The live screen is
// detected through `live.eventStatusId === 3` (docs 24), whatever the
// path, since every path renders the tracker then; the lights are not
// rendered over the map.

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { decorativeDpr, startDecorativeLoop } from "../../lib/decorativeLoop";
import { storageRemove } from "../../lib/storage";
import type { ContentBundle } from "../../store/types";
import { useStore } from "../../store/useStore";
import {
  hasTrackerToggle,
  readTrackerToggle,
  removeTrackerToggle,
  writeTrackerToggle,
} from "../sections/Map/trackerToggles";
import { subscribeScheme } from "./colorScheme";
import * as styles from "./SeasonalLayers.module.css";

// A leftover key from builds that stored the choice on its own; it is
// removed and never read.
export const SNOW_KEY = "wmsfo.snow";

// Square pixels per flake behind the page's cards and over the map, and
// the map flakes' fill and outline.
const PAGE_FLAKE_AREA = 30000;
const LIVE_FLAKE_AREA = 22000;
export const LIVE_FLAKE_FILL = "rgba(255, 255, 255, 0.8)";
export const LIVE_FLAKE_OUTLINE = "rgba(48, 70, 100, 0.4)";
const LIVE_FLAKE_OUTLINE_WIDTH = 0.75;

const overrideListeners = new Set<() => void>();

function notifyOverrides(): void {
  for (const l of overrideListeners) l();
}

export function subscribeOverrides(l: () => void): () => void {
  overrideListeners.add(l);
  return () => {
    overrideListeners.delete(l);
  };
}

// The tracker's Snow button: stores the viewer's choice with the tracker's
// other choices.
export function setSnowOverride(next: boolean): void {
  writeTrackerToggle("snow", next);
  notifyOverrides();
}

// Forgets the viewer's choice, so the live screen starts from off again.
export function clearSnowOverride(): void {
  storageRemove(SNOW_KEY);
  if (!hasTrackerToggle("snow")) return;
  removeTrackerToggle("snow");
  notifyOverrides();
}

function getSnowSnapshot(): boolean | null {
  return hasTrackerToggle("snow") ? readTrackerToggle("snow", false) : null;
}

// The live screen's snow state: the viewer's stored choice, else
// `defaultOn`.
export function useSnowEnabled(defaultOn: boolean): boolean {
  const chosen = useSyncExternalStore(subscribeOverrides, getSnowSnapshot, () => null);
  return chosen ?? defaultOn;
}

function useIsLiveScreen(): boolean {
  const eventStatusId = useStore((s) => s.live?.eventStatusId ?? null);
  return eventStatusId === 3;
}

export function SnowLayer({ bundle }: { bundle: ContentBundle | null }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isLive = useIsLiveScreen();
  const settingsDefault = bundle?.content?.settings.theme.snowDefault ?? false;
  const liveOn = useSnowEnabled(false);
  const chosen = isLive ? liveOn : settingsDefault;
  const prefersReduced =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const enabled = chosen && !prefersReduced;

  useEffect(() => {
    storageRemove(SNOW_KEY);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const ctx = canvas.getContext("2d");
    if (ctx === null) return;

    const flakes: { x: number; y: number; r: number; v: number; d: number }[] = [];
    let width = 0;
    let height = 0;
    let snowColor: string | null = null;
    // Over the map the flakes are white with a thin cool outline, larger
    // and denser, so they read on a light map style and a dark one alike;
    // behind the page's cards they take --snow, small and translucent.
    const overMap = isLive;
    const area = overMap ? LIVE_FLAKE_AREA : PAGE_FLAKE_AREA;

    function readSnowColor(): void {
      if (overMap) {
        snowColor = LIVE_FLAKE_FILL;
        return;
      }
      const v = getComputedStyle(document.documentElement).getPropertyValue("--snow").trim();
      snowColor = v === "" ? null : v;
    }
    readSnowColor();
    const unsubscribeScheme = subscribeScheme(readSnowColor);

    function resize() {
      const c = canvas!;
      width = c.clientWidth;
      height = c.clientHeight;
      const dpr = decorativeDpr();
      c.width = Math.floor(width * dpr);
      c.height = Math.floor(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      flakes.length = 0;
      const target = Math.floor((width * height) / area);
      for (let i = 0; i < target; i += 1) {
        flakes.push({
          x: Math.random() * width,
          y: Math.random() * height,
          r: overMap ? 1.0 + Math.random() * 1.2 : 0.8 + Math.random() * 1.3,
          v: 0.15 + Math.random() * 0.45,
          d: (Math.random() - 0.5) * 0.15,
        });
      }
    }

    function step() {
      ctx!.clearRect(0, 0, width, height);
      if (snowColor !== null) {
        ctx!.fillStyle = snowColor;
        if (overMap) {
          ctx!.strokeStyle = LIVE_FLAKE_OUTLINE;
          ctx!.lineWidth = LIVE_FLAKE_OUTLINE_WIDTH;
        }
        for (const f of flakes) {
          f.y += f.v;
          f.x += f.d;
          if (f.y > height + 2) {
            f.y = -2;
            f.x = Math.random() * width;
          }
          if (f.x < -2) f.x = width;
          if (f.x > width + 2) f.x = 0;
          ctx!.beginPath();
          ctx!.arc(f.x, f.y, f.r, 0, Math.PI * 2);
          ctx!.fill();
          if (overMap) ctx!.stroke();
        }
      }
    }

    resize();
    // The frame loop pauses while the tab is hidden or the canvas is off
    // screen and resumes when both hold again.
    const loop = startDecorativeLoop(canvas, step);
    const onResize = () => resize();
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      loop.stop();
      window.removeEventListener("resize", onResize);
      unsubscribeScheme();
    };
  }, [enabled, isLive]);

  if (!enabled) return null;
  return <canvas ref={canvasRef} className={styles.snow} aria-hidden data-testid="snow-canvas" />;
}

const LIGHT_COLORS = ["var(--accent)", "var(--gold)", "var(--ok)", "var(--err)"] as const;

export function LightsLayer({ bundle }: { bundle: ContentBundle | null }) {
  const isLive = useIsLiveScreen();
  const settingsDefault = bundle?.content?.settings.theme.lightsDefault ?? false;
  const enabled = settingsDefault && !isLive;

  const bulbs = useMemo(() => {
    const items = [];
    for (let i = 0; i < 20; i += 1) {
      items.push({
        left: `${(i + 0.5) * (100 / 20)}%`,
        color: LIGHT_COLORS[i % LIGHT_COLORS.length],
        delay: `${(i % 4) * 0.4}s`,
      });
    }
    return items;
  }, []);

  if (!enabled) return null;
  return (
    <div className={styles.lights} aria-hidden data-testid="site-lights">
      <div className={styles.lightsWire} />
      {bulbs.map((b, i) => (
        <span
          key={i}
          className={styles.lightsBulb}
          style={{ left: b.left, background: b.color, animationDelay: b.delay }}
        />
      ))}
    </div>
  );
}
