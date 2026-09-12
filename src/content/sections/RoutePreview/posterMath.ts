// docs/site.md section 8.5. Pure math for the poster viewer: fit-on-load
// scale and the clamp between fit and six-times-fit. These are unit-tested
// alongside the interactive component.

export const MAX_ZOOM_MULTIPLIER = 6;

export type FitResult = { scale: number; x: number; y: number };

export function fitScale(frame: { width: number; height: number }, image: { width: number; height: number }): number {
  if (image.width <= 0 || image.height <= 0 || frame.width <= 0 || frame.height <= 0) return 1;
  return Math.min(frame.width / image.width, frame.height / image.height);
}

export function fitTransform(
  frame: { width: number; height: number },
  image: { width: number; height: number },
): FitResult {
  const scale = fitScale(frame, image);
  return {
    scale,
    x: (frame.width - image.width * scale) / 2,
    y: (frame.height - image.height * scale) / 2,
  };
}

export function clampScale(scale: number, min: number): number {
  const max = min * MAX_ZOOM_MULTIPLIER;
  if (scale < min) return min;
  if (scale > max) return max;
  return scale;
}

// Zooming about an anchor keeps the image point under the anchor stationary
// on the screen: newX = anchorX − (anchorX − oldX) × (newScale/oldScale).
export function zoomAbout(
  state: { x: number; y: number; scale: number },
  factor: number,
  anchor: { x: number; y: number },
  min: number,
): { x: number; y: number; scale: number } {
  const target = clampScale(state.scale * factor, min);
  if (target === state.scale) return state;
  const k = target / state.scale;
  return {
    scale: target,
    x: anchor.x - (anchor.x - state.x) * k,
    y: anchor.y - (anchor.y - state.y) * k,
  };
}
