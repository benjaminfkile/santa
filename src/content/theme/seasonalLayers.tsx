// docs/site.md section 7.7. Two seasonal layers: a canvas of small, slow,
// translucent flakes coloured by --snow, and a string of 7 px bulbs on a
// 1 px wire under the header. Each has a settings default and a
// per-visitor override in localStorage.

import { useEffect, useMemo, useRef } from "react";
import { useLocation } from "react-router-dom";
import { storageGet } from "../../lib/storage";
import type { ContentBundle } from "../../store/types";
import * as styles from "./SeasonalLayers.module.css";

const SNOW_KEY = "wmsfo.snow";
const LIGHTS_KEY = "wmsfo.lights";

function readOverride(key: string, fallback: boolean): boolean {
  const v = storageGet(key);
  if (v === "on") return true;
  if (v === "off") return false;
  return fallback;
}

function useIsLivePage(): boolean {
  const location = useLocation();
  return location.pathname === "/live" || location.pathname.startsWith("/live/");
}

export function SnowLayer({ bundle }: { bundle: ContentBundle | null }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isLivePage = useIsLivePage();
  const defaultOn = bundle?.content?.settings.theme.snowDefault ?? false;
  const enabled = readOverride(SNOW_KEY, defaultOn) && !isLivePage;

  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const flakes: { x: number; y: number; r: number; v: number; d: number }[] = [];
    let width = 0;
    let height = 0;
    let running = true;
    let raf = 0;
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
      const c = canvas!;
      ctx!.clearRect(0, 0, width, height);
      const style = getComputedStyle(document.documentElement).getPropertyValue("--snow").trim() || "rgba(255,255,255,0.7)";
      ctx!.fillStyle = style;
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
      if (!prefersReduced) raf = window.requestAnimationFrame(step);
      // Keep a reference to c so the parameter is used and TS accepts the
      // closure captures.
      void c;
    }

    resize();
    if (!prefersReduced) step();
    else step();
    const onResize = () => resize();
    window.addEventListener("resize", onResize);
    return () => {
      running = false;
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [enabled]);

  if (!enabled) return null;
  return <canvas ref={canvasRef} className={styles.snow} aria-hidden data-testid="snow-canvas" />;
}

const LIGHT_COLORS = ["var(--accent)", "var(--gold)", "var(--ok)", "var(--err)"] as const;

export function LightsLayer({ bundle }: { bundle: ContentBundle | null }) {
  const isLivePage = useIsLivePage();
  const defaultOn = bundle?.content?.settings.theme.lightsDefault ?? false;
  const enabled = readOverride(LIGHTS_KEY, defaultOn) && !isLivePage;

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
