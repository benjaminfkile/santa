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
//  - `map`: `data.disclaimer` in the disclaimer recipe plus the route map
//     of section 8.9 (MapLibre over the CDN basemap, `event.routeMap.path`
//     drawn on it) in its own `routemap` chunk. With no route map (null,
//     or fewer than two points), no VITE_ROUTE_BASEMAP_URL, or a failed
//     load, the section renders exactly what `image` renders. With two or
//     more `event.routeMap.timeline` entries the map also carries a dot at
//     every entry, a labelled dot at every interior 15 minute multiple,
//     and the Santa pin on the selected one, and a time slider over the
//     entries (starting at the first, labelled with the elapsed flight
//     time) sits under the frame; with
//     fewer, only the path is drawn. The frame and the slider share one
//     wrapper, the fullscreen target (useRouteMapFullscreen), and the map
//     carries a fullscreen button and a terrain toggle unless
//     `data.controls.fullscreen` or `data.controls.terrain` is false.

import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SectionComponent } from "../../registry";
import type { ContentDocument, MediaRef } from "../../../contracts";
import { Inline } from "../../inline/Inline";
import { useSnapshotEvent } from "../../blocks/useSnapshotEvent";
import { useStore } from "../../../store/useStore";
import { Link } from "react-router-dom";
import { Media } from "../../primitives/Media";
import { resolveMedia } from "../../primitives/resolve";
import { PosterViewer } from "./PosterViewer";
import { routeMapPath, type LatLng } from "./routeMapPath";
import {
  routeMapTimeline,
  routeTimeLabel,
  routeTimeLabels,
  type TimelineLabel,
} from "./routeTimelineData";
import { RouteTimeSlider } from "./RouteTimeSlider";
import { useRouteMapFullscreen } from "./useRouteMapFullscreen";
import { SantaIcon } from "../../icons/generated/santa";
import { useReducedMotion } from "../../../lib/motion";
import { env } from "../../../config/env";
import { copy } from "../../../copy/copy";
import * as styles from "./RoutePreview.module.css";
import * as ibtn from "../../../ui/IconButton.module.css";

type RouteMapProps = {
  path: readonly LatLng[];
  marks?: readonly LatLng[];
  timeLabels?: readonly TimelineLabel[];
  pin?: LatLng | null;
  pinElement?: HTMLElement;
  reducedMotion?: boolean;
  ariaLabel?: string;
  fullscreenControl?: boolean;
  terrainControl?: boolean;
  controlClassName?: string;
  fullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onFail: () => void;
};

const NO_MARKS: readonly LatLng[] = [];
const NO_LABELS: readonly TimelineLabel[] = [];

// The route map host, in the `routemap` chunk. A chunk that fails to load
// resolves to a component that reports the failure, so the section falls
// back to the image rendering.
const LazyRouteMap = lazy(() =>
  import("../../../routeMap/RouteMap")
    .then((mod) => ({ default: mod.RouteMap }))
    .catch((error: unknown) => ({
      default: function RouteMapUnavailable({ onFail }: RouteMapProps) {
        useEffect(() => {
          console.warn("route map: falling back to the poster", error);
          onFail();
        }, [onFail]);
        return null;
      },
    })),
);

type RoutePreviewData = {
  heading?: string | null;
  style?: "image" | "viewer" | "map";
  emptyText?: string | null;
  disclaimer?: string | null;
  controls?: { fullscreen?: boolean; terrain?: boolean } | null;
};

// The Santa pin's element, handed to the route map as its marker; the
// badge and icon are portalled into it.
function createPinElement(): HTMLElement {
  const el = document.createElement("div");
  el.className = styles.routePin;
  el.setAttribute("data-testid", "route-map-pin");
  el.setAttribute("aria-hidden", "true");
  return el;
}

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
  const emptyText = d.emptyText ?? null;
  const mediaId = useStore((s) => s.snapshot?.event?.routeImageMediaId ?? null);
  const routeMap = useStore((s) => s.snapshot?.event?.routeMap ?? null);
  const event = useSnapshotEvent();
  const content = bundle.content;
  const [mapFailed, setMapFailed] = useState(false);
  const onMapFail = useCallback(() => setMapFailed(true), []);

  const viewerSlug = useMemo(() => findViewerPageSlug(content), [content]);
  const path = useMemo(() => routeMapPath(routeMap), [routeMap]);
  const parsedTimeline = useMemo(() => routeMapTimeline(routeMap), [routeMap]);
  const timeline = parsedTimeline.length >= 2 ? parsedTimeline : null;
  const marks = useMemo(
    () => (timeline === null ? NO_MARKS : timeline.map(({ lat, lng }) => ({ lat, lng }))),
    [timeline],
  );
  const timeLabels = useMemo(
    () => (timeline === null ? NO_LABELS : routeTimeLabels(timeline)),
    [timeline],
  );
  const [selected, setSelected] = useState(0);
  const reducedMotion = useReducedMotion();
  const [pinElement] = useState(createPinElement);
  const stop = timeline === null ? null : timeline[Math.min(selected, timeline.length - 1)];
  const pin = useMemo(
    () => (stop === null ? null : { lat: stop.lat, lng: stop.lng }),
    [stop],
  );

  const stageRef = useRef<HTMLDivElement | null>(null);
  const fullscreen = useRouteMapFullscreen(stageRef);

  const showMap =
    d.style === "map" && path.length >= 2 && env.ROUTE_BASEMAP_URL !== "" && !mapFailed;
  const style = d.style === "viewer" ? "viewer" : showMap ? "map" : "image";

  if (style === "map") {
    return (
      <div className={`${styles.routePreview} ${styles.routePreviewViewer}`} data-testid="route-preview-map">
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
        <div
          ref={stageRef}
          className={
            fullscreen.mode === "takeover"
              ? `${styles.routeMapStage} ${styles.routeMapStageTakeover}`
              : styles.routeMapStage
          }
          data-testid="route-map-stage"
          data-fullscreen={fullscreen.mode}
        >
          <div className={styles.routeMap} data-testid="route-map-frame">
            <Suspense fallback={null}>
              <LazyRouteMap
                path={path}
                marks={marks}
                timeLabels={timeLabels}
                pin={pin}
                pinElement={pinElement}
                reducedMotion={reducedMotion}
                ariaLabel={d.heading ?? undefined}
                fullscreenControl={d.controls?.fullscreen !== false}
                terrainControl={d.controls?.terrain !== false}
                controlClassName={ibtn.ibtn}
                fullscreen={fullscreen.mode !== "off"}
                onToggleFullscreen={fullscreen.toggle}
                onFail={onMapFail}
              />
            </Suspense>
          </div>
          {timeline !== null && stop !== null ? (
            <RouteTimeSlider
              timeline={timeline}
              index={timeline.indexOf(stop)}
              label={routeTimeLabel(stop.minutes)}
              onSelect={setSelected}
            />
          ) : null}
        </div>
        {createPortal(
          <span className={styles.routePinBadge}>
            <SantaIcon className={styles.routePinIcon} />
          </span>,
          pinElement,
        )}
      </div>
    );
  }

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
