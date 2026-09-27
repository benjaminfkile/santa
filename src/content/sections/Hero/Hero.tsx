// docs/site.md section 7.4. Hero section: eyebrow in mono accent, title as
// <h1> in Bricolage, tagline capped at 56ch, icon above the title, up to
// two links in the fill and outline recipes. `iconSize` sizes the icon: a
// library icon sits in a round badge of that size with the glyph at 60
// percent, a media icon renders at that size uncropped with no badge.
// `showLogo` true draws the site logo in place of the icon, its height
// taken from the same size table; with no logo set the icon stays.

import type { IconRef, Link } from "../../../contracts";
import type { SectionComponent } from "../../registry";
import { Inline } from "../../inline/Inline";
import { Icon } from "../../primitives/Icon";
import { ContentLink } from "../../primitives/LinkView";
import { useSnapshotEvent } from "../../blocks/useSnapshotEvent";
import { Logo } from "../../Logo";
import { HERO_ICON_SIZES, iconSizeKey } from "../../iconSizes";
import * as styles from "./Hero.module.css";

type HeroData = {
  title?: string;
  tagline?: string | null;
  eyebrow?: string | null;
  icon?: IconRef | null;
  links?: Link[];
  height?: "short" | "tall";
  iconSize?: "sm" | "md" | "lg" | "xl" | null;
  showLogo?: boolean | null;
  paired?: boolean;
};

function readData(data: unknown): HeroData {
  if (data === null || typeof data !== "object") return {};
  return data as HeroData;
}

export const Hero: SectionComponent = ({ data, bundle }) => {
  const d = readData(data);
  const height = d.height ?? "tall";
  const links = Array.isArray(d.links) ? d.links.slice(0, 2) : [];
  const event = useSnapshotEvent();
  const iconPx = HERO_ICON_SIZES[iconSizeKey(d.iconSize)];
  const iconIsMedia = d.icon?.source === "media";
  const drawLogo = d.showLogo === true && (bundle.content?.settings?.logoMedia ?? null) !== null;
  const rootClass = [
    styles.hero,
    height === "tall" ? styles.heroTall : styles.heroShort,
    d.paired === true ? styles.heroPaired : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={rootClass}>
      {drawLogo ? (
        <Logo bundle={bundle} height={iconPx} className={styles.heroLogo} testId="hero-logo" />
      ) : d.icon ? (
        <div
          className={iconIsMedia ? styles.heroIconMedia : styles.heroIcon}
          style={{ width: iconPx, height: iconPx }}
          aria-hidden
          data-testid="hero-icon"
          data-icon-size={iconPx}
          data-icon-badge={iconIsMedia ? "false" : "true"}
        >
          <Icon icon={d.icon} bundle={bundle} decorative size={iconPx} />
        </div>
      ) : null}
      {d.eyebrow ? (
        <p className={styles.heroEyebrow}>
          <Inline text={d.eyebrow} bundle={bundle} event={event} />
        </p>
      ) : null}
      <h1 className={styles.heroTitle}>
        <Inline text={d.title ?? ""} bundle={bundle} event={event} />
      </h1>
      {d.tagline ? (
        <p className={styles.heroTagline}>
          <Inline text={d.tagline} bundle={bundle} event={event} />
        </p>
      ) : null}
      {links.length > 0 ? (
        <div className={styles.heroLinks}>
          {links.map((link, i) => (
            <ContentLink
              key={i}
              link={link}
              bundle={bundle}
              className={`${styles.heroLink} ${i === 0 ? styles.heroLinkPrimary : styles.heroLinkSecondary}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};
