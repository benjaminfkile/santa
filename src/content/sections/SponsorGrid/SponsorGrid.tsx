// docs/site.md sections 6d and 7.4. SponsorGrid: every sponsor in snapshot
// order. The first three render as large cards, the rest in a four-column
// grid that collapses to one at phone width. No tiers, no amounts.

import type { SectionComponent } from "../../registry";
import type { MediaRef, Sponsor } from "../../../contracts";
import type { ContentBundle } from "../../../store/types";
import { Inline } from "../../inline/Inline";
import { Media } from "../../primitives/Media";
import { useSnapshotEvent } from "../../blocks/useSnapshotEvent";
import { useStore } from "../../../store/useStore";
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

function SponsorCard({
  sponsor,
  bundle,
  showYears,
  big,
}: {
  sponsor: Sponsor;
  bundle: ContentBundle;
  showYears: boolean;
  big: boolean;
}) {
  const media: MediaRef | null = sponsor.logoMediaId
    ? { mediaId: sponsor.logoMediaId, alt: sponsor.name ?? null }
    : null;
  const years = showYears ? yearsCopy(sponsor.yearsAsSponsor) : null;
  return (
    <li className={`${styles.sponsorGridCard}${big ? " " + styles.sponsorGridCardBig : ""}`}>
      {media ? (
        <Media
          media={media}
          bundle={bundle}
          sizeOverride={big ? "64px" : "48px"}
          className={styles.sponsorGridLogo}
          testId="sponsor-logo"
        />
      ) : (
        <span className={styles.sponsorGridLogo} aria-hidden />
      )}
      <div className={styles.sponsorGridMeta}>
        {media ? (
          <span className={styles.sponsorGridName}>{sponsor.name}</span>
        ) : (
          <span className={styles.sponsorGridNameFallback}>{sponsor.name}</span>
        )}
        {years ? <span className={styles.sponsorGridYears}>{years}</span> : null}
        {sponsor.websiteUrl || sponsor.fbUrl || sponsor.igUrl ? (
          <ul className={styles.sponsorGridLinks}>
            {sponsor.websiteUrl ? (
              <li>
                <a href={sponsor.websiteUrl} target="_blank" rel="noopener noreferrer">
                  Website
                </a>
              </li>
            ) : null}
            {sponsor.fbUrl ? (
              <li>
                <a href={sponsor.fbUrl} target="_blank" rel="noopener noreferrer">
                  Facebook
                </a>
              </li>
            ) : null}
            {sponsor.igUrl ? (
              <li>
                <a href={sponsor.igUrl} target="_blank" rel="noopener noreferrer">
                  Instagram
                </a>
              </li>
            ) : null}
          </ul>
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

  const top = list.slice(0, 3);
  const rest = list.slice(3);
  return (
    <div className={styles.sponsorGrid}>
      {d.heading ? (
        <h2 className={styles.sponsorGridHeading}>
          <Inline text={d.heading} bundle={bundle} event={event} />
        </h2>
      ) : null}
      <ul className={styles.sponsorGridTop} data-testid="sponsor-grid-top">
        {top.map((sponsor) => (
          <SponsorCard
            key={sponsor.id ?? sponsor.name}
            sponsor={sponsor}
            bundle={bundle}
            showYears={showYears}
            big
          />
        ))}
      </ul>
      {rest.length > 0 ? (
        <ul className={styles.sponsorGridRest} data-testid="sponsor-grid-rest">
          {rest.map((sponsor) => (
            <SponsorCard
              key={sponsor.id ?? sponsor.name}
              sponsor={sponsor}
              bundle={bundle}
              showYears={showYears}
              big={false}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
};
