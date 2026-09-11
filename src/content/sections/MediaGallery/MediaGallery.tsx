// docs/site.md section 7.4. Media gallery section: single, grid, carousel.

import { useCallback, useState } from "react";
import type { CSSProperties } from "react";
import type { Link, MediaRef } from "../../../contracts";
import type { ContentBundle } from "../../../store/types";
import type { SectionComponent } from "../../registry";
import type { FrameWidth } from "../../primitives/Media";
import { Media } from "../../primitives/Media";
import { LinkView } from "../../primitives/LinkView";
import { Inline } from "../../inline/Inline";
import { useSnapshotEvent } from "../../blocks/useSnapshotEvent";
import { useReducedMotion } from "../../../lib/motion";
import "./MediaGallery.module.css";

type MediaItem = {
  media: MediaRef;
  caption: string | null;
  link: Link | null;
};

type MediaData = {
  layout?: "single" | "grid" | "carousel";
  columns?: 2 | 3 | 4;
};

function readItems(items: { id: number; data: unknown }[]): MediaItem[] {
  return items
    .map((it) => (it.data ?? {}) as Partial<MediaItem>)
    .filter((d): d is MediaItem => Boolean(d.media))
    .map((d) => ({
      media: d.media as MediaRef,
      caption: d.caption ?? null,
      link: d.link ?? null,
    }));
}

export const MediaGallery: SectionComponent = ({ data, items, bundle, frame }) => {
  const d = (data ?? {}) as MediaData;
  const layout = d.layout ?? "grid";
  const columns = d.columns ?? 3;
  const parsedItems = readItems(items);
  if (parsedItems.length === 0) return null;
  if (layout === "single") {
    return (
      <div className="media-gallery media-gallery--single">
        <MediaFigure item={parsedItems[0]} bundle={bundle} frame={frame ?? "wide"} />
      </div>
    );
  }
  if (layout === "grid") {
    const style: CSSProperties = { ["--media-columns" as string]: columns };
    return (
      <div
        className={`media-gallery media-gallery--grid media-gallery--cols-${columns}`}
        style={style}
      >
        {parsedItems.map((item, i) => (
          <MediaFigure key={i} item={item} bundle={bundle} frame={frame ?? "wide"} />
        ))}
      </div>
    );
  }
  return <MediaCarousel items={parsedItems} bundle={bundle} frame={frame ?? "wide"} />;
};

function MediaFigure({
  item,
  bundle,
  frame,
}: {
  item: MediaItem;
  bundle: ContentBundle;
  frame: FrameWidth;
}) {
  const event = useSnapshotEvent();
  const inner = (
    <>
      <Media media={item.media} bundle={bundle} frame={frame} />
      {item.caption ? (
        <figcaption className="media-gallery__caption">
          <Inline text={item.caption} bundle={bundle} event={event} />
        </figcaption>
      ) : null}
    </>
  );
  return (
    <figure className="media-gallery__figure">
      {item.link ? (
        <LinkView
          href={item.link.href}
          bundle={bundle}
          newTab={item.link.newTab}
          className="media-gallery__link"
        >
          {inner}
        </LinkView>
      ) : (
        inner
      )}
    </figure>
  );
}

function MediaCarousel({
  items,
  bundle,
  frame,
}: {
  items: MediaItem[];
  bundle: ContentBundle;
  frame: FrameWidth;
}) {
  const [index, setIndex] = useState(0);
  const reducedMotion = useReducedMotion();
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const total = items.length;
  const clamp = useCallback((n: number) => (n + total) % total, [total]);
  const next = useCallback(() => setIndex((i) => clamp(i + 1)), [clamp]);
  const prev = useCallback(() => setIndex((i) => clamp(i - 1)), [clamp]);
  return (
    <div
      className={`media-gallery media-gallery--carousel${reducedMotion ? " media-gallery--reduced-motion" : ""}`}
      data-index={index}
      data-total={total}
    >
      <div
        className="media-gallery__viewport"
        onTouchStart={(e) => setTouchStartX(e.touches[0]?.clientX ?? null)}
        onTouchEnd={(e) => {
          if (touchStartX === null) return;
          const dx = (e.changedTouches[0]?.clientX ?? touchStartX) - touchStartX;
          if (dx > 40) prev();
          else if (dx < -40) next();
          setTouchStartX(null);
        }}
      >
        {items.map((item, i) => (
          <div
            key={i}
            className={`media-gallery__slide${i === index ? " media-gallery__slide--active" : ""}`}
            aria-hidden={i === index ? undefined : true}
          >
            <MediaFigure item={item} bundle={bundle} frame={frame} />
          </div>
        ))}
      </div>
      <div className="media-gallery__controls">
        <button
          type="button"
          className="media-gallery__prev"
          onClick={prev}
          aria-label="Previous"
        >
          ‹
        </button>
        <button
          type="button"
          className="media-gallery__next"
          onClick={next}
          aria-label="Next"
        >
          ›
        </button>
      </div>
    </div>
  );
}
