// docs/site.md section 8.7. The Santa pin element: the upright pin image
// with, under it, the heading beam from the tip (the wedge paths and its
// gradient, a gradient id of its own per element); the beam is hidden while the heading is null, turns the short way (350 then 10
// passes through 0) by rotating its SVG, reads along a turned map
// (heading 90 at bearing 30 turns 60, `data-heading` 90 and
// `data-bearing` 30), recolours on demand, and the image never rotates.

import { describe, it, expect } from "vitest";
import { createSantaPinElement, santaHeadingColor, SANTA_PIN_URL } from "../../../src/map/santaPin";

function heading(el: HTMLElement): SVGSVGElement {
  return el.querySelector('[data-testid="santa-heading"]') as SVGSVGElement;
}

describe("createSantaPinElement", () => {
  it("holds the upright image and the beam under it, centred on the tip", () => {
    const pin = createSantaPinElement(52, "#ff0000");
    const svg = heading(pin.element);
    expect(pin.element.tagName).toBe("DIV");
    expect(pin.image.getAttribute("src")).toBe(SANTA_PIN_URL);
    expect(pin.element.lastElementChild).toBe(pin.image);
    expect(pin.element.firstElementChild).toBe(svg);
    expect(svg.getAttribute("width")).toBe("120");
    expect(svg.getAttribute("viewBox")).toBe("-60 -60 120 120");
    expect(svg.style.top).toBe("-8px");
    expect(svg.style.left).toBe("calc(50% - 60px)");
    expect(svg.style.overflow).toBe("visible");
    expect(svg.style.pointerEvents).toBe("none");
    expect(pin.element.style.pointerEvents).toBe("none");
    expect(svg.style.transition).toContain("300ms");
    expect(Array.from(svg.querySelectorAll("[stroke]")).map((s) => s.getAttribute("stroke"))).toContain("#ff0000");
  });

  it("draws a 64 degree, 56 px wedge filled with its gradient and stroked over a halo", () => {
    const pin = createSantaPinElement(52, "#ff0000");
    const svg = heading(pin.element);
    const paths = Array.from(svg.querySelectorAll("path"));
    expect(paths).toHaveLength(3);
    for (const p of paths) expect(p.getAttribute("d")).toBe("M 0 0 L -29.68 -47.49 A 56 56 0 0 1 29.68 -47.49 Z");
    const gradient = svg.querySelector("radialGradient")!;
    const id = gradient.getAttribute("id")!;
    expect(gradient.getAttribute("r")).toBe("56");
    expect(paths[0].getAttribute("fill")).toBe(`url(#${id})`);
    expect(paths[1].getAttribute("stroke")).toBe("rgba(0, 0, 0, 0.45)");
    expect(paths[1].getAttribute("stroke-width")).toBe("3");
    expect(paths[2].getAttribute("stroke")).toBe("#ff0000");
    expect(paths[2].getAttribute("stroke-width")).toBe("1.5");
    expect(svg.getAttribute("stroke-linejoin")).toBe("round");
    const stops = Array.from(gradient.querySelectorAll("stop"));
    expect(stops.map((s) => s.getAttribute("stop-opacity"))).toEqual(["0.55", "0.08"]);
    expect(stops.map((s) => s.getAttribute("stop-color"))).toEqual(["#ff0000", "#ff0000"]);
  });

  it("gives each element its own gradient id", () => {
    const a = heading(createSantaPinElement(52, "#ff0000").element).querySelector("radialGradient")!;
    const b = heading(createSantaPinElement(52, "#ff0000").element).querySelector("radialGradient")!;
    expect(a.getAttribute("id")).not.toBe(b.getAttribute("id"));
  });

  it("is hidden while the heading is null and shows the rounded heading", () => {
    const pin = createSantaPinElement(52, "#ff0000");
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

  it("turns the short way from 350 to 10, the image never rotating", () => {
    const pin = createSantaPinElement(52, "#ff0000");
    const svg = heading(pin.element);
    pin.setHeading(350);
    expect(svg.style.transform).toBe("rotate(-10deg)");
    expect(svg.getAttribute("data-heading")).toBe("350");
    pin.setHeading(10);
    expect(svg.style.transform).toBe("rotate(10deg)");
    pin.setHeading(270);
    expect(svg.style.transform).toBe("rotate(-90deg)");
    expect(pin.image.style.transform).toBe("");
    expect(pin.element.style.transform).toBe("");
  });

  it("turns to the heading minus the bearing and keeps the true heading in its data", () => {
    const pin = createSantaPinElement(52, "#ff0000");
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
    expect(pin.image.style.transform).toBe("");
    pin.setHeading(null, 30);
    expect(svg.hasAttribute("data-heading")).toBe(false);
    expect(svg.hasAttribute("data-bearing")).toBe(false);
  });

  it("recolours the beam's strokes and gradient stops", () => {
    const pin = createSantaPinElement(52, "#ff0000");
    pin.setColor("#00ff00");
    const svg = heading(pin.element);
    const strokes = Array.from(svg.querySelectorAll("[stroke]")).map((s) => s.getAttribute("stroke"));
    expect(strokes).toContain("#00ff00");
    expect(strokes).not.toContain("#ff0000");
    const stops = Array.from(svg.querySelectorAll("stop")).map((s) => s.getAttribute("stop-color"));
    expect(stops).toEqual(["#00ff00", "#00ff00"]);
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
