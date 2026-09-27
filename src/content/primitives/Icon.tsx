// docs/site.md section 7.3 and 7.7. The Icon primitive renders a library
// id inline through a generated SVG component (so it takes the accent),
// and a media id (or an unknown library id) through <img>. A media icon
// with a dark version renders a second <img> and CSS shows one per theme;
// one with `invertInDark` and no dark version is inverted in dark mode.

import type { IconRef } from "../../contracts";
import type { ContentBundle } from "../../store/types";
import { resolveIcon, resolveIconDark } from "./resolve";
import * as darkStyles from "./DarkMedia.module.css";
import type { DarkMode } from "./Media";
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
  const { dark, invertInDark } = resolveIconDark(bundle, icon);
  const image = (url: string, className?: string, darkMode?: DarkMode) => (
    <img
      src={url}
      alt={isDecorative ? "" : alt}
      aria-hidden={isDecorative || undefined}
      width={px}
      height={px}
      loading="lazy"
      decoding="async"
      className={className}
      data-dark-mode={darkMode}
      data-icon-source={icon.source}
    />
  );
  if (dark !== null) {
    return (
      <>
        {image(src, darkStyles.lightOnly, "light")}
        {image(dark, darkStyles.darkOnly, "dark")}
      </>
    );
  }
  return invertInDark ? image(src, darkStyles.invertInDark, "invert") : image(src);
}
