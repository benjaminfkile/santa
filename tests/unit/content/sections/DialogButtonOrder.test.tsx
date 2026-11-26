// docs/site.md section 22. Every dialog's buttons sit right-aligned in the
// shared action row, the cancel, close, or back action first and the
// confirming action last; a lone button sits on the right.

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// The test run loads no CSS, so the class names are stood in by their keys.
vi.mock("../../../../src/content/sections/RoutePreview/RoutePreview.module.css", () => ({
  locationPrompt: "locationPrompt",
  locationPromptActions: "locationPromptActions",
  locationPromptInapp: "locationPromptInapp",
  locationPromptDenied: "locationPromptDenied",
  routeDisclaimer: "routeDisclaimer",
  routeDisclaimerActions: "routeDisclaimerActions",
}));

import { LocationPrompt } from "../../../../src/content/sections/Map/LocationPrompt";
import { RouteDisclaimer } from "../../../../src/content/sections/Map/RouteDisclaimer";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function buttonNames(): string[] {
  return screen.getAllByRole("button", { hidden: true }).map((b) => b.textContent ?? "");
}

function promptProps(enabled: boolean) {
  return {
    open: true,
    enabled,
    errorCode: null,
    onClose: () => {},
    onEnable: () => {},
    onDisable: () => {},
  };
}

describe("LocationPrompt's button order", () => {
  it("offers Cancel before Enable while location is off", () => {
    render(<LocationPrompt {...promptProps(false)} />);
    expect(buttonNames()).toEqual(["Cancel", "Enable"]);
    const cancel = screen.getByRole("button", { name: "Cancel", hidden: true });
    expect(cancel.parentElement?.className).toBe("locationPromptActions");
  });

  it("offers Back before Disable while location is on", () => {
    render(<LocationPrompt {...promptProps(true)} />);
    expect(buttonNames()).toEqual(["Back", "Disable"]);
    const back = screen.getByRole("button", { name: "Back", hidden: true });
    expect(back.parentElement?.className).toBe("locationPromptActions");
  });
});

describe("RouteDisclaimer's button", () => {
  it("sits inside the action row", () => {
    render(<RouteDisclaimer />);
    const row = screen.getByTestId("route-disclaimer-actions");
    expect(row.className).toBe("routeDisclaimerActions");
    const button = screen.getByRole("button", { name: "I understand", hidden: true });
    expect(button.parentElement).toBe(row);
  });
});

describe("the dialog action rows", () => {
  const read = (path: string) => readFileSync(resolve(__dirname, "../../../../src", path), "utf8");
  function ruleOf(css: string, selector: string): string {
    const at = css.indexOf(selector);
    expect(at).toBeGreaterThan(-1);
    return css.slice(at, css.indexOf("}", at));
  }

  it("the shared .actions row is right-aligned", () => {
    const rule = ruleOf(read("ui/Dialog.module.css"), ".actions {");
    expect(rule).toContain("display: flex");
    expect(rule).toContain("justify-content: flex-end");
  });

  it("LocationPrompt and RouteDisclaimer compose the shared row", () => {
    const rule = ruleOf(read("content/sections/RoutePreview/RoutePreview.module.css"), ".locationPromptActions,");
    expect(rule).toContain(".routeDisclaimerActions");
    expect(rule).toContain('composes: actions from "../../../ui/Dialog.module.css"');
  });
});
