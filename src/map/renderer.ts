// docs/site.md section 8.1. The renderer choice for a map surface: MapLibre
// when the event carries a map, at least one enabled MapLibre theme, and the
// browser gives a WebGL 2 context without a major performance caveat; Google
// otherwise. `canUseWebGl2` asks once per page and keeps the answer.
// `reportRenderer` sends one `map_renderer` event per surface per page with
// the choice and its reason; the reasons take precedence in the order
// `no_map`, `no_theme`, `webgl2_unavailable`. `reportRendererFallback`
// sends one `map_renderer_fallback` event per surface per page when a
// MapLibre surface falls back to Google at runtime, with the reason.

import type { Snapshot } from "../contracts";
import { sendEvent } from "../lib/analytics";

export type Renderer = "maplibre" | "google";
export type RendererSurface = "route" | "live";
export type RendererReason = "ok" | "no_map" | "no_theme" | "webgl2_unavailable";
export type FallbackReason = "context_lost" | "chunk_failed" | "style_failed";

type RendererInput = Pick<Snapshot, "event" | "trackerThemes"> | null | undefined;

let webGl2: boolean | null = null;

export function canUseWebGl2(): boolean {
  if (webGl2 !== null) return webGl2;
  let ok = false;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true });
    if (gl !== null && gl !== undefined) {
      ok = true;
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
  } catch {
    ok = false;
  }
  webGl2 = ok;
  return ok;
}

export function rendererChoice(snapshot: RendererInput): {
  renderer: Renderer;
  reason: RendererReason;
} {
  if (snapshot?.event?.trackerMap == null) return { renderer: "google", reason: "no_map" };
  const themes = snapshot.trackerThemes ?? [];
  if (!themes.some((t) => t.renderer === "maplibre")) {
    return { renderer: "google", reason: "no_theme" };
  }
  if (!canUseWebGl2()) return { renderer: "google", reason: "webgl2_unavailable" };
  return { renderer: "maplibre", reason: "ok" };
}

export function pickRenderer(snapshot: RendererInput): Renderer {
  return rendererChoice(snapshot).renderer;
}

const reported = new Set<RendererSurface>();

export function reportRenderer(surface: RendererSurface, snapshot: RendererInput): Renderer {
  const { renderer, reason } = rendererChoice(snapshot);
  if (!reported.has(surface)) {
    reported.add(surface);
    sendEvent("map_renderer", { surface, renderer, reason });
  }
  return renderer;
}

const fellBack = new Set<RendererSurface>();

export function reportRendererFallback(surface: RendererSurface, reason: FallbackReason): void {
  if (fellBack.has(surface)) return;
  fellBack.add(surface);
  sendEvent("map_renderer_fallback", { surface, reason });
}

// Forgets which surfaces have reported, so each test starts on a fresh page.
export function resetRendererReportsForTests(): void {
  reported.clear();
  fellBack.clear();
}
