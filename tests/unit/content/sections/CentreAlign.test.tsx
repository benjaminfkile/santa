// docs/site.md section 7.2, Centre alignment. A section whose align is
// `center` centres everything it draws: rows justify to the centre,
// bounded boxes sit in the middle, columns centre their items. Each rule
// lives in the section's own module keyed on the frame's
// `section[data-align="center"]`, so each case renders the section under
// a centred frame and reads the module's stylesheet for its centre rules.

import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { store } from "../../../../src/store/useStore";
import { initialStore } from "../../../../src/store/types";
import type { ContentBundle } from "../../../../src/store/types";
import type { Presentation } from "../../../../src/contracts";
import type { SectionComponent } from "../../../../src/content/registry";
import { SectionFrame } from "../../../../src/content/SectionFrame";
import { AuthProvider } from "../../../../src/auth/AuthProvider";
import { SubscriptionProvider } from "../../../../src/alerts/SubscriptionProvider";
import { Links } from "../../../../src/content/sections/Links/Links";
import { ContactForm } from "../../../../src/content/sections/ContactForm/ContactForm";
import { AlertsSignup } from "../../../../src/content/sections/AlertsSignup/AlertsSignup";
import { Countdown } from "../../../../src/content/sections/Countdown/Countdown";
import { EventTimes } from "../../../../src/content/sections/EventTimes/EventTimes";
import { Leaderboard } from "../../../../src/content/sections/Leaderboard/Leaderboard";
import { LatestMessage } from "../../../../src/content/sections/LatestMessage/LatestMessage";
import { MediaGallery } from "../../../../src/content/sections/MediaGallery/MediaGallery";
import { CookieControl } from "../../../../src/content/sections/CookieControl/CookieControl";
import { RoutePreview } from "../../../../src/content/sections/RoutePreview/RoutePreview";

// The test run loads no CSS, so the modules' class names are stood in by
// their own keys.
vi.mock("../../../../src/content/sections/Links/Links.module.css", () => ({
  links: "links",
  linksHeading: "linksHeading",
  linksButtons: "linksButtons",
  linksButton: "linksButton",
  linksCards: "linksCards",
  linksCard: "linksCard",
  linksCardIcon: "linksCardIcon",
  linksCardLabel: "linksCardLabel",
  linksCardDescription: "linksCardDescription",
  linksList: "linksList",
  linksListItem: "linksListItem",
  linksListDescription: "linksListDescription",
}));
vi.mock("../../../../src/content/sections/ContactForm/ContactForm.module.css", () => ({
  contactForm: "contactForm",
  contactFormSubmit: "contactFormSubmit",
}));

const bundle: ContentBundle = {
  content: null as unknown as ContentBundle["content"],
  media: {},
  icons: {},
};

function presentation(align: Presentation["align"], card: boolean, width: Presentation["width"]): Presentation {
  return {
    width,
    align,
    background: { kind: "none" },
    spacing: "normal",
    iconBefore: null,
    iconAfter: null,
    anchor: null,
    card,
  } as Presentation;
}

