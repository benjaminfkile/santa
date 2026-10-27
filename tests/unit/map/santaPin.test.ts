// docs/site.md section 8.7. The Santa marker element: a 36 px wrapper
// holding the body (a circle in the fill and ring colours under the fixed
// red and white hat) and then the heading indicator (a 50 degree arc of
// radius 23 over a halo); the arc is hidden while the heading is null,
// turns the short way (350 then 10 passes through 0) by rotating its SVG,
// reads along a turned map (heading 90 at bearing 30 turns 60,
// `data-heading` 90 and `data-bearing` 30), recolours on demand with the
// fill and the ring, and the body never rotates.

import { describe, it, expect } from "vitest";
import {
  ARC_HALO_WIDTH,
  ARC_RADIUS,
  ARC_SPREAD,
  ARC_WIDTH,
  HEADING_BOX,
  SANTA_MARKER_SIZE,
  createSantaPinElement,
  santaHeadingColor,
  santaMarkerColors,
} from "../../../src/map/santaPin";

const COLORS = { fill: "#fafafa", ring: "#0000ff", heading: "#ff0000" };
const ARC = "M -8.03 -17.22 A 19 19 0 0 1 8.03 -17.22";

function heading(el: HTMLElement): SVGSVGElement {
  return el.querySelector('[data-testid="santa-heading"]') as SVGSVGElement;
}

describe("createSantaPinElement", () => {
  it("is a 28 px square holding the body and then the heading indicator, centred on it", () => {
    const pin = createSantaPinElement(COLORS);
    const svg = heading(pin.element);
    expect(SANTA_MARKER_SIZE).toBe(28);
    expect(HEADING_BOX).toBe(60);
    expect(pin.element.tagName).toBe("DIV");
    expect(pin.element.style.width).toBe("28px");
    expect(pin.element.style.height).toBe("28px");
    expect(pin.element.style.position).toBe("relative");
    expect(pin.element.style.pointerEvents).toBe("none");
    expect(pin.element.children).toHaveLength(2);
    expect(pin.element.firstElementChild).toBe(pin.body);
    expect(pin.element.lastElementChild).toBe(svg);
    expect(pin.body.getAttribute("data-testid")).toBe("santa-body");
    expect(pin.body.getAttribute("aria-hidden")).toBe("true");
    expect(pin.body.getAttribute("width")).toBe("28");
    expect(pin.body.getAttribute("viewBox")).toBe("-14 -14 28 28");
    expect(pin.body.style.overflow).toBe("visible");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("width")).toBe("60");
    expect(svg.getAttribute("height")).toBe("60");
    expect(svg.getAttribute("viewBox")).toBe("-30 -30 60 60");
    expect(svg.style.position).toBe("absolute");
    expect(svg.style.left).toBe("-16px");
    expect(svg.style.top).toBe("-16px");
    expect(svg.style.overflow).toBe("visible");
    expect(svg.style.pointerEvents).toBe("none");
    expect(svg.style.transformOrigin).toBe("50% 50%");
    expect(svg.style.transition).toContain("transform 300ms");
    expect(svg.style.transition).toContain("opacity 300ms");
  });

  it("draws the circle in the fill and ring colours under the four hat shapes in their fixed colours", () => {
    const pin = createSantaPinElement(COLORS);
    const [circle, hat] = Array.from(pin.body.children);
    expect(pin.body.children).toHaveLength(2);
    expect(circle.tagName).toBe("circle");
    expect(circle.getAttribute("cx")).toBe("0");
    expect(circle.getAttribute("cy")).toBe("0");
    expect(circle.getAttribute("r")).toBe("14");
    expect(circle.getAttribute("fill")).toBe("#fafafa");
    expect(circle.getAttribute("stroke")).toBe("#0000ff");
    expect(circle.getAttribute("stroke-width")).toBe("3");
    expect((circle as SVGElement).style.filter).toBe("drop-shadow(0 1.5px 2.5px rgba(0, 0, 0, 0.4))");
    expect(hat.tagName).toBe("g");
    expect(hat.getAttribute("transform")).toBe("translate(-16.1 -30.69) scale(0.3538)");
    expect((hat as SVGElement).style.filter).toBe("drop-shadow(0 1px 1.5px rgba(0, 0, 0, 0.3))");
    const shapes = Array.from(hat.children);
    expect(shapes.map((s) => s.tagName)).toEqual(["path", "path", "rect", "circle"]);
    expect(shapes[0].getAttribute("d")).toBe(
      "M 8 50 C 12 30, 24 12, 44 6 C 56 3, 68 6, 76 12 C 80 15, 82 18, 80 21 C 74 14, 64 12, 56 16 C 68 26, 76 38, 78 50 Z",
    );
    expect(shapes[0].getAttribute("fill")).toBe("#d8262b");
    expect(shapes[1].getAttribute("d")).toBe("M 8 50 C 12 30, 24 12, 44 6 C 50 5, 56 5, 62 6 C 50 10, 36 22, 30 50 Z");
    expect(shapes[1].getAttribute("fill")).toBe("#ffffff");
    expect(shapes[1].getAttribute("fill-opacity")).toBe("0.12");
    for (const [k, v] of Object.entries({ x: "3", y: "46", width: "85", height: "16", rx: "8", fill: "#ffffff", stroke: "#d6d6d6", "stroke-width": "0.8" })) {
      expect(shapes[2].getAttribute(k)).toBe(v);
    }
    for (const [k, v] of Object.entries({ cx: "80", cy: "17", r: "7.5", fill: "#ffffff", stroke: "#d6d6d6", "stroke-width": "0.8" })) {
      expect(shapes[3].getAttribute(k)).toBe(v);
    }
  });

  it("draws one 50 degree arc of radius 19, a 5.5 px halo then the 3.5 px colour", () => {
    expect([ARC_RADIUS, ARC_SPREAD, ARC_WIDTH, ARC_HALO_WIDTH]).toEqual([19, 50, 3.5, 5.5]);
    const svg = heading(createSantaPinElement(COLORS).element);
    const paths = Array.from(svg.querySelectorAll("path"));
    expect(paths).toHaveLength(2);
    for (const p of paths) expect(p.getAttribute("d")).toBe(ARC);
    expect(paths[0].getAttribute("stroke")).toBe("rgba(0, 0, 0, 0.45)");
    expect(paths[0].getAttribute("stroke-width")).toBe("5.5");
    expect(paths[1].getAttribute("stroke")).toBe("#ff0000");
    expect(paths[1].getAttribute("stroke-width")).toBe("3.5");
    expect(svg.getAttribute("fill")).toBe("none");
    expect(svg.getAttribute("stroke-linecap")).toBe("round");
    expect(svg.querySelector("[id]")).toBeNull();
  });

  it("is hidden while the heading is null and shows the rounded heading", () => {
    const pin = createSantaPinElement(COLORS);
    const svg = heading(pin.element);
    expect(svg.style.opacity).toBe("0");
    expect(svg.hasAttribute("data-heading")).toBe(false);
    pin.setHeading(89.6);
    expect(svg.style.opacity).toBe("1");
    expect(svg.getAttribute("data-heading")).toBe("90");
    pin.setHeading(null);
    expect(svg.style.opacity).toBe("0");
    expect(svg.hasAttribute("data-heading")).toBe(false);
    expect(svg.style.transform).toBe("rotate(89.6deg)");
  });

  it("turns the short way from 350 to 10, the body never rotating", () => {
    const pin = createSantaPinElement(COLORS);
    const svg = heading(pin.element);
    pin.setHeading(350);
    expect(svg.style.transform).toBe("rotate(-10deg)");
    expect(svg.getAttribute("data-heading")).toBe("350");
    pin.setHeading(10);
    expect(svg.style.transform).toBe("rotate(10deg)");
    pin.setHeading(270);
    expect(svg.style.transform).toBe("rotate(-90deg)");
    expect(pin.body.style.transform).toBe("");
    expect(pin.element.style.transform).toBe("");
  });

  it("turns to the heading minus the bearing and keeps the true heading in its data", () => {
    const pin = createSantaPinElement(COLORS);
    const svg = heading(pin.element);
    pin.setHeading(90, 30);
    expect(svg.style.transform).toBe("rotate(60deg)");
    expect(svg.getAttribute("data-heading")).toBe("90");
    expect(svg.getAttribute("data-bearing")).toBe("30");
    pin.setHeading(90, -60);
    expect(svg.style.transform).toBe("rotate(150deg)");
    expect(svg.getAttribute("data-bearing")).toBe("300");
    pin.setHeading(90);
    expect(svg.style.transform).toBe("rotate(90deg)");
    expect(svg.getAttribute("data-bearing")).toBe("0");
    expect(pin.body.style.transform).toBe("");
    pin.setHeading(null, 30);
    expect(svg.hasAttribute("data-heading")).toBe(false);
    expect(svg.hasAttribute("data-bearing")).toBe(false);
  });

  it("recolours the fill, the ring and the arc", () => {
    const pin = createSantaPinElement(COLORS);
    pin.setColors({ fill: "#111111", ring: "#222222", heading: "#00ff00" });
    const circle = pin.body.querySelector(":scope > circle")!;
    expect(circle.getAttribute("fill")).toBe("#111111");
    expect(circle.getAttribute("stroke")).toBe("#222222");
    const paths = Array.from(heading(pin.element).querySelectorAll("path"));
    expect(paths[1].getAttribute("stroke")).toBe("#00ff00");
    expect(paths[0].getAttribute("stroke")).toBe("rgba(0, 0, 0, 0.45)");
    const hat = Array.from(pin.body.querySelectorAll("g > *")).map((s) => s.getAttribute("fill"));
    expect(hat).toEqual(["#d8262b", "#ffffff", "#ffffff", "#ffffff"]);
  });
});

