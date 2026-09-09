// docs/site.md section 20. Landmarks, skip link, menu button semantics,
// live regions on Loading and ReloadPrompt: verified with axe against the
// rendered DOM. jsdom is enough for axe's structural checks. Colour and
// touch-target rules from section 20 are not covered here (colour needs
// computed styles the jsdom setup does not provide); they live in the
// theme file and are surveyed manually.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axe from "axe-core";
import App from "../../../src/App";
import { Loading } from "../../../src/pages/Loading";
import { NotFound } from "../../../src/pages/NotFound";
import { ReloadPrompt } from "../../../src/pages/ReloadPrompt";
import { store } from "../../../src/store/useStore";
import { initialStore } from "../../../src/store/types";

async function runAxe(container: HTMLElement): Promise<axe.AxeResults> {
  return axe.run(container, {
    resultTypes: ["violations"],
    rules: {
      // jsdom does not compute layout; disable contrast/touch-target checks.
      "color-contrast": { enabled: false },
      "target-size": { enabled: false },
      region: { enabled: false },
    },
  });
}

function reportViolations(results: axe.AxeResults): string {
  return results.violations
    .map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)
    .join("\n");
}

beforeEach(() => {
  act(() => {
    store.setState({ ...initialStore });
  });
});

afterEach(() => {
  cleanup();
  act(() => {
    store.setState({ ...initialStore });
  });
});

describe("accessibility (axe)", () => {
  it("App shell with the loading placeholder has no axe violations", async () => {
    const { container } = render(<App />);
    const results = await runAxe(container);
    expect(results.violations, reportViolations(results)).toHaveLength(0);
  });

  it("App shell renders the required landmarks and the skip link (section 20)", () => {
    const { container } = render(<App />);
    expect(container.querySelector("a.skip-link")).not.toBeNull();
    expect(container.querySelector("a.skip-link")?.getAttribute("href")).toBe("#main");
    expect(container.querySelector("header")).not.toBeNull();
    expect(container.querySelector('nav[aria-label="Site"]')).not.toBeNull();
    expect(container.querySelector("#main")).not.toBeNull();
    const menuButton = container.querySelector('button[aria-controls]');
    expect(menuButton).not.toBeNull();
    expect(menuButton?.getAttribute("aria-expanded")).not.toBeNull();
  });

  it("Loading page carries a polite status live region", async () => {
    const { container } = render(<Loading />);
    const region = container.querySelector('[role="status"]');
    expect(region).not.toBeNull();
    expect(region?.getAttribute("aria-live")).toBe("polite");
    const results = await runAxe(container);
    expect(results.violations, reportViolations(results)).toHaveLength(0);
  });

  it("ReloadPrompt carries a role=alert region", async () => {
    const { container } = render(<ReloadPrompt onReload={() => undefined} />);
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    const results = await runAxe(container);
    expect(results.violations, reportViolations(results)).toHaveLength(0);
  });

  it("NotFound renders a heading and has no axe violations", async () => {
    const { container } = render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>,
    );
    expect(container.querySelector("h1")).not.toBeNull();
    const results = await runAxe(container);
    expect(results.violations, reportViolations(results)).toHaveLength(0);
  });
});
