// docs/site.md section 7.6. The shared gauge recipe of the flight data
// dock: the 270 degree arc helper, the gauge frame, the speed dial on its
// 0 to 120 mph scale, the altitude dial on its 0 to 10,000 ft scale, the
// heading compass with its short-way needle, on its
// three hour scale.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { arcLength, arcPath } from "../../../../src/content/sections/Map/gauges/arc";
import { GaugeFrame, GAUGE_RADIUS, valueFontSize } from "../../../../src/content/sections/Map/gauges/GaugeFrame";
import { SpeedDial } from "../../../../src/content/sections/Map/gauges/SpeedDial";
import { AltitudeDial } from "../../../../src/content/sections/Map/gauges/AltitudeDial";
import {
  HeadingCompass,
  TICK_LENGTH,
  MINOR_TICK_LENGTH,
  NEEDLE_INNER,
  shortestRotation,
} from "../../../../src/content/sections/Map/gauges/HeadingCompass";

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

describe("valueFontSize", () => {
  // The value sits in a 54 unit box. A short reading gets the full size; a
  // long one has to come down or it runs through the dial's walls.
  it("gives a short reading the full size", () => {
    expect(valueFontSize("58")).toBe(16);
    expect(valueFontSize("N/A")).toBe(16);
  });

  it("steps down as the reading gets longer", () => {
    expect(valueFontSize("4.1k")).toBe(14);
    expect(valueFontSize("12.3k")).toBe(12);
    expect(valueFontSize("1h 12m")).toBe(10.5);
    expect(valueFontSize("312° NW")).toBe(9);
  });

  it("keeps the longest reading inside the 54 unit box", () => {
    // The mono face runs about 0.6 em per character, so the width is the
    // size times 0.6 times the length.
    for (const reading of ["58", "4.1k", "12.3k", "1h 12m", "312° NW", "359° NW"]) {
      const width = valueFontSize(reading) * 0.6 * reading.length;
      expect(width).toBeLessThan(54);
    }
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

  it("leaves out the track with track={false}", () => {
    const utils = render(<GaugeFrame value="1" unit="" label="L" track={false} testId="g" />);
    expect(utils.queryByTestId("g-track")).toBeNull();
    expect(utils.getByTestId("g").getAttribute("aria-label")).toBe("L 1");
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
    expect(css).toContain("width: 70px;");
    expect(css).toContain(".gauge { width: 64px; height: 64px; }");
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(/);
  });
});

describe("SpeedDial", () => {
  const length = arcLength(GAUGE_RADIUS);
  function dial(speedMph: number | null) {
    const utils = render(<SpeedDial speedMph={speedMph} />);
    return {
      utils,
      value: utils.getByTestId("flight-gauge-speed-value").textContent,
      arc: utils.queryByTestId("flight-gauge-speed-arc"),
      label: utils.getByTestId("flight-gauge-speed").getAttribute("aria-label"),
    };
  }

  it("at 0 shows 0 and an empty arc", () => {
    const d = dial(0);
    expect(d.value).toBe("0");
    expect(Number(d.arc!.getAttribute("stroke-dashoffset"))).toBeCloseTo(length, 6);
    expect(d.label).toBe("Speed 0 mph");
    expect(d.utils.getByTestId("flight-gauge-speed-unit").textContent).toBe("mph");
    expect(d.utils.getByTestId("flight-gauge-speed-label").textContent).toBe("SPEED");
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
    expect(d.utils.getByTestId("flight-gauge-speed-track")).toBeInTheDocument();
  });
});

describe("AltitudeDial", () => {
  const length = arcLength(GAUGE_RADIUS);
  function dial(altitudeFt: number | null) {
    const utils = render(<AltitudeDial altitudeFt={altitudeFt} />);
    const arc = utils.queryByTestId("flight-gauge-altitude-arc");
    return {
      utils,
      value: utils.getByTestId("flight-gauge-altitude-value").textContent,
      arc,
      offset: arc ? Number(arc.getAttribute("stroke-dashoffset")) : null,
      label: utils.getByTestId("flight-gauge-altitude").getAttribute("aria-label"),
    };
  }

  it("at 0 shows 0 and an empty arc", () => {
    const d = dial(0);
    expect(d.value).toBe("0");
    expect(d.offset).toBeCloseTo(length, 6);
    expect(d.label).toBe("Altitude 0 ft");
    expect(d.utils.getByTestId("flight-gauge-altitude-unit").textContent).toBe("ft");
    expect(d.utils.getByTestId("flight-gauge-altitude-label").textContent).toBe("ALTITUDE");
  });

  it("at 4120 reads 4.1k and fills 4120 of 10000", () => {
    const d = dial(4120);
    expect(d.value).toBe("4.1k");
    expect(d.offset).toBeCloseTo(length * (1 - 4120 / 10000), 6);
    expect(d.label).toBe("Altitude 4.1k ft");
  });

  it("at 10000 fills the arc", () => {
    const d = dial(10000);
    expect(d.value).toBe("10k");
    expect(d.offset).toBeCloseTo(0, 6);
  });

  it("at 12500 keeps the arc full and the number exact", () => {
    const d = dial(12500);
    expect(d.value).toBe("12.5k");
    expect(d.offset).toBeCloseTo(0, 6);
  });

  it("at -30 shows the number over an empty arc", () => {
    const d = dial(-30);
    expect(d.value).toBe("-30");
    expect(d.offset).toBeCloseTo(length, 6);
  });

  it("null shows the placeholder and no value arc", () => {
    const d = dial(null);
    expect(d.value).toBe("N/A");
    expect(d.arc).toBeNull();
    expect(d.utils.getByTestId("flight-gauge-altitude-track")).toBeInTheDocument();
  });
});

describe("HeadingCompass", () => {
  function compass(headingDeg) {
    const utils = render(<HeadingCompass headingDeg={headingDeg} />);
    const needle = utils.queryByTestId("flight-gauge-heading-needle");
    return {
      utils,
      value: utils.getByTestId("flight-gauge-heading-value").textContent,
      needle,
      rotation: needle ? needle.style.transform : null,
      label: utils.getByTestId("flight-gauge-heading").getAttribute("aria-label"),
    };
  }

  it("draws a compass face: the bezel, eight ticks, and N E S W, with no track or value arc", () => {
    const c = compass(0);
    const svg = c.utils.getByTestId("flight-gauge-heading");
    expect(c.utils.queryByTestId("flight-gauge-heading-track")).toBeNull();
    expect(c.utils.queryByTestId("flight-gauge-heading-arc")).toBeNull();
    expect(c.utils.getByTestId("flight-gauge-heading-rose").getAttribute("r")).toBe(String(GAUGE_RADIUS));

    // Four long ticks at the cardinals and four short ones between.
    const ticks = Array.from(svg.querySelectorAll("line")).map((t) =>
      Math.hypot(
        Number(t.getAttribute("x2")) - Number(t.getAttribute("x1")),
        Number(t.getAttribute("y2")) - Number(t.getAttribute("y1")),
      ),
    );
    expect(ticks).toHaveLength(8);
    expect(ticks.filter((n) => Math.abs(n - TICK_LENGTH) < 0.001)).toHaveLength(4);
    expect(ticks.filter((n) => Math.abs(n - MINOR_TICK_LENGTH) < 0.001)).toHaveLength(4);

    const letters = Array.from(svg.querySelectorAll("text")).map((t) => t.textContent);
    for (const point of ["N", "E", "S", "W"]) expect(letters).toContain(point);
    expect(c.utils.getByTestId("flight-gauge-heading-label").textContent).toBe("HEADING");
    expect(c.utils.getByTestId("flight-gauge-heading-unit").textContent).toBe("");
  });

  it("reads the cardinal alone, never the degrees", () => {
    const read = (deg) => {
      const c = compass(deg);
      const out = { value: c.value, label: c.label };
      cleanup();
      return out;
    };
    expect(read(0).value).toBe("N");
    expect(read(90).value).toBe("E");
    expect(read(312)).toEqual({ value: "NW", label: "Heading NW" });
    // 359.6 rounds to 0, which is north.
    expect(read(359.6).value).toBe("N");
  });

  it("the needle stops short of the middle, so the reading sits in the clear", () => {
    const c = compass(0);
    const head = c.utils.getByTestId("flight-gauge-heading-needle-line");
    const d = head.getAttribute("d") ?? "";
    // The head runs from the bezel inward to NEEDLE_INNER, never to the centre.
    expect(d).toContain(String(27 - GAUGE_RADIUS + 1));
    expect(d).toContain(String(27 - NEEDLE_INNER));
    expect(d).not.toContain("L27 27");
  });

  it("turns to the heading, 0 at the top and clockwise", () => {
    const turn = (deg) => {
      const r = compass(deg).rotation;
      cleanup();
      return r;
    };
    expect(turn(0)).toBe("rotate(0deg)");
    expect(turn(90)).toBe("rotate(90deg)");
    expect(turn(312)).toBe("rotate(312deg)");
  });

  it("null draws the face with no needle and the placeholder", () => {
    const c = compass(null);
    expect(c.value).toBe("N/A");
    expect(c.needle).toBeNull();
    expect(c.utils.queryByTestId("flight-gauge-heading-needle-line")).toBeNull();
    expect(c.utils.getByTestId("flight-gauge-heading-rose")).toBeInTheDocument();
  });

  it("turns the short way from 350 to 10", () => {
    const utils = render(<HeadingCompass headingDeg={350} />);
    const needle = () => utils.getByTestId("flight-gauge-heading-needle");
    expect(needle().style.transform).toBe("rotate(350deg)");
    utils.rerender(<HeadingCompass headingDeg={10} />);
    expect(needle().style.transform).toBe("rotate(370deg)");
    utils.rerender(<HeadingCompass headingDeg={350} />);
    expect(needle().style.transform).toBe("rotate(350deg)");
  });

  it("keeps its rotation across a null and turns the short way after", () => {
    const utils = render(<HeadingCompass headingDeg={350} />);
    utils.rerender(<HeadingCompass headingDeg={null} />);
    expect(utils.queryByTestId("flight-gauge-heading-needle")).toBeNull();
    utils.rerender(<HeadingCompass headingDeg={10} />);
    expect(utils.getByTestId("flight-gauge-heading-needle").style.transform).toBe("rotate(370deg)");
  });

  
  it("shortestRotation moves at most half a turn either way", () => {
    expect(shortestRotation(350, 10)).toBe(370);
    expect(shortestRotation(10, 350)).toBe(-10);
    expect(shortestRotation(370, 20)).toBe(380);
    expect(shortestRotation(720, 90)).toBe(810);
    expect(Math.abs(shortestRotation(0, 180))).toBe(180);
    expect(shortestRotation(-30, 300)).toBe(-60);
  });

  it("the stylesheet turns the needle over 300 ms, not at all under reduced motion", () => {
    const css = readFileSync(resolve(gaugesDir, "HeadingCompass.module.css"), "utf8");
    expect(css).toMatch(/\.needle \{[^}]*transition: transform 300ms/);
    expect(css).toContain("fill: var(--accent)");
    expect(css).toContain("fill: var(--text-dim)");
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.needle \{ transition: none; \}/);
    expect(css).toMatch(/\.rose \{[^}]*stroke: var\(--panel-2\);[^}]*stroke-width: 1\.5;/);
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(/);
  });
});
