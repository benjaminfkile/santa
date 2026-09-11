// docs/site.md section 7.3 and 7.7. The Icon primitive renders a library
// id inline through a generated SVG component (so it takes the accent),
// and a media id (or an unknown library id) through <img>.

import type { IconRef } from "../../contracts";
import type { ContentBundle } from "../../store/types";
import { resolveIcon } from "./resolve";
import { LIBRARY_ICONS } from "../icons/generated";

const INLINE_SIZE = 16;
const DEFAULT_SIZE = 24;

export type IconProps = {
  icon: IconRef;
  bundle: ContentBundle;
  alt?: string;
  decorative?: boolean;
  inline?: boolean;
  size?: number;
};

export function Icon({ icon, bundle, alt = "", decorative = false, inline = false, size }: IconProps) {
  const px = size ?? (inline ? INLINE_SIZE : DEFAULT_SIZE);
  const isDecorative = decorative || alt === "";

  if (icon.source === "library") {
    const Generated = LIBRARY_ICONS[icon.id];
    if (Generated) {
      return (
        <Generated
          width={px}
          height={px}
          role={isDecorative ? undefined : "img"}
          aria-label={isDecorative ? undefined : alt}
          aria-hidden={isDecorative || undefined}
          focusable={false}
          data-icon-source="library"
          data-icon-id={icon.id}
        />
      );
    }
  }

  const src = resolveIcon(bundle, icon);
  if (src === null) return null;
  return (
    <img
      src={src}
      alt={isDecorative ? "" : alt}
      aria-hidden={isDecorative || undefined}
      width={px}
      height={px}
      loading="lazy"
      decoding="async"
      data-icon-source={icon.source}
    />
  );
}
