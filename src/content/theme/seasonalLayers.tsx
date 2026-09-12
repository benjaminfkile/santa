// docs/site.md section 7.7. Two seasonal layers: a canvas of small, slow,
// translucent flakes coloured by --snow, and a string of 7 px bulbs on a
// 1 px wire under the header. Each has a settings default and a
// per-visitor override in localStorage. The live screen is detected
// through `live.eventStatusId === 3` at `/` (docs 24), not by path:
// snow is off by default there and the lights are not rendered over the
// map.

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useLocation } from "react-router-dom";
import { storageGet, storageSet } from "../../lib/storage";
import type { ContentBundle } from "../../store/types";
import { useStore } from "../../store/useStore";
import { subscribeScheme } from "./colorScheme";
import * as styles from "./SeasonalLayers.module.css";

export const SNOW_KEY = "wmsfo.snow";
export const LIGHTS_KEY = "wmsfo.lights";

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

export function setSnowOverride(next: boolean): void {
  storageSet(SNOW_KEY, next ? "on" : "off");
  notifyOverrides();
}

export function setLightsOverride(next: boolean): void {
  storageSet(LIGHTS_KEY, next ? "on" : "off");
  notifyOverrides();
}

function getSnowSnapshot(): string {
  return storageGet(SNOW_KEY) ?? "";
}
function getLightsSnapshot(): string {
  return storageGet(LIGHTS_KEY) ?? "";
}

export function useSnowEnabled(defaultOn: boolean): boolean {
  const stored = useSyncExternalStore(subscribeOverrides, getSnowSnapshot, () => "");
  if (stored === "on") return true;
  if (stored === "off") return false;
  return defaultOn;
}

export function useLightsEnabled(defaultOn: boolean): boolean {
  const stored = useSyncExternalStore(subscribeOverrides, getLightsSnapshot, () => "");
  if (stored === "on") return true;
  if (stored === "off") return false;
  return defaultOn;
}

function useIsLiveScreen(): boolean {
  const eventStatusId = useStore((s) => s.live?.eventStatusId ?? null);
  const location = useLocation();
  return eventStatusId === 3 && location.pathname === "/";
}

export function SnowLayer({ bundle }: { bundle: ContentBundle | null }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isLive = useIsLiveScreen();
  const settingsDefault = bundle?.content?.settings.theme.snowDefault ?? false;
  const defaultOn = isLive ? false : settingsDefault;
  const chosen = useSnowEnabled(defaultOn);
  const prefersReduced =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const enabled = chosen && !prefersReduced;

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
      const target = Math.floor((width * height) / 15000);
      for (let i = 0; i < target; i += 1) {
        flakes.push({
          x: Math.random() * width,
          y: Math.random() * height,
          r: 1 + Math.random() * 1.6,
          v: 0.2 + Math.random() * 0.6,
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
  const defaultOn = isLive ? false : settingsDefault;
  const enabled = useLightsEnabled(defaultOn) && !isLive;

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
