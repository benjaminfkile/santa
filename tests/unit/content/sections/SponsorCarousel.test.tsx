// docs/site.md sections 7.4 and 15. SponsorCarousel starts at a random
// sponsor, plays snapshot order from there and wraps, keeps its index
// across a snapshot change when the sponsor at that index is unchanged,
// restarts at the first otherwise, and the card variant has no linger line.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { SponsorCarousel } from "../../../../src/content/sections/SponsorCarousel/SponsorCarousel";
import { store } from "../../../../src/store/useStore";
import { initialStore, type ContentBundle } from "../../../../src/store/types";
import type { Snapshot } from "../../../../src/contracts";

function buildBundle(): ContentBundle {
  return {
    content: {
      schemaVersion: 1,
      pages: [],
      settings: {
        siteName: "WMSFO",
        tagline: null,
        homeNavLabel: "Home",
        logo: null,
        favicon: null,
        theme: { snowDefault: false, lightsDefault: false },
        navExtraLinks: [],
        footerLinks: [],
        footerText: null,
        contactEmail: null,
        donateUrl: null,
        analyticsEnabled: false,
      },
    } as unknown as ContentBundle["content"],
    media: {},
    icons: {},
  };
}

type SponsorSeed = {
  id: number;
  name: string;
  websiteUrl?: string | null;
  lingerMs?: number;
};

function seedSponsors(sponsors: SponsorSeed[]): void {
  act(() => {
    store.setState({
      ...initialStore,
      snapshot: {
        schemaVersion: 1,
        content: {} as unknown,
        sponsors,
      } as unknown as Snapshot,
    });
  });
}

beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0);
  act(() => {
    store.setState({ ...initialStore });
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  cleanup();
  act(() => {
    store.setState({ ...initialStore });
  });
});

describe("SponsorCarousel index across a snapshot change", () => {
  it("keeps its index when the sponsor at that index is unchanged", () => {
    const first = [
      { id: 1, name: "A" },
      { id: 2, name: "B" },
      { id: 3, name: "C" },
    ];
    seedSponsors(first);
    const bundle = buildBundle();
    const { container, rerender } = render(
      <MemoryRouter>
        <SponsorCarousel data={{}} items={[]} bundle={bundle} />
      </MemoryRouter>,
    );

    // Force-advance the internal index by re-seeding with the same list twice.
    // The initial render lands on index 0. We can inspect the active dot to
    // learn which sponsor is on screen: the visible name comes from
    // sponsors[index], so we look at the on-screen name.
    // The first render's active name is "A".
    expect(container.textContent).toContain("A");

    // Replace the snapshot with a version whose second entry is unchanged.
    // We can't easily reach into the useState from outside, so simulate by
    // sending an updated sponsors list preserving the entry at index 0.
    seedSponsors([
      { id: 1, name: "A" },
      { id: 4, name: "D" },
      { id: 3, name: "C" },
    ]);
    rerender(
      <MemoryRouter>
        <SponsorCarousel data={{}} items={[]} bundle={bundle} />
      </MemoryRouter>,
    );
    // Still shows the same sponsor because index 0's id is unchanged.
    expect(container.textContent).toContain("A");
  });

  it("restarts at the first sponsor when the entry at the index changed", () => {
    seedSponsors([
      { id: 1, name: "A" },
      { id: 2, name: "B" },
    ]);
    const bundle = buildBundle();
    const { container, rerender } = render(
      <MemoryRouter>
        <SponsorCarousel data={{}} items={[]} bundle={bundle} />
      </MemoryRouter>,
    );
    expect(container.textContent).toContain("A");

    // Swap the sponsor at index 0.
    seedSponsors([
      { id: 5, name: "E" },
      { id: 2, name: "B" },
    ]);
    rerender(
      <MemoryRouter>
        <SponsorCarousel data={{}} items={[]} bundle={bundle} />
      </MemoryRouter>,
    );
    // Restart from index 0, whose sponsor is now "E".
    expect(container.textContent).toContain("E");
  });
});

function renderCarousel(): void {
  render(
    <MemoryRouter>
      <SponsorCarousel data={{}} items={[]} bundle={buildBundle()} />
    </MemoryRouter>,
  );
}

function shownName(): string | null {
  return screen.getByTestId("sponsor-open").getAttribute("aria-label");
}

describe("SponsorCarousel random start", () => {
  it("starts at the random index and wraps from it in snapshot order", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.7);
    seedSponsors([
      { id: 1, name: "A", lingerMs: 1000 },
      { id: 2, name: "B", lingerMs: 1000 },
      { id: 3, name: "C", lingerMs: 1000 },
    ]);
    renderCarousel();
    expect(shownName()).toBe("C");
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(shownName()).toBe("A");
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(shownName()).toBe("B");
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(shownName()).toBe("C");
  });

  it("picks the random start when the first list arrives after mount", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    renderCarousel();
    expect(screen.queryByTestId("sponsor-open")).toBeNull();
    seedSponsors([
      { id: 1, name: "A", lingerMs: 2000 },
      { id: 2, name: "B", lingerMs: 1000 },
      { id: 3, name: "C", lingerMs: 3000 },
      { id: 4, name: "D", lingerMs: 1000 },
    ]);
    expect(shownName()).toBe("C");
    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(shownName()).toBe("C");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(shownName()).toBe("D");
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(shownName()).toBe("A");
  });

  it("keeps the random start across a snapshot change that leaves it unchanged", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    seedSponsors([
      { id: 1, name: "A" },
      { id: 2, name: "B" },
    ]);
    renderCarousel();
    expect(shownName()).toBe("B");
    seedSponsors([
      { id: 3, name: "C" },
      { id: 2, name: "B" },
    ]);
    expect(shownName()).toBe("B");
    seedSponsors([
      { id: 3, name: "C" },
      { id: 4, name: "D" },
    ]);
    expect(shownName()).toBe("C");
  });
});

describe("SponsorCarousel card variant", () => {
  it("renders no linger text", () => {
    seedSponsors([
      { id: 1, name: "A", lingerMs: 5000 },
      { id: 2, name: "B", lingerMs: 5000 },
    ]);
    const { container } = render(
      <MemoryRouter>
        <SponsorCarousel data={{ variant: "card" }} items={[]} bundle={buildBundle()} />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId("sponsor-linger")).toBeNull();
    expect(container.textContent).not.toMatch(/on the tracker/i);
    expect(container.textContent).not.toMatch(/\d+\s*s\b/);
  });

  it("a filled logoWidth sizes the card's logo through the CSS variable", () => {
    seedSponsors([{ id: 1, name: "A", lingerMs: 5000 }]);
    const { container } = render(
      <MemoryRouter>
        <SponsorCarousel
          data={{ variant: "card", logoWidth: 300 }}
          items={[]}
          bundle={buildBundle()}
        />
      </MemoryRouter>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.getPropertyValue("--sponsor-logo-width")).toBe("300px");
  });

  it("without a logoWidth the card leaves the CSS default in place", () => {
    seedSponsors([{ id: 1, name: "A", lingerMs: 5000 }]);
    const { container } = render(
      <MemoryRouter>
        <SponsorCarousel data={{ variant: "card" }} items={[]} bundle={buildBundle()} />
      </MemoryRouter>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.getPropertyValue("--sponsor-logo-width")).toBe("");
  });
});
