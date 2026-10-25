// docs/site.md section 8.7. The Santa pin element: the upright pin image
// with, under it, the heading indicator centred on the tip; the indicator
// is hidden while the heading is null, turns the short way (350 then 10
// passes through 0) by rotating its SVG, reads along a turned map
// (heading 90 at bearing 30 turns 60, `data-heading` 90 and
// `data-bearing` 30), recolours on demand, and the image never rotates.

import { describe, it, expect } from "vitest";
import { createSantaPinElement, santaHeadingColor, SANTA_PIN_URL } from "../../../src/map/santaPin";

function heading(el: HTMLElement): SVGSVGElement {
  return el.querySelector('[data-testid="santa-heading"]') as SVGSVGElement;
}

describe("createSantaPinElement", () => {
  it("holds the upright image and the indicator under it, centred on the tip", () => {
    const pin = createSantaPinElement(52, "#ff0000");
    const svg = heading(pin.element);
    expect(pin.element.tagName).toBe("DIV");
    expect(pin.image.getAttribute("src")).toBe(SANTA_PIN_URL);
    expect(pin.element.lastElementChild).toBe(pin.image);
    expect(pin.element.firstElementChild).toBe(svg);
    expect(svg.getAttribute("width")).toBe("34");
    expect(svg.style.top).toBe("35px");
    expect(svg.style.left).toBe("calc(50% - 17px)");
    expect(svg.style.pointerEvents).toBe("none");
    expect(pin.element.style.pointerEvents).toBe("none");
    expect(svg.style.transition).toContain("300ms");
    expect(Array.from(svg.querySelectorAll("[stroke]")).map((s) => s.getAttribute("stroke"))).toContain("#ff0000");
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

  it("recolours the indicator", () => {
    const pin = createSantaPinElement(52, "#ff0000");
    pin.setColor("#00ff00");
    const strokes = Array.from(heading(pin.element).querySelectorAll("[stroke]")).map((s) => s.getAttribute("stroke"));
    expect(strokes).toContain("#00ff00");
    expect(strokes).not.toContain("#ff0000");
  });
});

describe("santaHeadingColor", () => {
  it("takes the arrow colour, else the chrome accent", () => {
    expect(santaHeadingColor({ overlay: { arrowColor: "#111111" }, chrome: { accent: "#222222" } } as never)).toBe("#111111");
    expect(santaHeadingColor({ overlay: { arrowColor: "" }, chrome: { accent: "#222222" } } as never)).toBe("#222222");
  });
});
