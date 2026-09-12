// docs/site.md section 7.2. Turns a section's presentation into layout.
// The `map` section ignores width and spacing.

import type { CSSProperties, ReactNode } from "react";
import type { Presentation } from "../contracts";
import type { ContentBundle } from "../store/types";
import { Icon } from "./primitives/Icon";
import { Media } from "./primitives/Media";
import * as styles from "./SectionFrame.module.css";

export type SectionFrameProps = {
  presentation: Presentation;
  bundle: ContentBundle;
  kind: string;
  children: ReactNode;
};

const WIDTH_CLASS = {
  full: styles.widthFull,
  wide: styles.widthWide,
  narrow: styles.widthNarrow,
} as const;

const SPACING_CLASS = {
  tight: styles.spacingTight,
  normal: styles.spacingNormal,
  loose: styles.spacingLoose,
  none: styles.spacingNone,
} as const;

const ALIGN_CLASS = {
  start: styles.alignStart,
  center: styles.alignCenter,
} as const;

const BG_TOKEN_CLASS: Record<string, string | undefined> = {
  surface: styles.bgSurface,
  muted: styles.bgMuted,
  accent: styles.bgAccent,
  night: styles.bgNight,
};

export function SectionFrame({ presentation, bundle, kind, children }: SectionFrameProps) {
  const isMap = kind === "map";
  const width = isMap ? "full" : presentation.width;
  const spacing = isMap ? "none" : presentation.spacing;
  const bg = presentation.background;

  const style: CSSProperties = {};
  const classes = [
    styles.sectionFrame,
    WIDTH_CLASS[width],
    ALIGN_CLASS[presentation.align],
    SPACING_CLASS[spacing],
  ];

  if (bg.kind === "token") {
    const c = BG_TOKEN_CLASS[bg.token];
    if (c) classes.push(c);
  } else if (bg.kind === "media") {
    style.position = "relative";
  }

  return (
    <section
      id={presentation.anchor ?? undefined}
      className={classes.filter(Boolean).join(" ")}
      style={style}
      data-section-kind={kind}
      data-width={width}
      data-spacing={spacing}
      data-align={presentation.align}
      data-bg={bg.kind === "token" ? bg.token : bg.kind}
      data-testid={`section-${kind}`}
    >
      {bg.kind === "media" ? (
        <div className={styles.background} aria-hidden data-overlay={bg.overlay} data-testid="section-frame-background">
          <Media
            media={bg.media}
            bundle={bundle}
            frame={width}
            loading="eager"
            className={styles.backgroundMedia}
          />
          <div
            aria-hidden
            className={styles.backgroundOverlay}
            style={{
              backgroundColor: `color-mix(in srgb, var(--ground) ${Math.round(bg.overlay * 100)}%, transparent)`,
            }}
          />
        </div>
      ) : null}
      {presentation.iconBefore !== null ? (
        <div className={styles.iconBefore} aria-hidden data-testid="section-frame-icon-before">
          <Icon icon={presentation.iconBefore} bundle={bundle} alt="" decorative />
        </div>
      ) : null}
      <div className={styles.content}>{children}</div>
      {presentation.iconAfter !== null ? (
        <div className={styles.iconAfter} aria-hidden data-testid="section-frame-icon-after">
          <Icon icon={presentation.iconAfter} bundle={bundle} alt="" decorative />
        </div>
      ) : null}
    </section>
  );
}
