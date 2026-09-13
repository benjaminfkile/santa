// docs/site.md section 8.4. The `standard` theme: Google's default map. The style array,
// the route and label colours, and the chrome palette (what the tracker's
// pills, panels, tiles, and buttons paint with while this style is on) are
// the legacy tracker's Standard theme, carried over unchanged.

import type { MapTheme } from "./index";

export const standardTheme: MapTheme = {
  key: "standard",
  label: "Standard",
  styles: [
    {
      "featureType": "administrative",
      "elementType": "geometry",
      "stylers": [
        {
          "visibility": "on"
        }
      ]
    },
    {
      "featureType": "poi",
      "stylers": [
        {
          "visibility": "on"
        }
      ]
    },
    {
      "featureType": "road",
      "elementType": "labels.icon",
      "stylers": [
        {
          "visibility": "on"
        }
      ]
    },
    {
      "featureType": "transit",
      "stylers": [
        {
          "visibility": "on"
        }
      ]
    }
  ] as MapTheme["styles"],
  routeColor: "#1a56c4",
  routeOpacity: 0.9,
  arrowColor: "#ffffff",
  timeLabelBg: "#1c1c1e",
  timeLabelFg: "#ffffff",
  timeLabelOpacity: 0.8,
  userColor: "#c62828",
  chrome: {
    bg: "#ffffff",
    fg: "#5f6368",
    text: "#202124",
    tile: "#e8f0fe",
    tileFg: "#1a56c4",
    panel: "#ffffffe6",
    accent: "#1a56c4",
  },
};
