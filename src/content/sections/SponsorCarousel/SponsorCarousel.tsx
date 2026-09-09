// docs/site.md section 15. SponsorCarousel: shuffles the input list once
// per snapshot change (Fisher-Yates), shows one sponsor at a time for
// `lingerMs`, wraps around, pauses while the document is hidden, click
// opens `websiteUrl ?? fbUrl ?? igUrl ?? null` in a new tab. Crossfade is
// disabled under reduced motion.

import { useEffect, useMemo, useState } from "react";
import type { SectionComponent } from "../../registry";
import type { Sponsor, MediaRef } from "../../../contracts";
import { Inline } from "../../inline/Inline";
import { Media } from "../../primitives/Media";
import { useSnapshotEvent } from "../../blocks/useSnapshotEvent";
import { useStore } from "../../../store/useStore";
import { useReducedMotion } from "../../../lib/motion";

type SponsorCarouselData = {
  heading?: string | null;
  logoWidth?: number;
};

const DEFAULT_LINGER_MS = 8000;

function shuffle<T>(list: T[]): T[] {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function sponsorHref(s: Sponsor): string | null {
  return s.websiteUrl ?? s.fbUrl ?? s.igUrl ?? null;
}

type CarouselState = { list: readonly Sponsor[]; index: number };

export const SponsorCarousel: SectionComponent = ({ data, bundle }) => {
  const d = (data ?? {}) as SponsorCarouselData;
  const logoWidth = d.logoWidth ?? 480;
  const sponsors = useStore((s) => s.snapshot?.sponsors ?? null);
  const event = useSnapshotEvent();
  const reduced = useReducedMotion();

  const shuffled = useMemo(() => (sponsors ? shuffle(sponsors) : []), [sponsors]);

  const [state, setState] = useState<CarouselState>({ list: shuffled, index: 0 });
  const active: CarouselState = state.list === shuffled ? state : { list: shuffled, index: 0 };
  const setIndex = (updater: (i: number) => number) => {
    setState((prev) => {
      const list = prev.list === shuffled ? prev.list : shuffled;
      const i = prev.list === shuffled ? prev.index : 0;
      return { list, index: updater(i) };
    });
  };

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
    if (shuffled.length <= 1) return;
    const currentIndex = active.list === shuffled ? active.index : 0;
    const linger = shuffled[currentIndex]?.lingerMs ?? DEFAULT_LINGER_MS;
    const timer = window.setTimeout(() => {
      setIndex((i) => (i + 1) % shuffled.length);
    }, linger);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active.index, visible, shuffled]);

  if (!sponsors || sponsors.length === 0) return null;
  const current = shuffled[active.index] ?? shuffled[0];
  if (!current) return null;

  const href = sponsorHref(current);
  const media: MediaRef | null = current.logoMediaId
    ? { mediaId: current.logoMediaId, alt: current.name ?? null }
    : null;

  const content = media ? (
    <Media
      media={media}
      bundle={bundle}
      sizeOverride={`${logoWidth}px`}
      className="sponsor-carousel__logo"
    />
  ) : (
    <span className="sponsor-carousel__name">{current.name}</span>
  );

  return (
    <div
      className={`sponsor-carousel${reduced ? " sponsor-carousel--reduced-motion" : ""}`}
    >
      {d.heading ? (
        <h2 className="sponsor-carousel__heading">
          <Inline text={d.heading} bundle={bundle} event={event} />
        </h2>
      ) : null}
      <div className="sponsor-carousel__viewport">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="sponsor-carousel__slide"
          >
            {content}
          </a>
        ) : (
          <div className="sponsor-carousel__slide">{content}</div>
        )}
      </div>
    </div>
  );
};
