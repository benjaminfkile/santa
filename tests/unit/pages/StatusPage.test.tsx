// docs/site.md sections 4, 7.1, and 11.5. The status card: the site name
// only when a bundle is held, the title and line, the action as a link or
// a button, the live region role, and the takeover dialog surface while
// live. NotFound renders on it with the title and the home link.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { StatusPage } from "../../../src/pages/StatusPage";
import { NotFound } from "../../../src/pages/NotFound";
import { BellIcon } from "../../../src/content/icons/generated/bell";
import { copy } from "../../../src/copy/copy";
import { store } from "../../../src/store/useStore";
import { initialStore, type SiteStore } from "../../../src/store/types";

function renderCard(node: React.ReactNode) {
  return render(<MemoryRouter>{node}</MemoryRouter>);
}

beforeEach(() => {
  act(() => store.setState({ ...initialStore }));
});
afterEach(() => {
  cleanup();
  act(() => store.setState({ ...initialStore }));
});

describe("StatusPage", () => {
  it("renders the icon, title, and line in main with no site name when no bundle is held", () => {
    const { container } = renderCard(<StatusPage icon={BellIcon} title="Title" line="One line." testId="card" />);
    const main = container.querySelector("main#main");
    expect(main).not.toBeNull();
    const card = main?.querySelector('[data-testid="card"]');
    expect(card).not.toBeNull();
    expect(card?.querySelector("h1")?.textContent).toBe("Title");
    expect(card?.textContent).toContain("One line.");
    const svg = card?.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("72");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(card?.querySelector("p")?.textContent).toBe("One line.");
    expect(container.querySelector('[data-testid="status-takeover"]')).toBeNull();
    expect(card?.getAttribute("role")).toBeNull();
  });

  it("shows the site name when a bundle is held", () => {
    act(() =>
      store.setState({
        preview: { content: { settings: { siteName: "WMSFO" } } } as unknown as SiteStore["preview"],
      }),
    );
    const { container } = renderCard(<StatusPage icon={BellIcon} title="Title" />);
    expect(container.textContent).toContain("WMSFO");
  });

  it("renders a link action and a button action", async () => {
    const onClick = vi.fn();
    const link = renderCard(<StatusPage icon={BellIcon} title="A" action={{ to: "/", label: "Home" }} />);
    expect(link.container.querySelector('a[href="/"]')?.textContent).toBe("Home");
    cleanup();
    const button = renderCard(<StatusPage icon={BellIcon} title="B" action={{ onClick, label: "Retry" }} />);
    await userEvent.click(button.getByText("Retry"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("marks waiting states polite status and failures alert", () => {
    const waiting = renderCard(<StatusPage icon={BellIcon} title="Wait" role="status" />);
    const region = waiting.container.querySelector('[role="status"]');
    expect(region?.getAttribute("aria-live")).toBe("polite");
    expect(region?.querySelector("h1")?.textContent).toBe("Wait");
    cleanup();
    const failed = renderCard(<StatusPage icon={BellIcon} title="Fail" role="alert" />);
    expect(failed.container.querySelector('[role="alert"]')?.textContent).toContain("Fail");
  });

  it("renders inside the takeover dialog surface while live", () => {
    act(() => store.setState({ live: { eventStatusId: 3 } as unknown as SiteStore["live"] }));
    const { container } = renderCard(<StatusPage icon={BellIcon} title="Live" testId="card" />);
    const wrap = container.querySelector('[data-testid="status-takeover"]');
    expect(wrap).not.toBeNull();
    const card = wrap?.querySelector('[data-testid="card"]');
    expect(card?.getAttribute("role")).toBe("dialog");
    expect(card?.getAttribute("aria-modal")).toBe("true");
    const titleId = card?.getAttribute("aria-labelledby") ?? "";
    expect(titleId).not.toBe("");
    expect(container.querySelector(`[id="${titleId}"]`)?.textContent).toBe("Live");
  });
});

describe("NotFound", () => {
  it("renders the card with the title, the line, and the home link", () => {
    const { container } = renderCard(<NotFound />);
    const card = container.querySelector('[data-testid="not-found"]');
    expect(card).not.toBeNull();
    expect(card?.querySelector("h1")?.textContent).toBe(copy.notFound.heading);
    expect(card?.textContent).toContain(copy.notFound.line);
    const home = card?.querySelector('a[href="/"]');
    expect(home?.textContent).toBe(copy.notFound.home);
  });
});
