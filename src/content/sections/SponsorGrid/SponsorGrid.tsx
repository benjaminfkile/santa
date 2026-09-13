// docs/site.md section 7.4. SponsorGrid: every sponsor in snapshot order
// as equal cards in one responsive grid (repeat(auto-fill, minmax(280px,
// 1fr)), 16 px gap, rows stretch to the tallest card). A card is the
// name heading, the logo in a fixed 3:2 box (object-fit: contain, the
// name as large text when there is no logo), then a bottom row with the
// years line at the left and the icon links (globe, Facebook, Instagram)
// at the right. The whole card is a link to the first non-null of
// websiteUrl, fbUrl, igUrl (new tab); the icon links are separate <a>s
// above the whole-card link in the tab order. Frost card recipe.

import type { SectionComponent } from "../../registry";
import type { MediaRef, Sponsor } from "../../../contracts";
import type { ContentBundle } from "../../../store/types";
import { Inline } from "../../inline/Inline";
import { Media } from "../../primitives/Media";
import { useSnapshotEvent } from "../../blocks/useSnapshotEvent";
import { useStore } from "../../../store/useStore";
import { GlobeIcon } from "../../icons/generated/globe";
import { FacebookIcon } from "../../icons/generated/facebook";
import { InstagramIcon } from "../../icons/generated/instagram";
import * as styles from "./SponsorGrid.module.css";

type SponsorGridData = {
  heading?: string | null;
  showYears?: boolean;
  emptyText?: string | null;
};

function yearsCopy(years: number | undefined): string | null {
  if (typeof years !== "number" || years <= 0) return null;
  return years === 1 ? "Sponsor for 1 year" : `Sponsor for ${years} years`;
}

function cardHref(s: Sponsor): string | null {
  return s.websiteUrl ?? s.fbUrl ?? s.igUrl ?? null;
}

function SponsorCard({
  sponsor,
  bundle,
  showYears,
}: {
  sponsor: Sponsor;
  bundle: ContentBundle;
  showYears: boolean;
}) {
  const media: MediaRef | null = sponsor.logoMediaId
    ? { mediaId: sponsor.logoMediaId, alt: sponsor.name ?? null }
    : null;
  const years = showYears ? yearsCopy(sponsor.yearsAsSponsor) : null;
  const href = cardHref(sponsor);
  const iconLinks: {
    key: string;
    href: string;
    label: string;
    Icon: typeof GlobeIcon;
  }[] = [];
  if (sponsor.websiteUrl) {
    iconLinks.push({ key: "web", href: sponsor.websiteUrl, label: "Website", Icon: GlobeIcon });
  }
  if (sponsor.fbUrl) {
    iconLinks.push({ key: "fb", href: sponsor.fbUrl, label: "Facebook", Icon: FacebookIcon });
  }
  if (sponsor.igUrl) {
    iconLinks.push({ key: "ig", href: sponsor.igUrl, label: "Instagram", Icon: InstagramIcon });
  }

  return (
    <li className={styles.sponsorGridItem} data-testid="sponsor-card">
      <div className={styles.sponsorGridCard}>
        <h3 className={styles.sponsorGridName}>{sponsor.name}</h3>
        <div className={styles.sponsorGridLogoBox}>
          {media ? (
            <Media
              media={media}
              bundle={bundle}
              sizeOverride="480px"
              className={styles.sponsorGridLogo}
              testId="sponsor-logo"
            />
          ) : (
            <span className={styles.sponsorGridNameLarge}>{sponsor.name}</span>
          )}
        </div>
        <div className={styles.sponsorGridBottom}>
          <span className={styles.sponsorGridYears}>{years ?? ""}</span>
          {iconLinks.length > 0 ? (
            <ul className={styles.sponsorGridLinks}>
              {iconLinks.map(({ key, href: linkHref, label, Icon }) => (
                <li key={key}>
                  <a
                    href={linkHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className={styles.sponsorGridIconLink}
                  >
                    <Icon />
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={sponsor.name ?? "Sponsor"}
            className={styles.sponsorGridCardLink}
            data-testid="sponsor-card-link"
          />
        ) : null}
      </div>
    </li>
  );
}

export const SponsorGrid: SectionComponent = ({ data, bundle }) => {
  const d = (data ?? {}) as SponsorGridData;
  const showYears = d.showYears !== false;
  const emptyText = d.emptyText ?? null;
  const sponsors = useStore((s) => s.snapshot?.sponsors ?? null);
  const event = useSnapshotEvent();

  const list = sponsors ?? [];
  if (list.length === 0) {
    if (emptyText) {
      return (
        <div className={`${styles.sponsorGrid} ${styles.sponsorGridEmpty}`}>
          {d.heading ? (
            <h2 className={styles.sponsorGridHeading}>
              <Inline text={d.heading} bundle={bundle} event={event} />
            </h2>
          ) : null}
          <p className={styles.sponsorGridEmptyText}>
            <Inline text={emptyText} bundle={bundle} event={event} />
          </p>
        </div>
      );
    }
    return null;
  }

  return (
    <div className={styles.sponsorGrid}>
      {d.heading ? (
        <h2 className={styles.sponsorGridHeading}>
          <Inline text={d.heading} bundle={bundle} event={event} />
        </h2>
      ) : null}
      <ul className={styles.sponsorGridList} data-testid="sponsor-grid">
        {list.map((sponsor) => (
          <SponsorCard
            key={sponsor.id ?? sponsor.name}
            sponsor={sponsor}
            bundle={bundle}
            showYears={showYears}
          />
        ))}
      </ul>
    </div>
  );
};
