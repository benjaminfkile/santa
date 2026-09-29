// docs/site.md section 7.3 and 7.7. The Icon primitive renders a library
// id inline through a generated SVG component (so it takes the accent),
// and a media id (or an unknown library id) through <img>. A media icon
// with a dark version renders a second <img> and CSS shows one per theme;
// one with `invertInDark` and no dark version is inverted in dark mode.
// An icon with `display` renders inside a wrapper from `displayStyle`;
// its `sizePx` beats the `size` the caller passes. `iconResolves` says
// whether an icon draws anything at all.

import type { CSSProperties } from "react";
import type { IconRef } from "../../contracts";
import type { ContentBundle } from "../../store/types";
import { resolveIcon, resolveIconDark } from "./resolve";
import * as darkStyles from "./DarkMedia.module.css";
import type { DarkMode } from "./Media";
import { LIBRARY_ICONS } from "../icons/generated";
import { displayStyle, readDisplay } from "./display";

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

export function Icon(props: IconProps) {
  const display = readDisplay(props.icon.display);
  if (display === null) return <IconBody {...props} />;
  if (!iconResolves(props.icon, props.bundle)) return null;
  const d = displayStyle(display, "icon");
  const px = d.sizePx ?? props.size ?? (props.inline ? INLINE_SIZE : DEFAULT_SIZE);
  const body = <IconBody {...props} size={px} imageStyle={d.imageStyle} />;
  return (
    <span className={d.className} style={{ width: px, height: px, ...d.style }} data-display="icon" {...d.data}>
      {body}
    </span>
  );
}

export function iconResolves(icon: IconRef, bundle: ContentBundle): boolean {
  if (icon.source === "library" && LIBRARY_ICONS[icon.id]) return true;
  return resolveIcon(bundle, icon) !== null;
}

function IconBody({ icon, bundle, alt = "", decorative = false, inline = false, size, imageStyle }: IconProps & { imageStyle?: CSSProperties }) {
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
      style={imageStyle}
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
