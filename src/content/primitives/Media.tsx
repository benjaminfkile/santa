// docs/site.md section 7.3. Media primitive with srcset and sizes.

import type { MediaRef } from "../../contracts";
import type { ContentBundle } from "../../store/types";
import { resolveMedia } from "./resolve";

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
  const kind = entry.kind;
  const width = entry.width ?? undefined;
  const height = entry.height ?? undefined;

  if (!isRasterKind(kind)) {
    return (
      <img
        src={url}
        alt={alt}
        width={width}
        height={height}
        loading={loading}
        decoding="async"
        className={className}
        data-testid={testId}
      />
    );
  }

  const variants = entry.variants ?? {};
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
  const srcSet = parts.length > 0 ? parts.join(", ") : undefined;
  const sizes = sizeOverride ?? SIZES_BY_FRAME[frame];

  return (
    <img
      src={url}
      srcSet={srcSet}
      sizes={srcSet ? sizes : undefined}
      alt={alt}
      width={width}
      height={height}
      loading={loading}
      decoding="async"
      className={className}
      data-testid={testId}
    />
  );
}
