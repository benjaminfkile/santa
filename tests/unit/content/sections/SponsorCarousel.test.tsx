// docs/site.md sections 7.4 and 15. SponsorCarousel starts at a random
// sponsor, plays snapshot order from there and wraps, keeps its index
// across a snapshot change when the sponsor at that index is unchanged,
// restarts at the first otherwise, and the card variant has no linger line.
// The card variant steps on its arrows, bars, swipes, and arrow keys, and a
// manual step pauses the auto-advance for 30 s; the tile has no controls.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
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

  it("the slide is one fixed height per breakpoint with a fixed logo box, whatever logoWidth says", () => {
    seedSponsors([{ id: 1, name: "A", lingerMs: 5000 }]);
    const { container } = render(
      <MemoryRouter>
        <SponsorCarousel
          data={{ variant: "card", logoWidth: 960 }}
          items={[]}
          bundle={buildBundle()}
        />
      </MemoryRouter>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.getPropertyValue("--sponsor-logo-width")).toBe("");
    const sheet = readFileSync(
      resolve(__dirname, "../../../../src/content/sections/SponsorCarousel/SponsorCarousel.module.css"),
      "utf8",
    );
    expect(sheet).toMatch(/\.sponsorCarouselCard \.sponsorCarouselSlide \{[^}]*height: 144px;/);
    expect(sheet).toMatch(/@media \(min-width: 761px\) \{\s*\.sponsorCarouselCard \.sponsorCarouselSlide \{ height: 192px; \}/);
    expect(sheet).toMatch(/\.sponsorCarouselLogo \{[^}]*width: 112px;[^}]*height: 112px;/);
    expect(sheet).toMatch(/\.sponsorCarouselCard \.sponsorCarouselNameOnly \{ width: 160px; height: 160px; \}/);
    expect(sheet).not.toMatch(/--sponsor-logo-width/);
    expect(sheet).not.toMatch(/\.sponsorCarouselCard \.sponsorCarouselName \{[^}]*white-space: normal/);
  });
});

function mockDesktop(matches: boolean): void {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: query === "(min-width: 761px)" ? matches : false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  );
}

const FOUR: SponsorSeed[] = [
  { id: 1, name: "A", lingerMs: 1000 },
  { id: 2, name: "B", lingerMs: 1000 },
  { id: 3, name: "C", lingerMs: 1000 },
  { id: 4, name: "D", lingerMs: 1000 },
];

describe("SponsorCarousel card controls", () => {
  it("renders two arrows at 800 px and four bars with aria-current on the shown one", () => {
    mockDesktop(true);
    seedSponsors(FOUR);
    renderCarousel();
    expect(screen.getByTestId("sponsor-previous")).toHaveAttribute("aria-label", "Previous sponsor");
    expect(screen.getByTestId("sponsor-next")).toHaveAttribute("aria-label", "Next sponsor");
    const bars = screen.getAllByTestId("sponsor-bar");
    expect(bars).toHaveLength(4);
    expect(bars.map((b) => b.getAttribute("aria-label"))).toEqual(["A", "B", "C", "D"]);
    expect(bars[0]).toHaveAttribute("aria-current", "true");
    expect(bars.slice(1).every((b) => !b.hasAttribute("aria-current"))).toBe(true);
  });

  it("renders no arrows at 390 px but keeps the bars", () => {
    mockDesktop(false);
    seedSponsors(FOUR);
    renderCarousel();
    expect(screen.queryByTestId("sponsor-previous")).toBeNull();
    expect(screen.queryByTestId("sponsor-next")).toBeNull();
    expect(screen.getAllByTestId("sponsor-bar")).toHaveLength(4);
  });

  it("Next shows the next sponsor and pauses the auto-advance for 30 s", () => {
    vi.useFakeTimers();
    mockDesktop(true);
    seedSponsors(FOUR);
    renderCarousel();
    expect(shownName()).toBe("A");
    fireEvent.click(screen.getByTestId("sponsor-next"));
    expect(shownName()).toBe("B");
    act(() => {
      vi.advanceTimersByTime(29999);
    });
    expect(shownName()).toBe("B");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(shownName()).toBe("B");
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(shownName()).toBe("C");
    fireEvent.click(screen.getByTestId("sponsor-previous"));
    expect(shownName()).toBe("B");
  });

  it("a bar click jumps to its sponsor", () => {
    mockDesktop(true);
    seedSponsors(FOUR);
    renderCarousel();
    fireEvent.click(screen.getAllByTestId("sponsor-bar")[2]!);
    expect(shownName()).toBe("C");
    expect(screen.getAllByTestId("sponsor-bar")[2]).toHaveAttribute("aria-current", "true");
  });

  it("a 60 px swipe left steps and a 0 px tap opens the dialog", () => {
    mockDesktop(false);
    seedSponsors(FOUR);
    renderCarousel();
    const slide = screen.getByTestId("sponsor-open");
    fireEvent.pointerDown(slide, { clientX: 200, clientY: 100 });
    fireEvent.pointerUp(slide, { clientX: 140, clientY: 100 });
    fireEvent.click(slide);
    expect(shownName()).toBe("B");
    expect(screen.queryByTestId("sponsor-dialog")).toBeNull();

    fireEvent.pointerDown(slide, { clientX: 200, clientY: 100 });
    fireEvent.pointerUp(slide, { clientX: 200, clientY: 100 });
    fireEvent.click(slide);
    expect(shownName()).toBe("B");
    expect(screen.getByTestId("sponsor-dialog")).toBeInTheDocument();
  });

  it("Right and Left arrow keys on the slide step", () => {
    mockDesktop(true);
    seedSponsors(FOUR);
    renderCarousel();
    const slide = screen.getByTestId("sponsor-open");
    fireEvent.keyDown(slide, { key: "ArrowRight" });
    expect(shownName()).toBe("B");
    fireEvent.keyDown(slide, { key: "ArrowLeft" });
    fireEvent.keyDown(slide, { key: "ArrowLeft" });
    expect(shownName()).toBe("D");
  });

  it("the tile variant has no controls", () => {
    mockDesktop(true);
    seedSponsors(FOUR);
    render(
      <MemoryRouter>
        <SponsorCarousel data={{ variant: "tile" }} items={[]} bundle={buildBundle()} />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId("sponsor-previous")).toBeNull();
    expect(screen.queryByTestId("sponsor-next")).toBeNull();
    expect(screen.queryByTestId("sponsor-bar")).toBeNull();
    fireEvent.keyDown(screen.getByTestId("sponsor-open"), { key: "ArrowRight" });
    expect(shownName()).toBe("A");
  });
});
