// docs/site.md section 4. Scroll on navigation; renders nothing. A PUSH or
// REPLACE to another pathname scrolls the window to the top instantly. A
// location with a hash scrolls the element with that id into view instead
// (block start, so the html scroll-padding-top keeps it clear of the sticky
// header), retrying once on the next animation frame when the element is
// not rendered yet; a hash-only change on the same pathname scrolls to its
// anchor too. A POP (back, forward, the first load) leaves the offset to the
// browser, and a change of the search alone scrolls nothing.

import { useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

function anchorFor(hash: string): HTMLElement | null {
  let id = hash.slice(1);
  try {
    id = decodeURIComponent(id);
  } catch {
    // A malformed escape is looked up as written.
  }
  return id === "" ? null : document.getElementById(id);
}

function scrollTop() {
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
}

export function ScrollToTop() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const previous = useRef(location);

  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = location;
    if (navigationType === "POP") return;

    const pathChanged = before.pathname !== location.pathname;
    const hashChanged = before.hash !== location.hash;

    if (location.hash !== "" && (pathChanged || hashChanged)) {
      const element = anchorFor(location.hash);
      if (element !== null) {
        element.scrollIntoView({ block: "start" });
        return;
      }
      const frame = window.requestAnimationFrame(() => {
        const late = anchorFor(location.hash);
        if (late !== null) late.scrollIntoView({ block: "start" });
        else if (pathChanged) scrollTop();
      });
      return () => window.cancelAnimationFrame(frame);
    }

    if (pathChanged) scrollTop();
  }, [location, navigationType]);

  return null;
}
