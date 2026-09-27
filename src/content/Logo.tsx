// docs/site.md section 7.3. The site logo: the site settings `logoMedia`
// drawn through the Media primitive at a given height with the width
// following the image's aspect ratio, uncropped and with no badge. The alt
// text is the MediaRef alt, else the asset's alt, else the site name.
// Renders nothing when `logoMedia` is absent or null.

import type { ContentBundle } from "../store/types";
import { Media } from "./primitives/Media";
import { resolveMedia } from "./primitives/resolve";
import * as styles from "./Logo.module.css";

export type LogoProps = {
  bundle: ContentBundle;
  // Height in pixels; when left out the height comes from `className`.
  height?: number;
  className?: string;
  testId?: string;
};

export function Logo({ bundle, height, className, testId = "site-logo" }: LogoProps) {
  const settings = bundle.content?.settings;
  const ref = settings?.logoMedia ?? null;
  if (ref === null || settings === undefined) return null;
  const alt = nonEmpty(ref.alt) ?? nonEmpty(resolveMedia(bundle, ref.mediaId)?.alt) ?? settings.siteName;
  return (
    <span
      className={[styles.logo, className].filter(Boolean).join(" ")}
      style={height !== undefined ? { height } : undefined}
      data-testid={testId}
      data-logo-height={height}
    >
      <Media
        media={{ ...ref, alt }}
        bundle={bundle}
        loading="eager"
        sizeOverride={height !== undefined ? `${height * 4}px` : "200px"}
      />
    </span>
  );
}

function nonEmpty(value: string | null | undefined): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}
