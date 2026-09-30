// docs/site.md section 7.7. Two seasonal layers: a canvas of small, slow,
// translucent flakes coloured by --snow behind the page's cards, and a
// string of 7 px bulbs on a 1 px wire under the header. Off the live
// screen snow follows the published `snowDefault` alone. On the live screen
// snow is off by default and the tracker menu's Snow button sets a choice
// held in memory only; the choice is cleared when the takeover ends, so the
// site then follows `snowDefault` again. The lights follow the site setting
// alone. The live screen is detected through `live.eventStatusId === 3`
// (docs 24), whatever the path, since every path renders the tracker then;
// the lights are not rendered over the map.

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { storageRemove } from "../../lib/storage";
import type { ContentBundle } from "../../store/types";
import { useStore } from "../../store/useStore";
import { subscribeScheme } from "./colorScheme";
import * as styles from "./SeasonalLayers.module.css";

// A leftover key from builds that stored the choice; it is removed and
// never read.
export const SNOW_KEY = "wmsfo.snow";

let liveChoice: boolean | null = null;

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

// The tracker's Snow button: sets the visitor's choice for the current
// live takeover, in memory only.
export function setSnowOverride(next: boolean): void {
  liveChoice = next;
  notifyOverrides();
}

// Drops the live choice; called when the takeover ends.
export function clearSnowOverride(): void {
  storageRemove(SNOW_KEY);
  if (liveChoice === null) return;
  liveChoice = null;
  notifyOverrides();
}

function getSnowSnapshot(): boolean | null {
  return liveChoice;
}

// The live screen's snow state: the visitor's choice for this takeover,
// else `defaultOn`.
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
    if (!isLive) clearSnowOverride();
  }, [isLive]);

  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const ctx = canvas.getContext("2d");
    if (ctx === null) return;

    const flakes: { x: number; y: number; r: number; v: number; d: number }[] = [];
    let width = 0;
    let height = 0;
    let running = true;
    let raf = 0;
    let snowColor: string | null = null;

    function readSnowColor(): void {
      const v = getComputedStyle(document.documentElement).getPropertyValue("--snow").trim();
      snowColor = v === "" ? null : v;
    }
    readSnowColor();
    const unsubscribeScheme = subscribeScheme(readSnowColor);

    function resize() {
      const c = canvas!;
      width = c.clientWidth;
      height = c.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = Math.floor(width * dpr);
      c.height = Math.floor(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      flakes.length = 0;
      const target = Math.floor((width * height) / 30000);
      for (let i = 0; i < target; i += 1) {
        flakes.push({
          x: Math.random() * width,
          y: Math.random() * height,
          r: 0.8 + Math.random() * 1.3,
          v: 0.15 + Math.random() * 0.45,
          d: (Math.random() - 0.5) * 0.15,
        });
      }
    }

    function step() {
      if (!running) return;
      ctx!.clearRect(0, 0, width, height);
      if (snowColor !== null) {
        ctx!.fillStyle = snowColor;
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
        }
      }
      raf = window.requestAnimationFrame(step);
    }

    resize();
    step();
    const onResize = () => resize();
    window.addEventListener("resize", onResize);
    return () => {
      running = false;
      if (raf !== 0) window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      unsubscribeScheme();
    };
  }, [enabled]);

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
