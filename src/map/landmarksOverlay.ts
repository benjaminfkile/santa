// docs/site.md section 8.5. Landmarks overlay: the site settings'
// landmarks on the live tracker, one Google Maps `OverlayView` per
// landmark. Each element is a 28 px round badge on the glass recipe (the
// landmark's icon when it has one, mounted through `mountIcon`, else an
// 8 px accent dot) with the name beside it in the map's label style. The
// badge is a button whose accessible name is "About <name>"; a click opens
// the landmark's popover above the badge (the name, the description when
// there is one, and a "Get directions" link to the point, see
// directionsHref, opening in a new tab). One popover is open at a time;
// its close button, Escape, and a pointer press anywhere outside it and
// the open badge close it. The overlays are on the map only while the
// toggle is on and the zoom is at least LANDMARKS_MIN_ZOOM.

import type { IconRef } from "../contracts";
import { copy } from "../copy/copy";
import { directionsHref } from "../lib/directions";
import * as styles from "./LandmarksOverlay.module.css";
import * as btn from "../ui/Button.module.css";

export const LANDMARKS_MIN_ZOOM = 10;

export type TrackerLandmark = {
  name: string;
  lat: number;
  lng: number;
  icon?: IconRef | null;
  description?: string | null;
};

// Draws `icon` into `container` and returns the cleanup that removes it.
export type MountIcon = (container: HTMLElement, icon: IconRef) => () => void;

export type LandmarksOverlay = {
  update(opts: { visible: boolean; zoom: number }): void;
  destroy(): void;
};

type Entry = {
  landmark: TrackerLandmark;
  element: HTMLElement;
  badge: HTMLButtonElement;
  overlay: google.maps.OverlayView;
  unmountIcon: (() => void) | null;
};

const CLOSE_SVG =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12"/><path d="M18 6L6 18"/></svg>';

export function createLandmarksOverlay(
  libs: { maps: google.maps.MapsLibrary },
  map: google.maps.Map,
  landmarks: readonly TrackerLandmark[],
  mountIcon: MountIcon | null,
): LandmarksOverlay {
  let shown = false;
  let open: Entry | null = null;
  let popover: HTMLElement | null = null;

  function closePopover(restoreFocus: boolean): void {
    if (open === null) return;
    const entry = open;
    open = null;
    popover?.remove();
    popover = null;
    entry.element.removeAttribute("data-open");
    entry.badge.setAttribute("aria-expanded", "false");
    document.removeEventListener("keydown", onKeyDown, true);
    document.removeEventListener("pointerdown", onPointerDown, true);
    if (restoreFocus) entry.badge.focus();
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    closePopover(true);
  }

  function onPointerDown(event: PointerEvent): void {
    const target = event.target as Node | null;
    if (target === null || open === null) return;
    if (popover?.contains(target) || open.badge.contains(target)) return;
    closePopover(false);
  }

  function openPopover(entry: Entry): void {
    closePopover(false);
    open = entry;
    popover = buildPopover(entry.landmark, () => closePopover(true));
    entry.element.appendChild(popover);
    entry.element.setAttribute("data-open", "true");
    entry.badge.setAttribute("aria-expanded", "true");
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    popover.querySelector<HTMLButtonElement>("button")?.focus();
  }

  const entries: Entry[] = landmarks.map((landmark, index) => {
    const element = document.createElement("div");
    element.className = styles.landmark;
    element.setAttribute("data-testid", "tracker-landmark");
    element.setAttribute("data-landmark-index", String(index));

    const badge = document.createElement("button");
    badge.type = "button";
    badge.className = styles.badge;
    badge.setAttribute("aria-label", copy.map.routeMap.landmark(landmark.name));
    badge.setAttribute("aria-haspopup", "dialog");
    badge.setAttribute("aria-expanded", "false");
    badge.setAttribute("data-testid", "tracker-landmark-badge");

    let unmountIcon: (() => void) | null = null;
    if (landmark.icon && mountIcon !== null) {
      const holder = document.createElement("span");
      holder.className = styles.icon;
      holder.setAttribute("aria-hidden", "true");
      holder.setAttribute("data-testid", "tracker-landmark-icon");
      badge.appendChild(holder);
      unmountIcon = mountIcon(holder, landmark.icon);
    } else {
      const dot = document.createElement("span");
      dot.className = styles.dot;
      dot.setAttribute("aria-hidden", "true");
      dot.setAttribute("data-testid", "tracker-landmark-dot");
      badge.appendChild(dot);
    }

    const label = document.createElement("span");
    label.className = styles.label;
    label.textContent = landmark.name;
    label.setAttribute("aria-hidden", "true");

    element.append(badge, label);

    class LandmarkOverlay extends libs.maps.OverlayView {
      onAdd() {
        libs.maps.OverlayView.preventMapHitsAndGesturesFrom(element);
        this.getPanes()?.overlayMouseTarget.appendChild(element);
      }
      draw() {
        const point = this.getProjection()?.fromLatLngToDivPixel({ lat: landmark.lat, lng: landmark.lng });
        if (!point) return;
        element.style.left = `${point.x}px`;
        element.style.top = `${point.y}px`;
      }
      onRemove() {
        element.remove();
      }
    }

    const entry: Entry = { landmark, element, badge, overlay: new LandmarkOverlay(), unmountIcon };
    badge.addEventListener("click", () => {
      if (open === entry) closePopover(false);
      else openPopover(entry);
    });
    return entry;
  });

  return {
    update({ visible, zoom }) {
      const next = visible && zoom >= LANDMARKS_MIN_ZOOM;
      if (next === shown) return;
      shown = next;
      if (!shown) closePopover(false);
      for (const e of entries) e.overlay.setMap(shown ? map : null);
    },
    destroy() {
      closePopover(false);
      shown = false;
      for (const e of entries) {
        e.overlay.setMap(null);
        e.unmountIcon?.();
        e.unmountIcon = null;
      }
    },
  };
}

function buildPopover(landmark: TrackerLandmark, onClose: () => void): HTMLElement {
  const titleId = `tracker-landmark-title-${Math.random().toString(36).slice(2)}`;
  const root = document.createElement("div");
  root.className = styles.popover;
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-labelledby", titleId);
  root.setAttribute("data-testid", "tracker-landmark-popover");

  const head = document.createElement("div");
  head.className = styles.popoverHead;
  const title = document.createElement("h3");
  title.id = titleId;
  title.className = styles.popoverTitle;
  title.textContent = landmark.name;
  const close = document.createElement("button");
  close.type = "button";
  close.className = styles.popoverClose;
  close.setAttribute("aria-label", copy.map.routeMap.closeLandmark);
  close.setAttribute("data-testid", "tracker-landmark-popover-close");
  close.innerHTML = CLOSE_SVG;
  close.addEventListener("click", onClose);
  head.append(title, close);
  root.appendChild(head);

  const description = typeof landmark.description === "string" ? landmark.description.trim() : "";
  if (description !== "") {
    const text = document.createElement("p");
    text.className = styles.popoverText;
    text.textContent = landmark.description ?? "";
    root.appendChild(text);
  }

  const link = document.createElement("a");
  link.className = `${btn.btn} ${btn.btnSm} ${styles.directions}`;
  link.href = directionsHref(landmark.lat, landmark.lng);
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = copy.map.routeMap.directions;
  link.setAttribute("data-testid", "tracker-landmark-directions");
  root.appendChild(link);
  return root;
}
