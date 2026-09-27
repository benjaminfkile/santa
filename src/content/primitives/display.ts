// docs/site.md section 7.3. The `display` setting an icon or a media ref
// may carry, turned into a wrapper's class names and style. Each key is
// read on its own; a value outside the contract's range or enum is
// ignored. `sizePx` is the box size and beats any preset size the caller
// passes; `fit` is the image's object-fit; `shape`, `background`, and
// `shadow` are classes from Display.module.css (radius, theme token fill,
// var(--shadow)); `paddingPx` pads the wrapper; `align` places the
// wrapper in its line. `data` names each applied key as a data
// attribute on the wrapper.

import type { CSSProperties } from "react";
import type { Display } from "../../contracts/generated/content-document";
import * as styles from "./Display.module.css";

export type DisplayTarget = "icon" | "media";

export type DisplayResult = {
  className: string;
  style: CSSProperties;
  imageStyle: CSSProperties;
  sizePx: number | null;
  data: Record<string, string>;
};

// The classes for each value that changes the look; a value missing
// here ("none", or one outside the schema) adds nothing.
const SHAPE_CLASS: Record<string, string | undefined> = {
  circle: styles.shapeCircle,
  rounded: styles.shapeRounded,
  square: styles.shapeSquare,
};

const BACKGROUND_CLASS: Record<string, string | undefined> = {
  surface: styles.bgSurface,
  muted: styles.bgMuted,
  accent: styles.bgAccent,
  night: styles.bgNight,
};

const ALIGN_CLASS: Record<string, string | undefined> = {
  start: styles.alignStart,
  center: styles.alignCenter,
  end: styles.alignEnd,
};

function inRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

// The display object when it is one, else null. A null result means the
// caller renders exactly as it would with no display.
export function readDisplay(value: unknown): Display | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Display;
}

// The valid `sizePx` of a display, else null.
export function displaySizePx(value: unknown): number | null {
  const d = readDisplay(value);
  return d !== null && inRange(d.sizePx, 12, 600) ? d.sizePx : null;
}

export function displayStyle(value: unknown, target: DisplayTarget = "media"): DisplayResult {
  const d = readDisplay(value) ?? {};
  const classes: (string | undefined)[] = [target === "icon" ? styles.displayIcon : styles.displayMedia];
  const style: CSSProperties = {};
  const imageStyle: CSSProperties = {};
  const data: Record<string, string> = {};
  const sizePx = displaySizePx(d);
  const cover = d.fit === "cover";

  if (d.fit === "contain" || cover) imageStyle.objectFit = d.fit;
  if (sizePx !== null) {
    imageStyle.maxWidth = "100%";
    if (target === "icon") {
      style.width = sizePx;
      style.height = sizePx;
    } else if (cover) {
      style.width = sizePx;
      style.height = sizePx;
      imageStyle.width = "100%";
      imageStyle.height = "100%";
    } else {
      style.width = sizePx;
      imageStyle.width = "100%";
      imageStyle.height = "auto";
    }
  }
  if (inRange(d.paddingPx, 0, 48)) style.padding = d.paddingPx;

  if (typeof d.shape === "string" && Object.hasOwn(SHAPE_CLASS, d.shape)) {
    classes.push(SHAPE_CLASS[d.shape]);
    data["data-display-shape"] = d.shape;
  }
  if (typeof d.background === "string" && Object.hasOwn(BACKGROUND_CLASS, d.background)) {
    classes.push(BACKGROUND_CLASS[d.background]);
    data["data-display-background"] = d.background;
  }
  if (d.shadow === true) {
    classes.push(styles.shadow);
    data["data-display-shadow"] = "true";
  }
  if (typeof d.align === "string" && Object.hasOwn(ALIGN_CLASS, d.align)) {
    classes.push(ALIGN_CLASS[d.align]);
    data["data-display-align"] = d.align;
  }

  return { className: classes.filter(Boolean).join(" "), style, imageStyle, sizePx, data };
}
