// docs/site.md sections 7.4 and 15. SponsorCarousel starts at a random
// sponsor when the first non-empty list arrives, then plays snapshot order
// (never shuffled) from there: one sponsor at a time for its `lingerMs`,
// wraps around, pauses while the document is hidden. The `card` variant
// (the section) shows the logo tile, the name, and the dots; the
// `tile` variant (the live screen) is the legacy tracker's bare logo tile.
// Tapping a sponsor opens a small centred dialog with the logo, the name,
// and a link to the sponsor's site; the dialog closes on its button, on
// Escape, or on a tap outside it.

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { SectionComponent } from "../../registry";
import type { MediaRef, Sponsor } from "../../../contracts";
import { Inline } from "../../inline/Inline";
import { Media } from "../../primitives/Media";
import { useSnapshotEvent } from "../../blocks/useSnapshotEvent";
import { useStore } from "../../../store/useStore";
import { useReducedMotion } from "../../../lib/motion";
import { copy } from "../../../copy/copy";
import * as styles from "./SponsorCarousel.module.css";

type SponsorCarouselData = {
  heading?: string | null;
  logoWidth?: number;
  variant?: "card" | "tile";
};

const DEFAULT_LINGER_MS = 8000;

function sponsorHref(s: Sponsor): string | null {
  return s.websiteUrl ?? s.fbUrl ?? s.igUrl ?? null;
}

function randomIndex(length: number): number {
  return Math.min(length - 1, Math.floor(Math.random() * length));
}

export const SponsorCarousel: SectionComponent = ({ data, bundle }) => {
  const d = (data ?? {}) as SponsorCarouselData;
  const logoWidth = d.logoWidth ?? 480;
  const variant = d.variant ?? "card";
  const sponsors = useStore((s) => s.snapshot?.sponsors ?? null);
  const event = useSnapshotEvent();
  const reduced = useReducedMotion();

  const [index, setIndex] = useState(() =>
    sponsors && sponsors.length > 0 ? randomIndex(sponsors.length) : 0,
  );
  const [open, setOpen] = useState<Sponsor | null>(null);
  const prevIdAtIndexRef = useRef<number | null>(sponsors?.[index]?.id ?? null);
  // True once a non-empty list has arrived and the random start is chosen.
  const indexRef = useRef(index);
  indexRef.current = index;
  const startedRef = useRef(sponsors !== null && sponsors.length > 0);

  useEffect(() => {
    if (!sponsors || sponsors.length === 0) {
      prevIdAtIndexRef.current = null;
      setIndex(0);
      return;
    }
    if (!startedRef.current) {
      startedRef.current = true;
      const start = randomIndex(sponsors.length);
      prevIdAtIndexRef.current = sponsors[start]?.id ?? null;
      setIndex(start);
      return;
    }
    const cur = indexRef.current;
    const clamped = cur < sponsors.length ? cur : 0;
    const idAtCur = sponsors[clamped]?.id ?? null;
    if (idAtCur !== null && idAtCur === prevIdAtIndexRef.current) {
      setIndex(clamped);
      return;
    }
    prevIdAtIndexRef.current = sponsors[0]?.id ?? null;
    setIndex(0);
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

  const media: MediaRef | null = current.logoMediaId
    ? { mediaId: current.logoMediaId, alt: current.name ?? null }
    : null;
  const rootClass = [
    styles.sponsorCarousel,
    variant === "tile" ? styles.sponsorCarouselTile : styles.sponsorCarouselCard,
    reduced ? styles.sponsorCarouselReducedMotion : "",
  ]
    .filter(Boolean)
    .join(" ");

  // The card's rendered logo size follows an explicit logoWidth; without
  // one the CSS default (48 px) applies. The live tile keeps the legacy
  // fixed tile whatever the setting.
  const rootStyle =
    variant === "card" && d.logoWidth !== undefined && d.logoWidth !== null
      ? ({ "--sponsor-logo-width": `${d.logoWidth}px` } as CSSProperties)
      : undefined;

  return (
    <div className={rootClass} data-variant={variant} style={rootStyle}>
      {variant === "card" && d.heading ? (
        <p className={styles.sponsorCarouselHeading}>
          <Inline text={d.heading} bundle={bundle} event={event} />
        </p>
      ) : null}
      <div className={styles.sponsorCarouselBar}>
        <button
          type="button"
          className={styles.sponsorCarouselSlide}
          onClick={() => setOpen(current)}
          aria-label={current.name ?? copy.sponsors.open}
          data-testid="sponsor-open"
        >
          {media ? (
            <Media
              media={media}
              bundle={bundle}
              sizeOverride={`${logoWidth}px`}
              className={styles.sponsorCarouselLogo}
              testId="sponsor-logo"
              small={false}
            />
          ) : (
            <span className={styles.sponsorCarouselNameOnly}>{current.name}</span>
          )}
          {variant === "card" ? (
            <span className={styles.sponsorCarouselName}>{current.name}</span>
          ) : null}
        </button>
        {variant === "card" && sponsors.length > 1 ? (
          <ul className={styles.sponsorCarouselDots} aria-hidden>
            {sponsors.map((_, i) => (
              <li
                key={i}
                className={`${styles.sponsorCarouselDot}${i === index ? " " + styles.sponsorCarouselDotOn : ""}`}
              />
            ))}
          </ul>
        ) : null}
      </div>
      {open !== null ? (
        <SponsorDialog sponsor={open} bundle={bundle} logoWidth={logoWidth} onClose={() => setOpen(null)} />
      ) : null}
    </div>
  );
};

function SponsorDialog({
  sponsor,
  bundle,
  logoWidth,
  onClose,
}: {
  sponsor: Sponsor;
  bundle: Parameters<typeof Media>[0]["bundle"];
  logoWidth: number;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement | null>(null);
  useEffect(() => {
    const dlg = ref.current;
    if (dlg === null) return;
    if (typeof dlg.showModal === "function" && !dlg.open) {
      try {
        dlg.showModal();
      } catch {
        // ignore; some jsdom builds do not implement showModal.
      }
    }
  }, []);
  const href = sponsorHref(sponsor);
  const media: MediaRef | null = sponsor.logoMediaId
    ? { mediaId: sponsor.logoMediaId, alt: sponsor.name ?? null }
    : null;
  return (
    <dialog
      ref={ref}
      className={styles.sponsorDialog}
      aria-label={sponsor.name ?? copy.sponsors.open}
      data-testid="sponsor-dialog"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.sponsorDialogBody}>
        {media ? (
          <Media media={media} bundle={bundle} sizeOverride={`${logoWidth}px`} className={styles.sponsorDialogLogo} small={false} />
        ) : null}
        <p className={styles.sponsorDialogName}>{sponsor.name}</p>
        <div className={styles.sponsorDialogActions}>
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.sponsorDialogVisit}
              data-testid="sponsor-visit"
            >
              {copy.sponsors.visit}
            </a>
          ) : null}
          <button type="button" className={styles.sponsorDialogClose} onClick={onClose}>
            {copy.sponsors.close}
          </button>
        </div>
      </div>
    </dialog>
  );
}
