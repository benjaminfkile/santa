// docs/site.md section 8.4. The `charcoal` theme: dark greyscale with a
// warm accent to keep the route legible.

import type { MapTheme } from "./index";

export const charcoalTheme: MapTheme = {
  key: "charcoal",
  label: "Charcoal",
  styles: [
    { featureType: "poi", stylers: [{ visibility: "off" }] },
    { featureType: "transit", stylers: [{ visibility: "off" }] },
    { elementType: "geometry", stylers: [{ color: "#2a2a2a" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#c8c8c8" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#1a1a1a" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#151515" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#3a3a3a" }] },
  ],
  routeColor: "#f59e0b",
  routeOpacity: 0.95,
  arrowColor: "#f59e0b",
  timeLabelBg: "#111111",
  timeLabelFg: "#f5f5f5",
  timeLabelOpacity: 0.95,
  userColor: "#22d3ee",
};
