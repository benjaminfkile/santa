// docs/site.md section 7.4 and 8.5. `route_preview`:
//  - `image`: the poster through `Media` (960 variant, srcset) inside a
//     bounded frame at the content column width, `--route-preview-max-h`
//     tall, filled with `object-fit: cover`. The frame is wrapped in a
//     link to the page whose `route_preview` has style `viewer` when one
//     is published, unlinked otherwise; the linked frame carries an
//     "Open the full route" overlay at the bottom right.
//  - `viewer`: `data.disclaimer` in the disclaimer recipe plus the
//     OpenSeadragon `PosterViewer` over the media entry's Deep Zoom
//     pyramid (or its original url when there is none). No map chunk.

import { useMemo } from "react";
import type { SectionComponent } from "../../registry";
import type { ContentDocument, MediaRef } from "../../../contracts";
import { Inline } from "../../inline/Inline";
import { useSnapshotEvent } from "../../blocks/useSnapshotEvent";
import { useStore } from "../../../store/useStore";
import { Link } from "react-router-dom";
import { Media } from "../../primitives/Media";
import { resolveMedia } from "../../primitives/resolve";
import { PosterViewer } from "./PosterViewer";
import { copy } from "../../../copy/copy";
import * as styles from "./RoutePreview.module.css";

type RoutePreviewData = {
  heading?: string | null;
  style?: "image" | "viewer";
  emptyText?: string | null;
  disclaimer?: string | null;
};

function findViewerPageSlug(content: ContentDocument | null | undefined): string | null {
  if (!content?.pages) return null;
  const page = content.pages.find((p) =>
    p.role === "none" &&
    p.sections.some(
      (s) =>
        s.kind === "route_preview" &&
        ((s.data as { style?: string } | null | undefined)?.style ?? "image") === "viewer",
    ),
  );
  return page?.slug ?? null;
}

export const RoutePreview: SectionComponent = ({ data, bundle }) => {
  const d = (data ?? {}) as RoutePreviewData;
  const style = d.style === "viewer" ? "viewer" : "image";
  const emptyText = d.emptyText ?? null;
  const mediaId = useStore((s) => s.snapshot?.event?.routeImageMediaId ?? null);
  const event = useSnapshotEvent();
  const content = bundle.content;

  const viewerSlug = useMemo(() => findViewerPageSlug(content), [content]);

  if (mediaId === null || mediaId === undefined || mediaId === "") {
    if (emptyText) {
      return (
        <div className={`${styles.routePreview} ${styles.routePreviewEmpty}`}>
          {d.heading ? (
            <h2 className={styles.routePreviewHeading}>
              <Inline text={d.heading} bundle={bundle} event={event} />
            </h2>
          ) : null}
          <p className={styles.routePreviewEmptyText}>
            <Inline text={emptyText} bundle={bundle} event={event} />
          </p>
        </div>
      );
    }
    return null;
  }

  const entry = resolveMedia(bundle, mediaId);
  if (entry === null) {
    if (emptyText) {
      return (
        <div className={`${styles.routePreview} ${styles.routePreviewEmpty}`}>
          {d.heading ? (
            <h2 className={styles.routePreviewHeading}>
              <Inline text={d.heading} bundle={bundle} event={event} />
            </h2>
          ) : null}
          <p className={styles.routePreviewEmptyText}>
            <Inline text={emptyText} bundle={bundle} event={event} />
          </p>
        </div>
      );
    }
    return null;
  }

  const media: MediaRef = { mediaId, alt: entry.alt ?? "Route poster" };

  if (style === "viewer") {
    const alt = entry.alt ?? "Route poster";
    return (
      <div className={`${styles.routePreview} ${styles.routePreviewViewer}`} data-testid="route-preview-viewer">
        {d.heading ? (
          <h2 className={styles.routePreviewHeading}>
            <Inline text={d.heading} bundle={bundle} event={event} />
          </h2>
        ) : null}
        {d.disclaimer ? (
          <div className={styles.disclaimerRecipe} role="note">
            <DisclaimerIcon />
            <p>
              <Inline text={d.disclaimer} bundle={bundle} event={event} />
            </p>
          </div>
        ) : null}
        <PosterViewer
          mediaId={mediaId}
          url={entry.url ?? ""}
          dzi={entry.dzi ?? null}
          alt={alt}
          ariaLabel={d.heading ?? undefined}
        />
      </div>
    );
  }

  const picture = (
    <Media
      media={media}
      bundle={bundle}
      sizeOverride="(min-width: 960px) 960px, 100vw"
      testId="route-preview-image"
      className={styles.routePreviewImage}
    />
  );

  return (
    <div className={`${styles.routePreview} ${styles.routePreviewImageWrap}`} data-testid="route-preview-image-wrap">
      {d.heading ? (
        <h2 className={styles.routePreviewHeading}>
          <Inline text={d.heading} bundle={bundle} event={event} />
        </h2>
      ) : null}
      {viewerSlug !== null ? (
        <Link to={`/${viewerSlug}`} className={styles.routePreviewLink} data-testid="route-preview-link">
          <div className={styles.routePreviewFrame} data-testid="route-preview-frame">
            {picture}
            <span className={styles.routePreviewOverlay} data-testid="route-preview-overlay">
              {copy.map.poster.openFullRoute}
            </span>
          </div>
        </Link>
      ) : (
        <div className={styles.routePreviewFrame} data-testid="route-preview-frame">
          {picture}
        </div>
      )}
    </div>
  );
};

function DisclaimerIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l10 18H2z" />
      <path d="M12 10v5" />
      <path d="M12 18h.01" />
    </svg>
  );
}
