// docs/site.md sections 8.5 and 8.9. Renders its children into one host
// element that sits in place (an anchor in the page flow) and moves to
// document.body while `active`, so a transformed or filtered ancestor
// never traps the fixed takeover and the children keep their React state
// and DOM (a map canvas is moved, not rebuilt). Host and anchor are
// `display: contents`, so the children lay out as if rendered in place.
// The body scroll is locked only while the host is under document.body
// and released when it leaves or the portal unmounts.

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { lockBodyScroll } from "./fullscreen";

export type TakeoverPortalProps = {
  active: boolean;
  children: ReactNode;
};

function createHost(): HTMLDivElement {
  const host = document.createElement("div");
  host.style.display = "contents";
  return host;
}

const CONTENTS = { display: "contents" } as const;

export function TakeoverPortal({ active, children }: TakeoverPortalProps) {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [host] = useState(createHost);

  useLayoutEffect(() => {
    const target = active ? document.body : anchorRef.current;
    if (target === null) return;
    target.appendChild(host);
    const release = active ? lockBodyScroll() : null;
    return () => {
      release?.();
      host.remove();
    };
  }, [active, host]);

  return (
    <>
      <div ref={anchorRef} style={CONTENTS} />
      {createPortal(children, host)}
    </>
  );
}
