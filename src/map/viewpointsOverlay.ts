// docs/site.md section 8.5. Viewpoints overlay: the site settings'
// viewpoints on the live tracker, one Google Maps `OverlayView` per
// viewpoint. Each element is a 28 px round badge on the glass recipe (the
// viewpoint's icon when it has one, mounted through `mountIcon`, else an
// 8 px accent dot) with the name beside it in the map's label style. The
// badge is a button whose accessible name is "About <name>"; a click opens
// the viewpoint's popover above the badge (the name, the description when
// there is one, and a "Get directions" link to the point, see
// directionsHref, opening in a new tab). The popover lives in the popover
// host (the map view wrapper beside the corner stacks), not in Google's
// pane, so it paints above the stacks and is not clipped by the map; it is
// placed from the point's container pixel and moved on every draw, kept
// POPOVER_EDGE px inside the host's width. One popover is open at a time;
// its close button, Escape, and a pointer press anywhere outside it and
// the open badge close it. The overlays are on the map only while the
// toggle is on and the zoom is at least VIEWPOINTS_MIN_ZOOM. Below
// NAME_MIN_ZOOM each element carries `data-name="hidden"` and the name
// hides, shown instead as a tooltip above the badge while the badge is
// hovered or focused on a hover device; at or above it `data-name="shown"`.
// A click opens the popover at any zoom. `createViewpointBadges` builds the
// elements and the popover for any map; the MapLibre tracker stands the
// same elements in its own markers.

import type { IconRef } from "../contracts";
import { copy } from "../copy/copy";
import { directionsHref } from "../lib/directions";
import * as styles from "./ViewpointsOverlay.module.css";
import * as btn from "../ui/Button.module.css";

export const VIEWPOINTS_MIN_ZOOM = 10;
// The least zoom at which the viewpoint names and the time label text show.
export const NAME_MIN_ZOOM = 12;
// The gap between the point and the popover's bottom edge, clear of the badge.
export const POPOVER_GAP = 22;
// The least distance between the popover and either side of the host.
export const POPOVER_EDGE = 8;

export type TrackerViewpoint = {
  name: string;
  lat: number;
  lng: number;
  icon?: IconRef | null;
  description?: string | null;
};

// Draws `icon` into `container` and returns the cleanup that removes it.
export type MountIcon = (container: HTMLElement, icon: IconRef) => () => void;

export type ViewpointsOverlay = {
  update(opts: { visible: boolean; zoom: number }): void;
  destroy(): void;
};

// The badges and the popover of a viewpoint list, whatever draws them on
// the map: one element per viewpoint (`items`, in list order) and the one
// open popover in the popover host, placed at `toPixel(index)` (the
// viewpoint's point in host pixels) whenever `position` runs. The Google
// overlay below and the MapLibre tracker's markers both use it.
export type ViewpointBadges = {
  items: readonly { viewpoint: TrackerViewpoint; element: HTMLElement }[];
  setNames(zoom: number): void;
  position(): void;
  close(): void;
  destroy(): void;
};

type Entry = {
  index: number;
  viewpoint: TrackerViewpoint;
  element: HTMLElement;
  badge: HTMLButtonElement;
  unmountIcon: (() => void) | null;
};

const CLOSE_SVG =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12"/><path d="M18 6L6 18"/></svg>';

