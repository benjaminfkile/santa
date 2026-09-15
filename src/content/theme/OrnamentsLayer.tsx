// docs/site.md section 7.7. Fixed layer of five inline SVG Christmas
// ornaments hanging below the header band behind every page except the
// live screen when `settings.theme.ornaments` is true. Colours come from
// the `--orn-*` tokens, the whole layer is dimmed by `--orn-opacity`
// (0.55 light, 0.4 dark, 0.3 below 640 px), and the top offset follows
// the shell's `--header-height`. The sway keyframe is on by default and
// the reduced-motion query in tokens.css zeroes it, leaving the sway
// class present but silent so tests can assert its presence.

import { useSyncExternalStore } from "react";
import { useStore } from "../../store/useStore";
import type { ContentBundle } from "../../store/types";
import * as styles from "./OrnamentsLayer.module.css";

type Ornament = {
  leftCss: string;
  stringLengthPx: number;
  spherePx: number;
  color: "red" | "green" | "blue" | "gold" | "frost";
  swaySeconds: number;
  swayDelaySeconds: number;
};

// Positions are fixed viewport percentages spread across the width; the
// cards in front of the layer are opaque, so the ornaments show in the
// hero band and the gaps between cards.
const ORNAMENTS: readonly Ornament[] = [
  {
    leftCss: "6%",
    stringLengthPx: 96,
    spherePx: 68,
    color: "red",
    swaySeconds: 7,
    swayDelaySeconds: 0,
  },
  {
    leftCss: "22%",
    stringLengthPx: 64,
    spherePx: 72,
    color: "green",
    swaySeconds: 9,
    swayDelaySeconds: 0.6,
  },
  {
    leftCss: "58%",
    stringLengthPx: 140,
    spherePx: 84,
    color: "blue",
    swaySeconds: 11,
    swayDelaySeconds: 1.2,
  },
  {
    leftCss: "78%",
    stringLengthPx: 72,
    spherePx: 64,
    color: "gold",
    swaySeconds: 8,
    swayDelaySeconds: 0.3,
  },
  {
    leftCss: "93%",
    stringLengthPx: 110,
    spherePx: 76,
    color: "frost",
    swaySeconds: 10,
    swayDelaySeconds: 0.9,
  },
];

const COLOR_CLASS: Record<Ornament["color"], string> = {
  red: styles.ornRed,
  green: styles.ornGreen,
  blue: styles.ornBlue,
  gold: styles.ornGold,
  frost: styles.ornFrost,
};

function useIsLiveScreen(): boolean {
  const eventStatusId = useStore((s) => s.live?.eventStatusId ?? null);
  return eventStatusId === 3;
}

function subscribeReducedMotion(cb: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function getReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function OrnamentsLayer({ bundle }: { bundle: ContentBundle | null }) {
  const isLive = useIsLiveScreen();
  const reduced = useSyncExternalStore(subscribeReducedMotion, getReducedMotion, () => false);
  const enabled = (bundle?.content?.settings.theme.ornaments ?? false) && !isLive;
  if (!enabled) return null;

  return (
    <div
      className={styles.layer}
      aria-hidden
      data-testid="ornaments-layer"
      style={{
        top: "var(--header-height, 0px)",
        opacity: "var(--orn-opacity)",
      }}
    >
      {ORNAMENTS.map((o, i) => {
        const capWidth = Math.round(o.spherePx * 0.28);
        const capHeight = Math.round(o.spherePx * 0.18);
        const sphereCenterX = o.spherePx / 2;
        const sphereCenterY = o.stringLengthPx + capHeight + o.spherePx / 2;
        const totalWidth = o.spherePx;
        const totalHeight = o.stringLengthPx + capHeight + o.spherePx;
        const swayClass = reduced ? "" : ` ${styles.sway}`;
        return (
          <span
            key={i}
            className={`${styles.ornament}${swayClass}`}
            style={{
              left: o.leftCss,
              width: `${totalWidth}px`,
              height: `${totalHeight}px`,
              animationDuration: `${o.swaySeconds}s`,
              animationDelay: `${o.swayDelaySeconds}s`,
            }}
            data-testid={`ornament-${i}`}
            data-sway={reduced ? "off" : "on"}
          >
            <svg
              viewBox={`0 0 ${totalWidth} ${totalHeight}`}
              width={totalWidth}
              height={totalHeight}
              aria-hidden
              focusable="false"
            >
              <line
                x1={sphereCenterX}
                y1={0}
                x2={sphereCenterX}
                y2={o.stringLengthPx}
                className={styles.string}
              />
              <rect
                x={sphereCenterX - capWidth / 2}
                y={o.stringLengthPx}
                width={capWidth}
                height={capHeight}
                rx={1}
                className={styles.cap}
              />
              <circle
                cx={sphereCenterX}
                cy={sphereCenterY}
                r={o.spherePx / 2}
                className={`${styles.sphere} ${COLOR_CLASS[o.color]}`}
                data-testid={`ornament-sphere-${o.color}`}
                data-orn-color={o.color}
              />
              <ellipse
                cx={sphereCenterX - o.spherePx * 0.16}
                cy={sphereCenterY - o.spherePx * 0.18}
                rx={o.spherePx * 0.14}
                ry={o.spherePx * 0.09}
                className={styles.highlight}
              />
            </svg>
          </span>
        );
      })}
    </div>
  );
}

export default OrnamentsLayer;
