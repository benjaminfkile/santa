// docs/site.md sections 7.4 and 15. SponsorCarousel plays snapshot order
// (never shuffled): one sponsor at a time for its `lingerMs`, wraps around,
// pauses while the document is hidden. The plate shows the logo tile and
// an "N s on the tracker" line derived from `lingerMs`; a compact link
// jumps to the sponsors page.

import { useEffect, useRef, useState } from "react";
import type { SectionComponent } from "../../registry";
import type { ContentDocument, MediaRef, Sponsor } from "../../../contracts";
import { Inline } from "../../inline/Inline";
import { Media } from "../../primitives/Media";
import { ContentLink } from "../../primitives/LinkView";
import { useSnapshotEvent } from "../../blocks/useSnapshotEvent";
import { useStore } from "../../../store/useStore";
import { useReducedMotion } from "../../../lib/motion";
import * as styles from "./SponsorCarousel.module.css";

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
  const prevIdAtIndexRef = useRef<number | null>(sponsors?.[0]?.id ?? null);

  useEffect(() => {
    if (!sponsors || sponsors.length === 0) {
      prevIdAtIndexRef.current = null;
      setIndex(0);
      return;
    }
    setIndex((cur) => {
      const clamped = cur < sponsors.length ? cur : 0;
      const idAtCur = sponsors[clamped]?.id ?? null;
      if (idAtCur !== null && idAtCur === prevIdAtIndexRef.current) {
        prevIdAtIndexRef.current = idAtCur;
        return clamped;
      }
      prevIdAtIndexRef.current = sponsors[0]?.id ?? null;
      return 0;
    });
  }, [sponsors]);

  useEffect(() => {
    if (!sponsors || sponsors.length === 0) return;
    prevIdAtIndexRef.current = sponsors[index]?.id ?? null;
  }, [index, sponsors]);

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
          className={styles.sponsorCarouselLogo}
          testId="sponsor-logo"
        />
      ) : (
        <span className={styles.sponsorCarouselLogo} aria-hidden />
      )}
      <span className={styles.sponsorCarouselName}>{current.name}</span>
      <span className={styles.sponsorCarouselLinger} data-testid="sponsor-linger">
        {lingerLabel(linger)}
      </span>
    </>
  );

  return (
    <div
      className={`${styles.sponsorCarousel}${reduced ? " " + styles.sponsorCarouselReducedMotion : ""}`}
    >
      {d.heading ? (
        <p className={styles.sponsorCarouselHeading}>
          <Inline text={d.heading} bundle={bundle} event={event} />
        </p>
      ) : null}
      <div className={styles.sponsorCarouselBar}>
        <div className={styles.sponsorCarouselViewport}>
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.sponsorCarouselSlide}
            >
              {plate}
            </a>
          ) : (
            <div className={styles.sponsorCarouselSlide}>{plate}</div>
          )}
        </div>
        <ul className={styles.sponsorCarouselDots} aria-hidden>
          {sponsors.map((_, i) => (
            <li
              key={i}
              className={`${styles.sponsorCarouselDot}${i === index ? " " + styles.sponsorCarouselDotOn : ""}`}
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
            className={styles.sponsorCarouselLink}
          />
        ) : null}
      </div>
    </div>
  );
};
