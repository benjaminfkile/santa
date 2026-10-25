// docs/site.md section 7.6. The tracker's bottom-right controls: the
// north-up button ("Point north up") stands at the top of the column only
// while the map is rotated, above the zoom pair or the recenter button,
// its needle turned against the bearing, and calls `onNorthUp`.

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { MapControls } from "../../../src/content/sections/Map/MapControls";

afterEach(() => cleanup());

function controls(over: Partial<Parameters<typeof MapControls>[0]> = {}) {
  const props = {
    following: true,
    onRecenter: vi.fn(),
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onNorthUp: vi.fn(),
    ...over,
  };
  const result = render(<MapControls {...props} />);
  return { ...result, props };
}

describe("MapControls north-up", () => {
  it("renders no north-up button while the map is north-up", () => {
    const { queryByTestId } = controls({ rotated: false });
    expect(queryByTestId("map-north-up")).toBeNull();
  });

  it("renders it first while rotated, above the zoom pair, and calls onNorthUp", () => {
    const { getByTestId, getByRole, props } = controls({ rotated: true, bearing: 30 });
    const button = getByTestId("map-north-up");
    expect(getByRole("button", { name: "Point north up" })).toBe(button);
    expect(getByTestId("map-controls").firstElementChild?.contains(button)).toBe(true);
    expect(button.querySelector("svg")?.style.transform).toBe("rotate(-30deg)");
    fireEvent.click(button);
    expect(props.onNorthUp).toHaveBeenCalledTimes(1);
    expect(props.onZoomIn).not.toHaveBeenCalled();
  });

  it("sits above the recenter button once Follow is off", () => {
    const { getByTestId } = controls({ rotated: true, following: false });
    const column = getByTestId("map-controls");
    expect(column.children).toHaveLength(2);
    expect(column.firstElementChild?.contains(getByTestId("map-north-up"))).toBe(true);
    expect(column.lastElementChild?.contains(getByTestId("map-recenter"))).toBe(true);
  });
});
