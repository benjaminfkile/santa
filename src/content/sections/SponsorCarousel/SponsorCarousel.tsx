// docs/site.md sections 7.4 and 15. SponsorCarousel starts at a random
// sponsor when the first non-empty list arrives, then plays snapshot order
// (never shuffled) from there: one sponsor at a time for its `lingerMs`,
// wraps around, pauses while the document is hidden. The `card` variant
// (the section) shows the logo tile and the name, a Previous and a Next
// icon button beside the slide from 761 px, and a row of short bars under
// it that jump to a sponsor; below 761 px a horizontal swipe on the slide
// steps instead of the arrows. Left and Right on the focused slide step.
// A manual step pauses the auto-advance for 30 s, after which it resumes
// from the shown sponsor with that sponsor's own `lingerMs`. The `tile`
// variant (the live screen) is the legacy tracker's bare logo tile with
// no controls.
// Tapping a sponsor opens a small centred dialog with the logo, the name,
// and a link to the sponsor's site; the dialog closes on its button, on
// Escape, or on a tap outside it.

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type { SectionComponent } from "../../registry";
import type { MediaRef, Sponsor } from "../../../contracts";
import { Inline } from "../../inline/Inline";
import { Media } from "../../primitives/Media";
import { Icon, iconResolves } from "../../primitives/Icon";
import { useSnapshotEvent } from "../../blocks/useSnapshotEvent";
import { useStore } from "../../../store/useStore";
import { useReducedMotion } from "../../../lib/motion";
import { copy } from "../../../copy/copy";
import * as styles from "./SponsorCarousel.module.css";
import * as iconButton from "../../../ui/IconButton.module.css";

type SponsorCarouselData = {
  heading?: string | null;
  logoWidth?: number;
  variant?: "card" | "tile";
};

const DEFAULT_LINGER_MS = 8000;
const MANUAL_PAUSE_MS = 30000;

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points={direction === "left" ? "15 6 9 12 15 18" : "9 6 15 12 9 18"} />
    </svg>
  );
}

// The dialog's links, in order: the website, Facebook, Instagram; each
// only when the sponsor has it, drawn as a 44 px icon button with the
// library icon and the label as its accessible name.
function sponsorLinks(s: Sponsor): { href: string; icon: string; label: string; testId: string }[] {
  const out: { href: string; icon: string; label: string; testId: string }[] = [];
  if (s.websiteUrl) out.push({ href: s.websiteUrl, icon: "globe", label: copy.sponsors.website, testId: "sponsor-website" });
  if (s.fbUrl) out.push({ href: s.fbUrl, icon: "facebook", label: copy.sponsors.facebook, testId: "sponsor-facebook" });
  if (s.igUrl) out.push({ href: s.igUrl, icon: "instagram", label: copy.sponsors.instagram, testId: "sponsor-instagram" });
  return out;
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

  // A manual step sets `paused` and bumps `manualStep`, which restarts the
  // 30 s pause; the auto-advance below waits while it is set.
  const [paused, setPaused] = useState(false);
  const [manualStep, setManualStep] = useState(0);
  useEffect(() => {
    if (!paused) return;
    const timer = window.setTimeout(() => setPaused(false), MANUAL_PAUSE_MS);
    return () => window.clearTimeout(timer);
  }, [paused, manualStep]);

  useEffect(() => {
    if (!visible || paused) return;
    if (!sponsors || sponsors.length <= 1) return;
    const linger = sponsors[index]?.lingerMs ?? DEFAULT_LINGER_MS;
    const timer = window.setTimeout(() => {
      setIndex((i) => (i + 1) % sponsors.length);
    }, linger);
    return () => window.clearTimeout(timer);
  }, [index, visible, paused, sponsors]);

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

  // The card's logo box is a fixed square (the stylesheet), so stepping
  // through sponsors never changes the slide's height; logoWidth only picks
  // the image size fetched (sizeOverride on Media). The live tile keeps the
  // legacy fixed tile.

  const card = variant === "card";
  const count = sponsors.length;
  const controls = card && count > 1;
  const showAt = (i: number): void => {
    setIndex(((i % count) + count) % count);
    setPaused(true);
    setManualStep((n) => n + 1);
  };
  const step = (delta: number): void => showAt(index + delta);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>): void => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      step(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      step(1);
    }
  };

  return (
    <div className={rootClass} data-variant={variant}>
      {variant === "card" && d.heading ? (
        <p className={styles.sponsorCarouselHeading}>
          <Inline text={d.heading} bundle={bundle} event={event} />
        </p>
      ) : null}
      <div className={styles.sponsorCarouselBar} data-arrows={controls ? "" : undefined}>
        {controls ? (
          <button
            type="button"
            className={iconButton.ibtn}
            onClick={() => step(-1)}
            aria-label={copy.sponsors.previous}
            data-testid="sponsor-previous"
          >
            <Chevron direction="left" />
          </button>
        ) : null}
        <button
          type="button"
          className={styles.sponsorCarouselSlide}
          onClick={() => setOpen(current)}
          onKeyDown={controls ? onKeyDown : undefined}
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
        {controls ? (
          <button
            type="button"
            className={iconButton.ibtn}
            onClick={() => step(1)}
            aria-label={copy.sponsors.next}
            data-testid="sponsor-next"
          >
            <Chevron direction="right" />
          </button>
        ) : null}
      </div>
      {controls ? (
        <ol className={styles.sponsorCarouselBars}>
          {sponsors.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                className={styles.sponsorCarouselBarButton}
                onClick={() => showAt(i)}
                aria-label={s.name ?? copy.sponsors.open}
                aria-current={i === index ? "true" : undefined}
                data-testid="sponsor-bar"
              />
            </li>
          ))}
        </ol>
      ) : null}
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
  const links = sponsorLinks(sponsor);
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
          {links.map((link) => {
            const icon = { source: "library", id: link.icon } as const;
            return (
              <a
                key={link.testId}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.sponsorDialogLink}
                aria-label={link.label}
                title={link.label}
                data-testid={link.testId}
              >
                {bundle !== null && iconResolves(icon, bundle) ? (
                  <Icon icon={icon} bundle={bundle} alt="" decorative size={18} />
                ) : (
                  <span className={styles.sponsorDialogLinkText}>{link.label}</span>
                )}
              </a>
            );
          })}
          <button type="button" className={styles.sponsorDialogClose} onClick={onClose}>
            {copy.sponsors.close}
          </button>
        </div>
      </div>
    </dialog>
  );
}
