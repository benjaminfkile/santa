// docs/site.md section 7.3. Media primitive with srcset and sizes. An
// entry with a dark version renders two images, the light one hidden in
// dark mode and the dark one (its own srcset from its variants) hidden
// otherwise, both with the same alt; the hidden one is `display: none`
// and so out of the accessibility tree. An entry with `invertInDark` and
// no dark version renders one image that CSS inverts in dark mode.
// `data-dark-mode` names the rule each image carries.

import type { MediaRef } from "../../contracts";
import type { ContentBundle } from "../../store/types";
import { resolveMedia } from "./resolve";
import * as darkStyles from "./DarkMedia.module.css";

// Which dark mode rule an image carries: shown only in light mode, shown
// only in dark mode, or inverted in dark mode.
export type DarkMode = "light" | "dark" | "invert";

export type FrameWidth = "full" | "wide" | "narrow";

export type MediaProps = {
  media: MediaRef;
  bundle: ContentBundle;
  frame?: FrameWidth;
  sizeOverride?: string;
  loading?: "lazy" | "eager";
  className?: string;
  testId?: string;
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

export function Media({ media, bundle, frame = "full", sizeOverride, loading = "lazy", className, testId }: MediaProps) {
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
  const darkUrl = entry.dark?.url || null;

  const image = (src: string, variants: Record<string, string | undefined>, originalWidth: number | undefined, extraClass?: string, darkMode?: DarkMode) => {
    const srcSet = raster ? buildSrcSet(src, variants, originalWidth) : undefined;
    return (
      <img
        src={src}
        srcSet={srcSet}
        sizes={srcSet ? sizes : undefined}
        alt={alt}
        width={width}
        height={height}
        loading={loading}
        decoding="async"
        className={joinClasses(className, extraClass)}
        data-dark-mode={darkMode}
        data-testid={testId}
      />
    );
  };

  if (darkUrl !== null) {
    return (
      <>
        {image(url, entry.variants ?? {}, width, darkStyles.lightOnly, "light")}
        {image(darkUrl, entry.dark?.variants ?? {}, undefined, darkStyles.darkOnly, "dark")}
      </>
    );
  }
  if (entry.invertInDark === true) return image(url, entry.variants ?? {}, width, darkStyles.invertInDark, "invert");
  return image(url, entry.variants ?? {}, width);
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
