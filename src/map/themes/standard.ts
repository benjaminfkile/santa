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
  routeColor: "#00000088",
  routeOpacity: 1,
  arrowColor: "#00000088",
  timeLabelBg: "#000000",
  timeLabelFg: "#ffffff",
  timeLabelOpacity: 0.65,
  userColor: "#000000",
  chrome: {
    bg: "#ffffff",
    fg: "#666666",
    text: "#000000",
    tile: "#bdd8bb",
    tileFg: "#000000",
    panel: "#ffffffcf",
    accent: "#2962ff",
  },
};
