// docs/site.md section 7.6. Cancels a page pinch during the live takeover.
// Safari ignores the viewport tag's user-scalable and maximum-scale for
// pinch, so the page cancels the gesture itself: WebKit's gesturestart and
// gesturechange, and a touchmove with more than one touch, are default
// prevented when their target is page-owned. A target is page-owned when it
// is not an Element, when it sits inside [data-map-overlay] (Google ignores
// gestures from the overlays), or when it sits outside [data-map-canvas].
// A pinch on the map canvas itself is left to the map's own zoom.

function pageOwned(target: EventTarget | null): boolean {
  if (!target || typeof (target as Element).closest !== "function") return true;
  const element = target as Element;
  if (element.closest("[data-map-overlay]")) return true;
  return !element.closest("[data-map-canvas]");
}

export function installPageZoomGuard(doc: Document = document): () => void {
  const onGesture = (event: Event) => {
    if (pageOwned(event.target)) event.preventDefault();
  };
  const onTouchMove = (event: Event) => {
    const touches = (event as TouchEvent).touches;
    if (touches && touches.length > 1 && pageOwned(event.target)) event.preventDefault();
  };
  const options: AddEventListenerOptions = { passive: false };
  doc.addEventListener("gesturestart", onGesture, options);
  doc.addEventListener("gesturechange", onGesture, options);
  doc.addEventListener("touchmove", onTouchMove, options);
  return () => {
    doc.removeEventListener("gesturestart", onGesture, options);
    doc.removeEventListener("gesturechange", onGesture, options);
    doc.removeEventListener("touchmove", onTouchMove, options);
  };
}
