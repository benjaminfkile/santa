// docs/site.md section 7.4. SponsorGrid: every sponsor in snapshot order:
// logo (name text when `logoMediaId` is null), name, links for
// `websiteUrl`, `fbUrl`, `igUrl` when non-null, `yearsAsSponsor` as
// "Sponsor for N years" when `showYears`; `emptyText` when none.

import type { CSSProperties } from "react";
import type { SectionComponent } from "../../registry";
import type { MediaRef, Sponsor } from "../../../contracts";
import type { ContentBundle } from "../../../store/types";
import { Inline } from "../../inline/Inline";
import { Media } from "../../primitives/Media";
import { useSnapshotEvent } from "../../blocks/useSnapshotEvent";
import { useStore } from "../../../store/useStore";

type SponsorGridData = {
  heading?: string | null;
  columns?: number;
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
}: {
  sponsor: Sponsor;
  bundle: ContentBundle;
  showYears: boolean;
}) {
  const media: MediaRef | null = sponsor.logoMediaId
    ? { mediaId: sponsor.logoMediaId, alt: sponsor.name ?? null }
    : null;
  const years = showYears ? yearsCopy(sponsor.yearsAsSponsor) : null;
  return (
    <li className="sponsor-grid__card">
      {media ? (
        <Media media={media} bundle={bundle} sizeOverride="200px" className="sponsor-grid__logo" />
      ) : (
        <span className="sponsor-grid__name-fallback">{sponsor.name}</span>
      )}
      <span className="sponsor-grid__name">{sponsor.name}</span>
      {sponsor.websiteUrl || sponsor.fbUrl || sponsor.igUrl ? (
        <ul className="sponsor-grid__links">
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
      {years ? <span className="sponsor-grid__years">{years}</span> : null}
    </li>
  );
}

export const SponsorGrid: SectionComponent = ({ data, bundle }) => {
  const d = (data ?? {}) as SponsorGridData;
  const columns = d.columns ?? 3;
  const showYears = d.showYears !== false;
  const emptyText = d.emptyText ?? null;
  const sponsors = useStore((s) => s.snapshot?.sponsors ?? null);
  const event = useSnapshotEvent();

  const list = sponsors ?? [];
  if (list.length === 0) {
    if (emptyText) {
      return (
        <div className="sponsor-grid sponsor-grid--empty">
          {d.heading ? (
            <h2 className="sponsor-grid__heading">
              <Inline text={d.heading} bundle={bundle} event={event} />
            </h2>
          ) : null}
          <p className="sponsor-grid__empty-text">
            <Inline text={emptyText} bundle={bundle} event={event} />
          </p>
        </div>
      );
    }
    return null;
  }

  const gridStyle: CSSProperties = { ["--sponsor-columns" as string]: columns };
  return (
    <div className="sponsor-grid">
      {d.heading ? (
        <h2 className="sponsor-grid__heading">
          <Inline text={d.heading} bundle={bundle} event={event} />
        </h2>
      ) : null}
      <ul className={`sponsor-grid__list sponsor-grid__list--cols-${columns}`} style={gridStyle}>
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
