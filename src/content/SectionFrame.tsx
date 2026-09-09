// docs/site.md section 7.2. Turns a section's presentation into layout.
// The `map` section ignores width and spacing.

import type { CSSProperties, ReactNode } from "react";
import type { Presentation } from "../contracts";
import type { ContentBundle } from "../store/types";
import { Icon } from "./primitives/Icon";
import { Media } from "./primitives/Media";

export type SectionFrameProps = {
  presentation: Presentation;
  bundle: ContentBundle;
  kind: string;
  children: ReactNode;
};

export function SectionFrame({ presentation, bundle, kind, children }: SectionFrameProps) {
  const isMap = kind === "map";
  const width = isMap ? "full" : presentation.width;
  const spacing = isMap ? "none" : presentation.spacing;
  const bg = presentation.background;

  const style: CSSProperties = {};
  const classes = [
    "section-frame",
    `section-frame--width-${width}`,
    `section-frame--align-${presentation.align}`,
    `section-frame--spacing-${spacing}`,
  ];

  if (bg.kind === "token") {
    classes.push(`section-frame--bg-${bg.token}`);
  } else if (bg.kind === "media") {
    classes.push("section-frame--bg-media");
    style.position = "relative";
  }

  return (
    <section
      id={presentation.anchor ?? undefined}
      className={classes.join(" ")}
      style={style}
      data-section-kind={kind}
      data-width={width}
      data-spacing={spacing}
      data-testid={`section-${kind}`}
    >
      {bg.kind === "media" ? (
        <div className="section-frame__background" aria-hidden data-overlay={bg.overlay}>
          <Media
            media={bg.media}
            bundle={bundle}
            frame={width}
            loading="eager"
            className="section-frame__background-media"
          />
          <div
            className="section-frame__background-overlay"
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: `rgba(0, 0, 0, ${bg.overlay})`,
            }}
          />
        </div>
      ) : null}
      {presentation.iconBefore !== null ? (
        <div className="section-frame__icon-before" aria-hidden>
          <Icon icon={presentation.iconBefore} bundle={bundle} alt="" decorative />
        </div>
      ) : null}
      <div className="section-frame__content">{children}</div>
      {presentation.iconAfter !== null ? (
        <div className="section-frame__icon-after" aria-hidden>
          <Icon icon={presentation.iconAfter} bundle={bundle} alt="" decorative />
        </div>
      ) : null}
    </section>
  );
}
