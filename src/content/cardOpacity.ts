// docs/site.md section 7.2. The card fill's opacity per theme: the
// section's value, else the sitewide theme value, else 100. The resolved
// pair is published on the card as `--card-opacity-light` and
// `--card-opacity-dark` (percentages); SectionFrame.module.css picks the
// one for the theme in use and mixes only the fill with transparent. When
// neither theme has a value below 100 nothing is emitted and the fill
// stays opaque.

import type { CSSProperties } from "react";
import type { Presentation } from "../contracts";
import type { ContentBundle } from "../store/types";

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function resolve(section: number | null | undefined, sitewide: number | null | undefined): number {
  if (typeof section === "number" && Number.isFinite(section)) return clampPercent(section);
  if (typeof sitewide === "number" && Number.isFinite(sitewide)) return clampPercent(sitewide);
  return 100;
}

export function resolveCardOpacity(
  presentation: Presentation,
  bundle: ContentBundle,
): { light: number; dark: number } {
  const theme = bundle.content?.settings?.theme;
  return {
    light: resolve(presentation.cardOpacityLight, theme?.cardOpacityLight),
    dark: resolve(presentation.cardOpacityDark, theme?.cardOpacityDark),
  };
}

export function cardOpacityStyle(presentation: Presentation, bundle: ContentBundle): CSSProperties | undefined {
  const { light, dark } = resolveCardOpacity(presentation, bundle);
  if (light === 100 && dark === 100) return undefined;
  return {
    "--card-opacity-light": `${light}%`,
    "--card-opacity-dark": `${dark}%`,
  } as CSSProperties;
}
