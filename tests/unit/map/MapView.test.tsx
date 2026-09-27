// docs/site.md sections 7.6 and 8. MapView's root takes its geometry from
// its class alone, so the section around it sets the map's height.

import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { MapView } from "../../../src/map/MapView";

vi.mock("../../../src/map/loadMaps", () => ({
  loadMaps: () => new Promise(() => {}),
}));

afterEach(() => cleanup());

describe("MapView", () => {
  it("carries no inline geometry on its root", () => {
    const { container } = render(<MapView options={{} as never} className="host" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toBe("host");
    expect(root.getAttribute("style")).toBeNull();
    expect(root.style.height).toBe("");
    expect(root.style.position).toBe("");
  });
});
