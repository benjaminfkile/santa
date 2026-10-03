// docs/site.md section 7.6. The shared gauge recipe of the flight data
// dock: the 270 degree arc helper, the gauge frame, and the speed dial on
// its 0 to 120 mph scale.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { arcLength, arcPath } from "../../../../src/content/sections/Map/gauges/arc";
import { GaugeFrame, GAUGE_RADIUS } from "../../../../src/content/sections/Map/gauges/GaugeFrame";
import { SpeedDial } from "../../../../src/content/sections/Map/gauges/SpeedDial";

const gaugesDir = resolve(__dirname, "../../../../src/content/sections/Map/gauges");

afterEach(() => cleanup());

// The endpoint and large arc flag of a path built by arcPath.
function parse(d: string) {
  const m = d.match(/^M (\S+) (\S+) A (\S+) (\S+) 0 ([01]) 1 (\S+) (\S+)$/);
  expect(m).not.toBeNull();
  const [, sx, sy, rx, ry, large, ex, ey] = m!;
  return { sx: +sx, sy: +sy, rx: +rx, ry: +ry, large: +large, ex: +ex, ey: +ey };
}

const H = 10 * Math.SQRT1_2;

describe("arcPath", () => {
  it("at 0 starts and ends at 135 degrees, bottom left", () => {
    const p = parse(arcPath(0, 10, 50, 50));
    expect(p.sx).toBeCloseTo(50 - H, 2);
    expect(p.sy).toBeCloseTo(50 + H, 2);
    expect(p.ex).toBeCloseTo(p.sx, 2);
    expect(p.ey).toBeCloseTo(p.sy, 2);
    expect(p.rx).toBe(10);
    expect(p.ry).toBe(10);
    expect(p.large).toBe(0);
  });

  it("at 0.5 runs clockwise to 270 degrees, the top, with a small arc", () => {
    const p = parse(arcPath(0.5, 10, 50, 50));
    expect(p.ex).toBeCloseTo(50, 2);
    expect(p.ey).toBeCloseTo(40, 2);
    expect(p.large).toBe(0);
  });

  it("at 1 runs to 405 degrees, bottom right, with the large arc flag", () => {
    const p = parse(arcPath(1, 10, 50, 50));
    expect(p.ex).toBeCloseTo(50 + H, 2);
    expect(p.ey).toBeCloseTo(50 + H, 2);
    expect(p.large).toBe(1);
  });

  it("clamps a fraction out of range", () => {
    expect(arcPath(1.7, 10, 50, 50)).toBe(arcPath(1, 10, 50, 50));
    expect(arcPath(-0.3, 10, 50, 50)).toBe(arcPath(0, 10, 50, 50));
  });

  it("arcLength is three quarters of the circumference", () => {
    expect(arcLength(10)).toBeCloseTo(15 * Math.PI, 6);
  });
});

describe("GaugeFrame", () => {
  it("renders the track, the three texts, and the aria-label, with no value arc without a fraction", () => {
    const utils = render(<GaugeFrame value="42" unit="ft" label="Test" testId="g" />);
    const svg = utils.getByTestId("g");
    expect(svg.tagName.toLowerCase()).toBe("svg");
    expect(svg.getAttribute("viewBox")).toBe("0 0 54 54");
    expect(svg.getAttribute("role")).toBe("img");
    expect(svg.getAttribute("aria-label")).toBe("Test 42 ft");
    expect(utils.getByTestId("g-track").getAttribute("d")).toBe(arcPath(1, GAUGE_RADIUS, 27, 27));
    expect(utils.queryByTestId("g-arc")).toBeNull();
    expect(utils.getByTestId("g-value").textContent).toBe("42");
    expect(utils.getByTestId("g-unit").textContent).toBe("ft");
    expect(utils.getByTestId("g-label").textContent).toBe("TEST");
  });

  it("draws the value arc dashed to the fraction", () => {
    const utils = render(<GaugeFrame value="1" unit="u" label="L" fraction={0.25} testId="g" />);
    const arc = utils.getByTestId("g-arc");
    const length = arcLength(GAUGE_RADIUS);
    expect(arc.getAttribute("d")).toBe(arcPath(1, GAUGE_RADIUS, 27, 27));
    expect(Number(arc.getAttribute("stroke-dashoffset"))).toBeCloseTo(length * 0.75, 6);
  });

  it("renders extra marks as children", () => {
    const utils = render(
      <GaugeFrame value="1" unit="u" label="L" testId="g">
        <circle data-testid="mark" r={1} />
      </GaugeFrame>,
    );
    expect(utils.getByTestId("g").contains(utils.getByTestId("mark"))).toBe(true);
  });

  it("the stylesheet sweeps over 300 ms, not at all under reduced motion, from the chrome tokens", () => {
    const css = readFileSync(resolve(gaugesDir, "GaugeFrame.module.css"), "utf8");
    expect(css).toMatch(/\.arc \{[^}]*transition: stroke-dashoffset 300ms/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.arc \{ transition: none; \}/);
    expect(css).toMatch(/\.track \{[^}]*stroke: var\(--panel-2\);[^}]*stroke-width: 5;[^}]*stroke-linecap: round;/);
    expect(css).toMatch(/\.arc \{[^}]*stroke: var\(--accent\);/);
    expect(css).toMatch(/\.gauge \{[^}]*width: 60px;[^}]*height: 60px;/);
    expect(css).toMatch(/@media \(max-width: 760px\) \{\s*\.gauge \{ width: 54px; height: 54px; \}/);
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(/);
  });
});

describe("SpeedDial", () => {
  const length = arcLength(GAUGE_RADIUS);
  function dial(speedMph: number | null) {
    const utils = render(<SpeedDial speedMph={speedMph} />);
    return {
      utils,
      value: utils.getByTestId("flight-dock-speed-value").textContent,
      arc: utils.queryByTestId("flight-dock-speed-arc"),
      label: utils.getByTestId("flight-dock-speed").getAttribute("aria-label"),
    };
  }

  it("at 0 shows 0 and an empty arc", () => {
    const d = dial(0);
    expect(d.value).toBe("0");
    expect(Number(d.arc!.getAttribute("stroke-dashoffset"))).toBeCloseTo(length, 6);
    expect(d.label).toBe("Speed 0 mph");
    expect(d.utils.getByTestId("flight-dock-speed-unit").textContent).toBe("mph");
    expect(d.utils.getByTestId("flight-dock-speed-label").textContent).toBe("SPEED");
  });

  it("at 58 shows whole mph and fills 58 of 120", () => {
    const d = dial(57.6);
    expect(d.value).toBe("58");
    expect(Number(d.arc!.getAttribute("stroke-dashoffset"))).toBeCloseTo(length * (1 - 57.6 / 120), 6);
  });

  it("at 120 fills the arc", () => {
    const d = dial(120);
    expect(d.value).toBe("120");
    expect(Number(d.arc!.getAttribute("stroke-dashoffset"))).toBeCloseTo(0, 6);
  });

  it("at 150 keeps the arc full and the number exact", () => {
    const d = dial(150);
    expect(d.value).toBe("150");
    expect(Number(d.arc!.getAttribute("stroke-dashoffset"))).toBeCloseTo(0, 6);
    expect(d.label).toBe("Speed 150 mph");
  });

  it("null shows the placeholder and no value arc", () => {
    const d = dial(null);
    expect(d.value).toBe("N/A");
    expect(d.arc).toBeNull();
    expect(d.utils.getByTestId("flight-dock-speed-track")).toBeInTheDocument();
  });
});
