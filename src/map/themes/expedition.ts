// docs/site.md section 8.4. The `expedition` theme: outdoor tones with a
// bright accent for visibility.

import type { MapTheme } from "./index";

export const expeditionTheme: MapTheme = {
  key: "expedition",
  label: "Expedition",
  styles: [
    { featureType: "poi", stylers: [{ visibility: "off" }] },
    { featureType: "transit", stylers: [{ visibility: "off" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#f6f5f2" }] },
  ],
  routeColor: "#e05e2b",
  routeOpacity: 0.95,
  arrowColor: "#e05e2b",
  timeLabelBg: "#f6f5f2",
  timeLabelFg: "#1f2937",
  timeLabelOpacity: 0.95,
  userColor: "#2563eb",
};
