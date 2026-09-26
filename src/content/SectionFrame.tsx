// docs/site.md section 7.2. Turns a section's presentation into layout.
// The `map` section ignores width and spacing. Every content kind except
// `hero`, `map`, `divider`, and `countdown` renders inside a card built
// only from tokens (panel fill, line border, radius-md, shadow, space-5
// padding on desktop, space-4 below 640 px). A card has one fixed
// maximum width and is centred whatever the section's `presentation.width`;
// cardless kinds still honour that width. A token background becomes the
// card fill; a media background is clipped inside its rounded corners. A
// section whose component renders nothing collapses the frame (no card,
// no padding, no background, no icons before or after, no space taken).

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

const CARDLESS_KINDS = new Set(["hero", "map", "divider", "countdown"]);

export function SectionFrame({ presentation, bundle, kind, children }: SectionFrameProps) {
  const isMap = kind === "map";
  const width = isMap ? "full" : presentation.width;
  const spacing = isMap ? "none" : presentation.spacing;
  const bg = presentation.background;
  const hasCard = !CARDLESS_KINDS.has(kind);

  const style: CSSProperties = {};
  const frameClasses = [
    styles.sectionFrame,
    WIDTH_CLASS[width],
    ALIGN_CLASS[presentation.align],
    SPACING_CLASS[spacing],
    hasCard ? styles.hasCard : "",
  ];

  const cardClasses = [styles.card];
  const bgClass = bg.kind === "token" ? BG_TOKEN_CLASS[bg.token] : undefined;
  if (hasCard) {
    if (bgClass) cardClasses.push(bgClass);
  } else {
    if (bgClass) frameClasses.push(bgClass);
    if (bg.kind === "media") style.position = "relative";
  }

  const background =
    bg.kind === "media" ? (
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
    ) : null;

  const iconBefore =
    presentation.iconBefore !== null ? (
      <div className={styles.iconBefore} aria-hidden data-testid="section-frame-icon-before">
        <Icon icon={presentation.iconBefore} bundle={bundle} alt="" decorative />
      </div>
    ) : null;

  const iconAfter =
    presentation.iconAfter !== null ? (
      <div className={styles.iconAfter} aria-hidden data-testid="section-frame-icon-after">
        <Icon icon={presentation.iconAfter} bundle={bundle} alt="" decorative />
      </div>
    ) : null;

  const inner = (
    <>
      {background}
      {iconBefore}
      <div className={styles.content} data-testid="section-frame-content">{children}</div>
      {iconAfter}
    </>
  );

  return (
    <section
      id={presentation.anchor ?? undefined}
      className={frameClasses.filter(Boolean).join(" ")}
      style={style}
      data-section-kind={kind}
      data-width={width}
      data-spacing={spacing}
      data-align={presentation.align}
      data-bg={bg.kind === "token" ? bg.token : bg.kind}
      data-card={hasCard ? "true" : "false"}
      data-testid={`section-${kind}`}
    >
      {hasCard ? <div className={cardClasses.filter(Boolean).join(" ")}>{inner}</div> : inner}
    </section>
  );
}
