// docs/site.md sections 7.4 and 15. SponsorCarousel plays snapshot order
// (never shuffled): one sponsor at a time for its `lingerMs`, wraps around,
// pauses while the document is hidden. The plate shows the logo tile and
// an "N s on the tracker" line derived from `lingerMs`; a compact link
// jumps to the sponsors page.

import { useEffect, useState } from "react";
import type { SectionComponent } from "../../registry";
import type { ContentDocument, MediaRef, Sponsor } from "../../../contracts";
import { Inline } from "../../inline/Inline";
import { Media } from "../../primitives/Media";
import { ContentLink } from "../../primitives/LinkView";
import { useSnapshotEvent } from "../../blocks/useSnapshotEvent";
import { useStore } from "../../../store/useStore";
import { useReducedMotion } from "../../../lib/motion";
import "./SponsorCarousel.module.css";

type SponsorCarouselData = {
  heading?: string | null;
  logoWidth?: number;
  sponsorsPageSlug?: string | null;
  sponsorsPageLabel?: string | null;
};

const DEFAULT_LINGER_MS = 8000;

function sponsorHref(s: Sponsor): string | null {
  return s.websiteUrl ?? s.fbUrl ?? s.igUrl ?? null;
}

function lingerLabel(ms: number): string {
  const seconds = Math.max(1, Math.round(ms / 1000));
  return `${seconds}s on the tracker`;
}

function findSponsorsPage(content: ContentDocument | null | undefined, slug: string | null): string | null {
  if (!content?.pages) return null;
  if (slug) {
    const found = content.pages.find((p) => p.slug === slug && p.role === "none");
    return found ? `/${found.slug}` : null;
  }
  const found = content.pages.find((p) => p.slug === "sponsors" && p.role === "none");
  return found ? `/${found.slug}` : null;
}

export const SponsorCarousel: SectionComponent = ({ data, bundle }) => {
  const d = (data ?? {}) as SponsorCarouselData;
  const logoWidth = d.logoWidth ?? 480;
  const sponsors = useStore((s) => s.snapshot?.sponsors ?? null);
  const content = useStore((s) => (s.snapshot?.content ?? null) as ContentDocument | null);
  const event = useSnapshotEvent();
  const reduced = useReducedMotion();
  const sponsorsHref = findSponsorsPage(content, d.sponsorsPageSlug ?? null);

  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [sponsors]);

  const [visible, setVisible] = useState(() =>
    typeof document !== "undefined" ? !document.hidden : true,
  );
  useEffect(() => {
    const handler = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  useEffect(() => {
    if (!visible) return;
    if (!sponsors || sponsors.length <= 1) return;
    const linger = sponsors[index]?.lingerMs ?? DEFAULT_LINGER_MS;
    const timer = window.setTimeout(() => {
      setIndex((i) => (i + 1) % sponsors.length);
    }, linger);
    return () => window.clearTimeout(timer);
  }, [index, visible, sponsors]);

  if (!sponsors || sponsors.length === 0) return null;
  const current = sponsors[index] ?? sponsors[0];
  if (!current) return null;

  const href = sponsorHref(current);
  const media: MediaRef | null = current.logoMediaId
    ? { mediaId: current.logoMediaId, alt: current.name ?? null }
    : null;

  const linger = current.lingerMs ?? DEFAULT_LINGER_MS;

  const plate = (
    <>
      {media ? (
        <Media
          media={media}
          bundle={bundle}
          sizeOverride={`${logoWidth}px`}
          className="sponsor-carousel__logo"
          testId="sponsor-logo"
        />
      ) : (
        <span className="sponsor-carousel__logo" aria-hidden />
      )}
      <span className="sponsor-carousel__name">{current.name}</span>
      <span className="sponsor-carousel__linger" data-testid="sponsor-linger">
        {lingerLabel(linger)}
      </span>
    </>
  );

  return (
    <div
      className={`sponsor-carousel${reduced ? " sponsor-carousel--reduced-motion" : ""}`}
    >
      {d.heading ? (
        <p className="sponsor-carousel__heading">
          <Inline text={d.heading} bundle={bundle} event={event} />
        </p>
      ) : null}
      <div className="sponsor-carousel__bar">
        <div className="sponsor-carousel__viewport">
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="sponsor-carousel__slide"
            >
              {plate}
            </a>
          ) : (
            <div className="sponsor-carousel__slide">{plate}</div>
          )}
        </div>
        <ul className="sponsor-carousel__dots" aria-hidden>
          {sponsors.map((_, i) => (
            <li
              key={i}
              className={`sponsor-carousel__dot${i === index ? " sponsor-carousel__dot--on" : ""}`}
            />
          ))}
        </ul>
        {sponsorsHref ? (
          <ContentLink
            link={{
              label: d.sponsorsPageLabel ?? "All sponsors",
              href: sponsorsHref,
              icon: null,
              newTab: false,
            }}
            bundle={bundle}
            className="sponsor-carousel__link"
          />
        ) : null}
      </div>
    </div>
  );
};