export function createViewpointBadges(
  viewpoints: readonly TrackerViewpoint[],
  mountIcon: MountIcon | null,
  popoverHost: HTMLElement,
  toPixel: (index: number) => { x: number; y: number } | null,
): ViewpointBadges {
  let open: Entry | null = null;
  let popover: HTMLElement | null = null;

  function closePopover(restoreFocus: boolean): void {
    if (open === null) return;
    const entry = open;
    open = null;
    popover?.remove();
    popover = null;
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

  // Places the open popover's bottom centre POPOVER_GAP px above the
  // entry's point in host pixels, clamped inside the host's width when both
  // the host and the popover have a measured width.
  function positionPopover(): void {
    if (open === null || popover === null) return;
    const point = toPixel(open.index);
    if (!point) return;
    let x = point.x;
    const hostWidth = popoverHost.clientWidth;
    const half = popover.offsetWidth / 2;
    if (hostWidth > 0 && half > 0) {
      const min = POPOVER_EDGE + half;
      const max = hostWidth - POPOVER_EDGE - half;
      x = min > max ? hostWidth / 2 : Math.min(Math.max(x, min), max);
    }
    popover.style.left = `${x}px`;
    popover.style.top = `${point.y - POPOVER_GAP}px`;
  }

  function openPopover(entry: Entry): void {
    closePopover(false);
    open = entry;
    popover = buildPopover(entry.viewpoint, () => closePopover(true));
    popoverHost.appendChild(popover);
    positionPopover();
    entry.badge.setAttribute("aria-expanded", "true");
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    popover.querySelector<HTMLButtonElement>("button")?.focus();
  }

  const entries: Entry[] = viewpoints.map((viewpoint, index) => {
    const element = document.createElement("div");
    element.className = styles.viewpoint;
    element.setAttribute("data-map-overlay", "");
    element.setAttribute("data-testid", "tracker-viewpoint");
    element.setAttribute("data-viewpoint-index", String(index));

    const badge = document.createElement("button");
    badge.type = "button";
    badge.className = styles.badge;
    badge.setAttribute("aria-label", copy.map.routeMap.viewpoint(viewpoint.name));
    badge.setAttribute("aria-haspopup", "dialog");
    badge.setAttribute("aria-expanded", "false");
    badge.setAttribute("data-testid", "tracker-viewpoint-badge");

    let unmountIcon: (() => void) | null = null;
    if (viewpoint.icon && mountIcon !== null) {
      const holder = document.createElement("span");
      holder.className = styles.icon;
      holder.setAttribute("aria-hidden", "true");
      holder.setAttribute("data-testid", "tracker-viewpoint-icon");
      badge.appendChild(holder);
      unmountIcon = mountIcon(holder, viewpoint.icon);
    } else {
      const dot = document.createElement("span");
      dot.className = styles.dot;
      dot.setAttribute("aria-hidden", "true");
      dot.setAttribute("data-testid", "tracker-viewpoint-dot");
      badge.appendChild(dot);
    }

    const label = document.createElement("span");
    label.className = styles.label;
    label.textContent = viewpoint.name;
    label.setAttribute("aria-hidden", "true");

    element.append(badge, label);

    const entry: Entry = { index, viewpoint, element, badge, unmountIcon };
    badge.addEventListener("click", () => {
      if (open === entry) closePopover(false);
      else openPopover(entry);
    });
    return entry;
  });

  return {
    items: entries,
    setNames(zoom) {
      const name = zoom >= NAME_MIN_ZOOM ? "shown" : "hidden";
      for (const e of entries) e.element.setAttribute("data-name", name);
    },
    position: positionPopover,
    close: () => closePopover(false),
    destroy() {
      closePopover(false);
      for (const e of entries) {
        e.unmountIcon?.();
        e.unmountIcon = null;
      }
    },
  };
}

export function createViewpointsOverlay(
  libs: { maps: google.maps.MapsLibrary },
  map: google.maps.Map,
  viewpoints: readonly TrackerViewpoint[],
  mountIcon: MountIcon | null,
  popoverHost: HTMLElement,
): ViewpointsOverlay {
  let shown = false;
  const overlays: google.maps.OverlayView[] = [];
  const badges = createViewpointBadges(viewpoints, mountIcon, popoverHost, (index) => {
    const point = overlays[index]
      ?.getProjection()
      ?.fromLatLngToContainerPixel({ lat: viewpoints[index].lat, lng: viewpoints[index].lng });
    return point ? { x: point.x, y: point.y } : null;
  });

  for (const { viewpoint, element } of badges.items) {
    class ViewpointOverlay extends libs.maps.OverlayView {
      onAdd() {
        libs.maps.OverlayView.preventMapHitsAndGesturesFrom(element);
        this.getPanes()?.overlayMouseTarget.appendChild(element);
      }
      draw() {
        const point = this.getProjection()?.fromLatLngToDivPixel({ lat: viewpoint.lat, lng: viewpoint.lng });
        if (!point) return;
        element.style.left = `${point.x}px`;
        element.style.top = `${point.y}px`;
        badges.position();
      }
      onRemove() {
        element.remove();
      }
    }
    overlays.push(new ViewpointOverlay());
  }

  return {
    update({ visible, zoom }) {
      badges.setNames(zoom);
      const next = visible && zoom >= VIEWPOINTS_MIN_ZOOM;
      if (next === shown) return;
      shown = next;
      if (!shown) badges.close();
      for (const o of overlays) o.setMap(shown ? map : null);
    },
    destroy() {
      badges.destroy();
      shown = false;
      for (const o of overlays) o.setMap(null);
    },
  };
}

function buildPopover(viewpoint: TrackerViewpoint, onClose: () => void): HTMLElement {
  const titleId = `tracker-viewpoint-title-${Math.random().toString(36).slice(2)}`;
  const root = document.createElement("div");
  root.className = styles.popover;
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-labelledby", titleId);
  root.setAttribute("data-testid", "tracker-viewpoint-popover");

  const head = document.createElement("div");
  head.className = styles.popoverHead;
  const title = document.createElement("h3");
  title.id = titleId;
  title.className = styles.popoverTitle;
  title.textContent = viewpoint.name;
  const close = document.createElement("button");
  close.type = "button";
  close.className = styles.popoverClose;
  close.setAttribute("aria-label", copy.map.routeMap.closeViewpoint);
  close.setAttribute("data-testid", "tracker-viewpoint-popover-close");
  close.innerHTML = CLOSE_SVG;
  close.addEventListener("click", onClose);
  head.append(title, close);
  root.appendChild(head);

  const description = typeof viewpoint.description === "string" ? viewpoint.description.trim() : "";
  if (description !== "") {
    const text = document.createElement("p");
    text.className = styles.popoverText;
    text.textContent = viewpoint.description ?? "";
    root.appendChild(text);
  }

  const link = document.createElement("a");
  link.className = `${btn.btn} ${btn.btnSm} ${styles.directions}`;
  link.href = directionsHref(viewpoint.lat, viewpoint.lng);
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = copy.map.routeMap.directions;
  link.setAttribute("data-testid", "tracker-viewpoint-directions");
  root.appendChild(link);
  return root;
}
