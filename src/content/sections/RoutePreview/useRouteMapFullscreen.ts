// docs/site.md section 8.9. The route map's fullscreen state over the
// element that wraps the map frame and the slider, through the shared
// `useFullscreen`: the Fullscreen API where the element takes it, the
// takeover (the wrapper in `TakeoverPortal`, see `.routeMapStageTakeover`)
// everywhere else and wherever a request is refused or never confirmed.

import type { RefObject } from "react";
import { useFullscreen, type Fullscreen, type FullscreenMode } from "../../../lib/useFullscreen";

export type RouteMapFullscreenMode = FullscreenMode;

export type RouteMapFullscreen = Fullscreen;

export function useRouteMapFullscreen(ref: RefObject<HTMLElement | null>): RouteMapFullscreen {
  return useFullscreen(ref);
}