describe("santaHeadingColor", () => {
  it("takes the heading colour, else the arrow colour, else the chrome accent", () => {
    const chrome = { accent: "#222222" };
    expect(santaHeadingColor({ overlay: { headingColor: "#333333", arrowColor: "#111111" }, chrome } as never)).toBe("#333333");
    expect(santaHeadingColor({ overlay: { headingColor: "", arrowColor: "#111111" }, chrome } as never)).toBe("#111111");
    expect(santaHeadingColor({ overlay: { headingColor: "", arrowColor: "" }, chrome } as never)).toBe("#222222");
  });
});

describe("santaMarkerColors", () => {
  it("fills with the chrome background, rings with the chrome accent, and heads with the heading colour", () => {
    const theme = { overlay: { headingColor: "#333333", arrowColor: "#111111" }, chrome: { bg: "#f0f0f0", accent: "#222222" } };
    expect(santaMarkerColors(theme as never)).toEqual({ fill: "#f0f0f0", ring: "#222222", heading: "#333333" });
  });

  it("falls back to white and the heading colour for empty chrome fields", () => {
    const theme = { overlay: { headingColor: "#333333", arrowColor: "#111111" }, chrome: { bg: "", accent: "" } };
    expect(santaMarkerColors(theme as never)).toEqual({ fill: "#ffffff", ring: "#333333", heading: "#333333" });
    const bare = { overlay: { headingColor: "", arrowColor: "#111111" }, chrome: { bg: "", accent: "" } };
    expect(santaMarkerColors(bare as never)).toEqual({ fill: "#ffffff", ring: "#111111", heading: "#111111" });
  });
});
