// docs/site.md section 7.3. Renders an icon as <img>; never inline SVG.

import type { IconRef } from "../../contracts";
import type { ContentBundle } from "../../store/types";
import { resolveIcon } from "./resolve";

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
  const src = resolveIcon(bundle, icon);
  if (src === null) return null;
  const px = size ?? (inline ? INLINE_SIZE : DEFAULT_SIZE);
  const isDecorative = decorative || alt === "";
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
