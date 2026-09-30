// docs/site.md section 8.9. The route map's landmarks from the event's
// config. Each becomes a style landmark (its `name` the label). A landmark
// whose `icon` draws gets `badge` in the style (no dot, the label further
// out) and a marker element holding the icon on a small round badge:
// library icons inline, media icons through an image element, through
// the Icon primitive. A landmark with a `description` gets a marker
// element holding a button, over its badge or, without one, over its dot;
// the button's accessible name is "About <name>". The button opens the
// landmark's popover (the name, the description, and a "Get directions"
// link to the landmark's point, see directionsHref, opening in a new tab)
// in the map frame; its button closes an open one. One popover is open at a time; its close
// button, Escape, and a tap anywhere outside the popover and the open
// landmark's button close it, the first two returning focus to that
// button. Escape here is marked handled, so a fullscreen map stays
// fullscreen. A landmark with neither gets no marker and stays as the
// style draws it.

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { IconRef } from "../../../contracts";
import type { ContentBundle } from "../../../store/types";
import { Icon, iconResolves } from "../../primitives/Icon";
import { copy } from "../../../copy/copy";
import { directionsHref } from "../../../lib/directions";
import * as styles from "./RoutePreview.module.css";
import * as ibtn from "../../../ui/IconButton.module.css";
import * as btn from "../../../ui/Button.module.css";

export type LandmarkData = {
  name: string;
  lat: number;
  lng: number;
  icon?: IconRef | null;
  description?: string | null;
};

type StyleLandmark = { lat: number; lng: number; label: string; badge?: boolean };
type LandmarkMarker = { lat: number; lng: number; element: HTMLElement };

type Entry = {
  index: number;
  landmark: LandmarkData;
  icon: IconRef | null;
  description: string | null;
  element: HTMLElement;
};

export type RouteLandmarks = {
  styleLandmarks: readonly StyleLandmark[] | undefined;
  markers: readonly LandmarkMarker[];
  portals: ReactNode;
  popover: ReactNode;
};

const NO_MARKERS: readonly LandmarkMarker[] = [];

function createMarkerElement(index: number): HTMLElement {
  const el = document.createElement("div");
  el.className = styles.routeLandmark;
  el.setAttribute("data-testid", "route-landmark");
  el.setAttribute("data-landmark-index", String(index));
  return el;
}

export function useRouteLandmarks(
  data: readonly LandmarkData[] | null | undefined,
  bundle: ContentBundle,
): RouteLandmarks {
  const entries = useMemo<Entry[]>(() => {
    const out: Entry[] = [];
    (data ?? []).forEach((landmark, index) => {
      const icon = landmark.icon && iconResolves(landmark.icon, bundle) ? landmark.icon : null;
      const description =
        typeof landmark.description === "string" && landmark.description.trim() !== ""
          ? landmark.description
          : null;
      if (icon === null && description === null) return;
      out.push({ index, landmark, icon, description, element: createMarkerElement(index) });
    });
    return out;
  }, [data, bundle]);

  const styleLandmarks = useMemo(() => {
    if (data === null || data === undefined) return undefined;
    const badged = new Set(entries.filter((e) => e.icon !== null).map((e) => e.index));
    return data.map(({ name, lat, lng }, index) =>
      badged.has(index) ? { lat, lng, label: name, badge: true } : { lat, lng, label: name },
    );
  }, [data, entries]);

  const markers = useMemo(
    () =>
      entries.length === 0
        ? NO_MARKERS
        : entries.map(({ landmark, element }) => ({
            lat: landmark.lat,
            lng: landmark.lng,
            element,
          })),
    [entries],
  );

  const [open, setOpen] = useState<number | null>(null);
  const openEntry = entries.find((e) => e.index === open && e.description !== null) ?? null;
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const baseId = useId();
  const popoverId = `${baseId}-popover`;
  const titleId = `${baseId}-title`;

  const close = useCallback(
    (restoreFocus: boolean) => {
      if (restoreFocus && openEntry !== null) {
        openEntry.element.querySelector<HTMLButtonElement>("button")?.focus();
      }
      setOpen(null);
    },
    [openEntry],
  );

  useEffect(() => {
    if (openEntry === null) return;
    closeRef.current?.focus();
  }, [openEntry]);

  useEffect(() => {
    if (openEntry === null) return;
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key !== "Escape") return;
      event.preventDefault();
      close(true);
    }
    function onPointerDown(event: PointerEvent): void {
      const target = event.target as Node | null;
      if (target === null || openEntry === null) return;
      if (popoverRef.current?.contains(target) || openEntry.element.contains(target)) return;
      close(false);
    }
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [openEntry, close]);

  const portals = entries.map((entry) => {
    const badge =
      entry.icon === null ? null : (
        <span className={styles.routeLandmarkBadge} data-testid="route-landmark-badge" aria-hidden>
          <Icon icon={entry.icon} bundle={bundle} decorative size={18} />
        </span>
      );
    const isOpen = openEntry?.index === entry.index;
    const body =
      entry.description === null ? (
        badge
      ) : (
        <button
          type="button"
          className={
            entry.icon === null
              ? `${styles.routeLandmarkButton} ${styles.routeLandmarkDotButton}`
              : styles.routeLandmarkButton
          }
          aria-label={copy.map.routeMap.landmark(entry.landmark.name)}
          aria-expanded={isOpen}
          aria-controls={isOpen ? popoverId : undefined}
          aria-haspopup="dialog"
          data-testid="route-landmark-button"
          onClick={() => setOpen(isOpen ? null : entry.index)}
        >
          {badge}
        </button>
      );
    return createPortal(body, entry.element, `landmark-${entry.index}`);
  });

  const popover =
    openEntry === null ? null : (
      <div
        ref={popoverRef}
        id={popoverId}
        className={styles.routeLandmarkPopover}
        role="dialog"
        aria-labelledby={titleId}
        data-testid="route-landmark-popover"
      >
        <div className={styles.routeLandmarkPopoverHead}>
          <h3 id={titleId} className={styles.routeLandmarkPopoverTitle}>
            {openEntry.landmark.name}
          </h3>
          <button
            ref={closeRef}
            type="button"
            className={ibtn.ibtn}
            aria-label={copy.map.routeMap.closeLandmark}
            onClick={() => close(true)}
            data-testid="route-landmark-popover-close"
          >
            {CLOSE_ICON}
          </button>
        </div>
        <p className={styles.routeLandmarkPopoverText}>{openEntry.description}</p>
        <a
          className={`${btn.btn} ${btn.btnSm} ${styles.routeLandmarkDirections}`}
          href={directionsHref(openEntry.landmark.lat, openEntry.landmark.lng)}
          target="_blank"
          rel="noopener"
          data-testid="route-landmark-directions"
        >
          {copy.map.routeMap.directions}
        </a>
      </div>
    );

  return { styleLandmarks, markers, portals, popover };
}

const CLOSE_ICON = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
    <path d="M6 6l12 12" />
    <path d="M18 6L6 18" />
  </svg>
);
