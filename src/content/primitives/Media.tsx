// docs/site.md section 7.3. Media primitive with srcset and sizes. An
// entry with a dark version renders two images, the light one hidden in
// dark mode and the dark one (its own srcset from its variants) hidden
// otherwise, both with the same alt; the hidden one is `display: none`
// and so out of the accessibility tree. An entry with `invertInDark` and
// no dark version renders one image that CSS inverts in dark mode.
// `data-dark-mode` names the rule each image carries. An entry with a
// small version (`small.url`) draws two branches: the entry as above
// hidden under 760 px, and the small version (its own srcset, dark, and
// invertInDark, composed the same way) hidden at 760 px and up;
// `data-screen` names the branch. `small={false}` draws the entry alone.
// A ref with `display` renders inside a wrapper from `displayStyle`,
// which sizes the box, fits and shapes the image, and places the wrapper.

import type { CSSProperties } from "react";
import type { MediaRef } from "../../contracts";
import type { ContentBundle } from "../../store/types";
import { resolveMedia } from "./resolve";
import * as darkStyles from "./DarkMedia.module.css";
import { displayStyle, readDisplay } from "./display";

// Which dark mode rule an image carries: shown only in light mode, shown
// only in dark mode, or inverted in dark mode.
export type DarkMode = "light" | "dark" | "invert";

// Which screen width an image draws at when the entry has a small version:
// 760 px and up, or under 760 px.
export type Screen = "wide" | "small";

type Box = { width?: number; height?: number };

type DarkSource = {
  url: string;
  variants: Record<string, string | undefined>;
  dark: { url?: string; variants?: Record<string, string | undefined> } | null;
  invertInDark: boolean;
};

export type FrameWidth = "full" | "wide" | "narrow";

export type MediaProps = {
  media: MediaRef;
  bundle: ContentBundle;
  frame?: FrameWidth;
  sizeOverride?: string;
  loading?: "lazy" | "eager";
  className?: string;
  testId?: string;
  // Whether the entry's small version draws under 760 px (default true).
  small?: boolean;
};

const SIZES_BY_FRAME: Record<FrameWidth, string> = {
  full: "100vw",
  wide: "(min-width: 1200px) 1200px, 100vw",
  narrow: "(min-width: 720px) 720px, 100vw",
};

const RASTER_KINDS = new Set(["raster", "jpeg", "png", "webp", "avif", "jpg"]);

function isRasterKind(kind: string | undefined): boolean {
  if (!kind) return true;
  const lower = kind.toLowerCase();
  if (lower === "svg" || lower === "gif") return false;
  return RASTER_KINDS.has(lower) || !["svg", "gif"].includes(lower);
}

export function Media(props: MediaProps) {
  const display = readDisplay(props.media.display);
  if (display === null) return <MediaBody {...props} />;
  const d = displayStyle(display, "media");
  const sizeOverride = d.sizePx !== null ? `${d.sizePx}px` : props.sizeOverride;
  return (
    <span className={d.className} style={d.style} data-display="media" {...d.data}>
      <MediaBody {...props} sizeOverride={sizeOverride} imageStyle={d.imageStyle} />
    </span>
  );
}

function MediaBody({
  media,
  bundle,
  frame = "full",
  sizeOverride,
  loading = "lazy",
  className,
  testId,
  small = true,
  imageStyle,
}: MediaProps & { imageStyle?: CSSProperties }) {
  const entry = resolveMedia(bundle, media.mediaId);
  const alt = media.alt ?? entry?.alt ?? "";
  if (entry === null) {
    return (
      <span
        className={className}
        data-missing-media={media.mediaId}
        data-testid={testId}
        role="img"
        aria-label={alt}
      />
    );
  }
  const url = entry.url ?? "";
  const width = entry.width ?? undefined;
  const height = entry.height ?? undefined;
  const raster = isRasterKind(entry.kind);
  const sizes = sizeOverride ?? SIZES_BY_FRAME[frame];

  const image = (
    src: string,
    variants: Record<string, string | undefined>,
    originalWidth: number | undefined,
    box: Box,
    classes: (string | undefined)[],
    darkMode?: DarkMode,
    screen?: Screen,
  ) => {
    const srcSet = raster ? buildSrcSet(src, variants, originalWidth) : undefined;
    return (
      <img
        src={src}
        srcSet={srcSet}
        sizes={srcSet ? sizes : undefined}
        alt={alt}
        width={box.width}
        height={box.height}
        loading={loading}
        decoding="async"
        className={joinClasses(className, ...classes)}
        style={imageStyle}
        data-dark-mode={darkMode}
        data-screen={screen}
        data-testid={testId}
      />
    );
  };

  // One branch: the dark swap for a source, as light and dark images, one
  // inverting image, or one plain image, each also carrying `screenClass`.
  const branch = (source: DarkSource, box: Box, screenClass?: string, screen?: Screen) => {
    const darkUrl = source.dark?.url || null;
    if (darkUrl !== null) {
      return (
        <>
          {image(source.url, source.variants, box.width, box, [darkStyles.lightOnly, screenClass], "light", screen)}
          {image(darkUrl, source.dark?.variants ?? {}, undefined, box, [darkStyles.darkOnly, screenClass], "dark", screen)}
        </>
      );
    }
    if (source.invertInDark) return image(source.url, source.variants, box.width, box, [darkStyles.invertInDark, screenClass], "invert", screen);
    return image(source.url, source.variants, box.width, box, [screenClass], undefined, screen);
  };

  const main: DarkSource = {
    url,
    variants: entry.variants ?? {},
    dark: entry.dark ?? null,
    invertInDark: entry.invertInDark === true,
  };
  const smallUrl = (small && entry.small?.url) || null;
  const mainBox: Box = { width, height };
  if (smallUrl === null) return branch(main, mainBox);
  const smallSource: DarkSource = {
    url: smallUrl,
    variants: entry.small?.variants ?? {},
    dark: entry.small?.dark ?? null,
    invertInDark: entry.small?.invertInDark === true,
  };
  return (
    <>
      {branch(main, mainBox, darkStyles.wideOnly, "wide")}
      {branch(smallSource, {}, darkStyles.smallOnly, "small")}
    </>
  );
}

function buildSrcSet(url: string, variants: Record<string, string | undefined>, width: number | undefined): string | undefined {
  const parts: string[] = [];
  const seen = new Set<string>();
  for (const [key, value] of Object.entries(variants)) {
    if (value === undefined) continue;
    const w = Number(key);
    if (!Number.isFinite(w)) continue;
    parts.push(`${value} ${w}w`);
    seen.add(String(w));
  }
  if (width !== undefined && !seen.has(String(width))) {
    parts.push(`${url} ${width}w`);
  }
  return parts.length > 0 ? parts.join(", ") : undefined;
}

function joinClasses(...names: (string | undefined)[]): string | undefined {
  const joined = names.filter(Boolean).join(" ");
  return joined === "" ? undefined : joined;
}