function renderCentred(
  kind: string,
  Kind: SectionComponent,
  data: unknown,
  items: { id: number; data: unknown }[] = [],
  opts: { card?: boolean; width?: Presentation["width"] } = {},
) {
  return render(
    <MemoryRouter>
      <AuthProvider initialState={{ status: "signedOut" }}>
        <SubscriptionProvider>
          <SectionFrame
            presentation={presentation("center", opts.card ?? true, opts.width ?? "wide")}
            bundle={bundle}
            kind={kind}
          >
            <Kind data={data} items={items} bundle={bundle} />
          </SectionFrame>
        </SubscriptionProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

function sheet(name: string): string {
  return readFileSync(
    resolve(__dirname, "..", "..", "..", "..", "src", "content", "sections", name, `${name}.module.css`),
    "utf8",
  );
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// The declarations of the centre rule whose selector ends with `selector`
// (one rule may list several selectors), or undefined.
function centreRule(css: string, selector: string): string | undefined {
  const re = new RegExp(
    `:global\\(section\\[data-align="center"\\]\\) ${escape(selector)}\\s*\\{([^}]*)\\}`,
  );
  return css.match(re)?.[1];
}

function baseRule(css: string, cls: string): string | undefined {
  const re = new RegExp(`^\\.${cls} \\{([^}]*)\\}`, "m");
  return css.match(re)?.[1];
}

afterEach(() => {
  cleanup();
  act(() => store.setState({ ...initialStore }));
});

const LINK_ITEMS = [
  { id: 1, data: { link: { label: "Donate", href: "/donate", icon: null, newTab: false }, description: "Give a little." } },
  { id: 2, data: { link: { label: "Sponsor", href: "https://example.org/", icon: null, newTab: true }, description: null } },
];

describe("links under centre", () => {
  const css = sheet("Links");

  it("renders its three styles with their class names inside a centred frame", () => {
    for (const style of ["buttons", "list", "cards"] as const) {
      const { container, unmount } = renderCentred("links", Links, { heading: "Help", style }, LINK_ITEMS);
      const section = container.querySelector("section")!;
      expect(section.getAttribute("data-align")).toBe("center");
      const root = section.querySelector(".links") as HTMLElement;
      expect(root.dataset.style).toBe(style);
      if (style === "buttons") {
        expect(root.querySelectorAll(".linksButtons > .linksButton")).toHaveLength(2);
      } else if (style === "list") {
        expect(root.querySelectorAll("ul.linksList > li.linksListItem")).toHaveLength(2);
        expect(root.querySelector(".linksListDescription")?.textContent).toBe("Give a little.");
      } else {
        expect(root.querySelectorAll(".linksCards > .linksCard")).toHaveLength(2);
        expect(root.querySelectorAll(".linksCardLabel")).toHaveLength(2);
        expect(root.querySelector(".linksCardDescription")?.textContent).toBe("Give a little.");
      }
      unmount();
    }
  });

  it("centres the buttons row, the list and its items, and the cards", () => {
    expect(centreRule(css, ".linksButtons")).toMatch(/justify-content: center;/);
    expect(centreRule(css, ".linksList")).toMatch(/align-items: center;/);
    expect(centreRule(css, ".linksListItem")).toMatch(/justify-content: center;/);
    expect(centreRule(css, ".linksListItem")).toMatch(/text-align: center;/);
    expect(centreRule(css, ".linksCards")).toMatch(/justify-content: center;/);
    expect(centreRule(css, ".linksCard")).toMatch(/align-items: center;/);
    expect(centreRule(css, ".linksCard")).toMatch(/text-align: center;/);
  });

  it("keeps the start look: no rule targets start and the base rules carry no centring", () => {
    expect(css).not.toMatch(/data-align="start"/);
    expect(baseRule(css, "linksButtons")).not.toMatch(/justify-content/);
    expect(baseRule(css, "linksList")).not.toMatch(/align-items/);
  });
});

describe("contact form under centre", () => {
  const css = sheet("ContactForm");

  it("renders its 560 px box and the submit button inside a centred frame, carded or not, at every width", () => {
    for (const card of [true, false]) {
      for (const width of ["full", "wide", "narrow"] as const) {
        const { container, unmount } = renderCentred("contact_form", ContactForm, { heading: "Write" }, [], { card, width });
        const section = container.querySelector("section")!;
        expect(section.getAttribute("data-align")).toBe("center");
        expect(section.getAttribute("data-card")).toBe(String(card));
        const box = section.querySelector(".contactForm")!;
        expect(box).not.toBeNull();
        expect(box.querySelector("button.contactFormSubmit[type=submit]")).not.toBeNull();
        unmount();
      }
    }
  });

  it("keeps the 560 px box, centres it, and centres the submit button", () => {
    expect(baseRule(css, "contactForm")).toMatch(/max-width: 560px;/);
    expect(centreRule(css, ".contactForm")).toMatch(/margin-inline: auto;/);
    expect(centreRule(css, ".contactFormSubmit")).toMatch(/align-self: center;/);
    expect(centreRule(css, ".contactForm textarea")).toMatch(/text-align: start;/);
  });

  it("keeps the start look and the counter at the end of its field", () => {
    expect(baseRule(css, "contactFormSubmit")).toMatch(/align-self: flex-start;/);
    expect(css).toMatch(/\[data-testid="contact-message-counter"\] \{[^}]*align-self: flex-end;/);
    expect(css).not.toMatch(/data-align="center"\]\) [^{]*counter/);
  });
});

type Case = {
  name: string;
  kind: string;
  Kind: SectionComponent;
  data: unknown;
  items?: { id: number; data: unknown }[];
  rules: [selector: string, declaration: RegExp][];
};

const CASES: Case[] = [
  {
    name: "AlertsSignup",
    kind: "alerts_signup",
    Kind: AlertsSignup,
    data: { heading: "Alerts", signedOutCopy: "Sign in first." },
    rules: [
      [".alertsSignup", /margin-inline: auto;/],
      [".alertsSignupForm", /align-items: center;/],
      [".alertsSignupSentHead", /justify-content: center;/],
    ],
  },
  {
    name: "Countdown",
    kind: "countdown",
    Kind: Countdown,
    data: { heading: "Liftoff" },
    rules: [[".countdownCell", /align-items: center;/]],
  },
  {
    name: "EventTimes",
    kind: "event_times",
    Kind: EventTimes,
    data: { heading: "Flight log" },
    rules: [
      [".eventTimesList", /grid-template-columns: auto auto;/],
      [".eventTimesList", /justify-content: center;/],
    ],
  },
  {
    name: "Leaderboard",
    kind: "leaderboard",
    Kind: Leaderboard,
    data: { heading: "Cookies", emptyText: "None yet." },
    rules: [
      [".leaderboardList", /width: fit-content;/],
      [".leaderboardList", /margin-inline: auto;/],
      [".leaderboardToggle", /align-self: center;/],
    ],
  },
  {
    name: "LatestMessage",
    kind: "latest_message",
    Kind: LatestMessage,
    data: { style: "ticker" },
    rules: [
      [".latestMessageToggle", /justify-content: center;/],
      [".latestMessageTickerBody", /flex: 0 1 auto;/],
    ],
  },
  {
    name: "MediaGallery",
    kind: "media",
    Kind: MediaGallery,
    data: { layout: "single" },
    rules: [[".mediaGalleryFigure", /align-items: center;/]],
  },
  {
    name: "CookieControl",
    kind: "cookie_control",
    Kind: CookieControl,
    data: { heading: "Cookies", signedOutCopy: "Sign in first." },
    rules: [[".cookieControlOpen", /align-self: center;/]],
  },
  {
    name: "RoutePreview",
    kind: "route_preview",
    Kind: RoutePreview,
    data: { heading: "The route", emptyText: "No route yet." },
    rules: [[".routePreview .disclaimerRecipe", /justify-content: center;/]],
  },
];

describe("the audited sections under centre", () => {
  for (const c of CASES) {
    it(`${c.name} renders under a centred frame and its module holds the centre rules`, () => {
      const { container } = renderCentred(c.kind, c.Kind, c.data, c.items ?? []);
      const section = container.querySelector("section")!;
      expect(section.getAttribute("data-section-kind")).toBe(c.kind);
      expect(section.getAttribute("data-align")).toBe("center");
      const css = sheet(c.name);
      for (const [selector, declaration] of c.rules) {
        expect(centreRule(css, selector), `${c.name} ${selector}`).toMatch(declaration);
      }
      expect(css).not.toMatch(/data-align="start"/);
    });
  }

  it("the sections that already centre or draw only text carry no centre rule of their own", () => {
    for (const name of ["IconRow", "SponsorGrid", "SponsorCarousel"]) {
      expect(sheet(name)).not.toMatch(/data-align/);
    }
    expect(baseRule(sheet("IconRow"), "iconRow")).toMatch(/justify-content: center;/);
  });
});
