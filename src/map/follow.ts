// docs/site.md sections 8.3, 8.7, and 8.10. The follow rule shared by the
// Google and the MapLibre tracker controllers. While following, a motion
// frame asks `needsPan` whether the displayed point, in container pixels,
// has left the central box that spans 60 percent of each dimension
// (FOLLOW_MARGIN on every side); when it has, and the last follow pan
// started at least FOLLOW_GAP_MS ago (`followPanDue`, so the pan before it
// of FOLLOW_PAN_MS is over), the controller makes one eased pan to the
// displayed point, zoom untouched. A container with no size never needs a pan.
// `watchGestures` turns Follow off before the renderer moves: capture-phase
// listeners on the map container call `onGesture` for a pointer that moves
// more than GESTURE_SLOP_PX while down, a `wheel`, a `touchstart` with two
// or more touches, and a `dblclick`; the returned function removes them.

export const FOLLOW_MARGIN = 0.2;
export const FOLLOW_PAN_MS = 300;
export const FOLLOW_GAP_MS = 500;
export const GESTURE_SLOP_PX = 4;

export type Pixel = { x: number; y: number };
export type Size = { width: number; height: number };

// Whether `point` lies outside the central box of a container of `size`.
export function needsPan(point: Pixel, size: Size): boolean {
  if (size.width <= 0 || size.height <= 0) return false;
  const left = size.width * FOLLOW_MARGIN;
  const top = size.height * FOLLOW_MARGIN;
  return (
    point.x < left ||
    point.x > size.width - left ||
    point.y < top ||
    point.y > size.height - top
  );
}

// Whether a follow pan may start at `now`, the last one having started at
// `last` (null for never).
export function followPanDue(now: number, last: number | null): boolean {
  return last === null || now - last >= FOLLOW_GAP_MS;
}

// An ease out cubic over [0, 1].
export function followEasing(t: number): number {
  return 1 - (1 - t) ** 3;
}

export function watchGestures(container: HTMLElement, onGesture: () => void): () => void {
  // Where each pointer now down went down.
  const down = new Map<number, Pixel>();

  const onPointerDown = (e: PointerEvent) => {
    down.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const onPointerMove = (e: PointerEvent) => {
    const at = down.get(e.pointerId);
    if (at === undefined) return;
    if (Math.hypot(e.clientX - at.x, e.clientY - at.y) <= GESTURE_SLOP_PX) return;
    down.delete(e.pointerId);
    onGesture();
  };
  const onPointerUp = (e: PointerEvent) => {
    down.delete(e.pointerId);
  };
  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length >= 2) onGesture();
  };
  const onOther = () => onGesture();

  const capture = { capture: true } as const;
  const passive = { capture: true, passive: true } as const;
  container.addEventListener("pointerdown", onPointerDown, capture);
  container.addEventListener("pointermove", onPointerMove, capture);
  container.addEventListener("pointerup", onPointerUp, capture);
  container.addEventListener("pointercancel", onPointerUp, capture);
  container.addEventListener("wheel", onOther, passive);
  container.addEventListener("touchstart", onTouchStart, passive);
  container.addEventListener("dblclick", onOther, capture);
  return () => {
    container.removeEventListener("pointerdown", onPointerDown, capture);
    container.removeEventListener("pointermove", onPointerMove, capture);
    container.removeEventListener("pointerup", onPointerUp, capture);
    container.removeEventListener("pointercancel", onPointerUp, capture);
    container.removeEventListener("wheel", onOther, capture);
    container.removeEventListener("touchstart", onTouchStart, capture);
    container.removeEventListener("dblclick", onOther, capture);
    down.clear();
  };
}
