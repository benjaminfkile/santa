// docs/site.md section 7.7. The header's priority-plus nav: items that do
// not fit go to the More menu last first and come back when the width
// allows; the menu closes on a press outside, on a choice, and on Escape.
// Layout is stubbed: every item measures 100 px, More 60 px, no gap, and
// the nav's width is set per test.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Link } from "react-router-dom";
import { PriorityNav } from "../../../src/app/PriorityNav";

let navWidth = 1000;
const observers: { cb: ResizeObserverCallback }[] = [];

class FakeResizeObserver {
  cb: ResizeObserverCallback;
  constructor(cb: ResizeObserverCallback) {
    this.cb = cb;
    observers.push(this);
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

function rect(width: number): DOMRect {
  return { width, height: 44, top: 0, left: 0, right: width, bottom: 44, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
}

function resizeTo(width: number) {
  navWidth = width;
  act(() => {
    for (const o of observers) o.cb([], o as unknown as ResizeObserver);
  });
}

const LABELS = ["Track Santa", "About", "Sponsors", "Route", "Watch"];

function renderNav() {
  return render(
    <MemoryRouter>
      <PriorityNav
        items={LABELS.map((label) => ({
          key: label,
          node: <Link to={`/${label.toLowerCase().replace(" ", "-")}`}>{label}</Link>,
        }))}
      />
      <button type="button">elsewhere</button>
    </MemoryRouter>,
  );
}

function rowLabels(): string[] {
  const nav = screen.getByRole("navigation", { name: "Pages" });
  const row = nav.querySelector("ul") as HTMLUListElement;
  return Array.from(row.children)
    .filter((li) => li.querySelector('[data-testid="nav-more"]') === null)
    .map((li) => li.textContent ?? "");
}

function menuLabels(): string[] {
  const menu = screen.queryByTestId("nav-more-menu");
  return menu === null ? [] : Array.from(menu.querySelectorAll("a")).map((a) => a.textContent ?? "");
}

beforeEach(() => {
  navWidth = 1000;
  observers.length = 0;
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    if (this.tagName === "NAV") return rect(navWidth);
    if (this.tagName === "LI" && this.closest('[data-testid="nav-measure"]') !== null) {
      return rect(this.nextElementSibling === null ? 60 : 100);
    }
    return rect(0);
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("PriorityNav collapse", () => {
  it("shows every item and no More button when the row fits", () => {
    renderNav();
    expect(rowLabels()).toEqual(LABELS);
    expect(screen.queryByTestId("nav-more")).toBeNull();
  });

  it("moves the items that do not fit into More, last first", () => {
    navWidth = 330;
    renderNav();
    // Three items (300) would leave no room for More (60); two plus More fit.
    expect(rowLabels()).toEqual(["Track Santa", "About"]);
    fireEvent.click(screen.getByTestId("nav-more"));
    expect(menuLabels()).toEqual(["Sponsors", "Route", "Watch"]);
  });

  it("recomputes on resize and restores items when the width allows", () => {
    renderNav();
    resizeTo(260);
    expect(rowLabels()).toEqual(["Track Santa", "About"]);
    resizeTo(160);
    expect(rowLabels()).toEqual(["Track Santa"]);
    resizeTo(50);
    expect(rowLabels()).toEqual([]);
    expect(screen.getByTestId("nav-more")).toBeTruthy();
    resizeTo(460);
    expect(rowLabels()).toEqual(["Track Santa", "About", "Sponsors", "Route"]);
    resizeTo(500);
    expect(rowLabels()).toEqual(LABELS);
    expect(screen.queryByTestId("nav-more")).toBeNull();
  });

  it("keeps the measuring copy out of the accessibility tree and the tab order", () => {
    renderNav();
    const copyList = screen.getByTestId("nav-measure");
    const box = copyList.parentElement as HTMLElement;
    expect(box.getAttribute("aria-hidden")).toBe("true");
    expect(box.hasAttribute("inert")).toBe(true);
    expect(screen.getAllByRole("link", { name: "Watch" })).toHaveLength(1);
  });
});

describe("PriorityNav More menu", () => {
  beforeEach(() => {
    navWidth = 260;
  });

  it("opens from the button with aria-expanded and aria-controls", () => {
    renderNav();
    const more = screen.getByTestId("nav-more");
    expect(more.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByTestId("nav-more-menu")).toBeNull();
    fireEvent.click(more);
    expect(more.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByTestId("nav-more-menu").id).toBe(more.getAttribute("aria-controls"));
    fireEvent.click(more);
    expect(screen.queryByTestId("nav-more-menu")).toBeNull();
  });

  it("closes on a press outside the button and the menu", () => {
    renderNav();
    fireEvent.click(screen.getByTestId("nav-more"));
    fireEvent.mouseDown(screen.getByTestId("nav-more-menu"));
    expect(screen.getByTestId("nav-more-menu")).toBeTruthy();
    fireEvent.mouseDown(screen.getByRole("button", { name: "elsewhere" }));
    expect(screen.queryByTestId("nav-more-menu")).toBeNull();
    fireEvent.click(screen.getByTestId("nav-more"));
    fireEvent.touchStart(document.body);
    expect(screen.queryByTestId("nav-more-menu")).toBeNull();
  });

  it("closes when an item in it is chosen", () => {
    renderNav();
    fireEvent.click(screen.getByTestId("nav-more"));
    fireEvent.click(screen.getByRole("link", { name: "Route" }));
    expect(screen.queryByTestId("nav-more-menu")).toBeNull();
  });

  it("closes on Escape and returns focus to the More button", () => {
    renderNav();
    const more = screen.getByTestId("nav-more");
    more.focus();
    fireEvent.click(more);
    const link = screen.getByRole("link", { name: "Sponsors" });
    link.focus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("nav-more-menu")).toBeNull();
    expect(document.activeElement).toBe(more);
  });

  it("drops the menu when every item fits again", () => {
    renderNav();
    fireEvent.click(screen.getByTestId("nav-more"));
    resizeTo(1000);
    expect(screen.queryByTestId("nav-more")).toBeNull();
    expect(screen.queryByTestId("nav-more-menu")).toBeNull();
  });
});
