// docs/site.md section 7.7, Alerts bell. The header bell's visibility, the
// badge against `wmsfo.alerts.seen`, the dialog (newest first, the New
// markers, the empty text, the footer with Close alone), the glyph, the
// fetch cadence, and
// the swing under reduced motion. The e2e suite has no spec that drives a
// verified subscription (signUp.spec stops at the emailed code), so the
// bell is covered here and the e2e suite carries no bell assertion.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Shell } from "../../../src/app/Shell";
import { AuthProvider, type AuthState } from "../../../src/auth/AuthProvider";
import {
  AlertsProvider,
  ALERTS_AFTER_SNAPSHOT_MS,
  ALERTS_SEEN_KEY,
} from "../../../src/alerts/AlertsProvider";
import { store } from "../../../src/store/useStore";
import { initialStore } from "../../../src/store/types";
import { SignInRequired } from "../../../src/auth/getIdToken";
import type { ContentDocument } from "../../../src/contracts";
import type { AlertItem, Subscription } from "../../../src/api/subscriptions";

// The test run loads no CSS, so the module's class names are stood in by
// their own keys.
vi.mock("../../../src/alerts/Alerts.module.css", () => ({
  bell: "bell",
  bellBody: "bellBody",
  swing: "swing",
  badge: "badge",
  rows: "rows",
  row: "row",
  rowHead: "rowHead",
  when: "when",
  kind: "kind",
  kindStatus: "kindStatus",
  kindUpdate: "kindUpdate",
  fresh: "fresh",
  event: "event",
  subject: "subject",
  message: "message",
}));

vi.mock("../../../src/api/subscriptions", () => ({
  listMySubscriptions: vi.fn(),
  listAlerts: vi.fn(),
}));

import * as subsApi from "../../../src/api/subscriptions";

const SIGNED_IN: AuthState = { status: "signedIn", email: "p@example.com", expired: false };

const ACTIVE: Subscription = {
  id: 1,
  channel: "email",
  address: "p@example.com",
  verifiedAt: "2026-09-01T00:00:00Z",
  unsubscribedAt: null,
  createdAt: "2026-09-01T00:00:00Z",
};

function alert(id: number, sentAt: string, subject: string, kind = "event_status"): AlertItem {
  return { id, subscriptionId: 1, address: "p@example.com", kind, eventId: 1, eventName: "Santa 2026", subject, sentAt };
}

function section(id: number, kind: string) {
  return {
    id,
    kind,
    presentation: {
      width: "wide",
      align: "center",
      background: { kind: "none" },
      spacing: "normal",
      iconBefore: null,
      iconAfter: null,
      anchor: null,
    },
    data: {},
    items: [],
  };
}

function makeContent(): ContentDocument {
  return {
    schemaVersion: 1,
    settings: {
      siteName: "WMSFO Test",
      tagline: null,
      homeNavLabel: "Track Santa",
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
    pages: [
      { id: 1, slug: "planned", title: "planned", navLabel: null, icon: null, navPosition: 0, role: "planned", sections: [section(10, "hero")] },
      { id: 2, slug: "about", title: "About", navLabel: "About", icon: null, navPosition: 1, role: "none", sections: [section(20, "rich_text")] },
      {
        id: 3,
        slug: "alerts",
        title: "Alerts",
        navLabel: "Alerts",
        icon: null,
        navPosition: 2,
        role: "none",
        sections: [section(30, "alerts_signup")],
      },
    ],
  } as unknown as ContentDocument;
}

function seed(content: ContentDocument, snapshotUrl = "https://cdn/snap-1.json") {
  act(() => {
    store.setState({
      ...initialStore,
      snapshot: { schemaVersion: 1, content: content as unknown, media: {}, icons: {}, event: { statusId: 1 } },
      snapshotUrl,
      live: {
        schemaVersion: 1,
        eventId: 1,
        eventStatusId: 1,
        pollIntervalMs: 5000,
        snapshotUrl,
        cookieTally: {},
        seq: null,
        lat: null,
        lng: null,
        speedMps: null,
        altitudeM: null,
        headingDeg: null,
        accuracyM: null,
        recordedAt: null,
        receivedAt: null,
        publishedAt: "2026-10-01T00:00:00Z",
      },
    } as never);
  });
}

function mockLists(subscriptions: Subscription[], alerts: AlertItem[]) {
  vi.mocked(subsApi.listMySubscriptions).mockResolvedValue({ items: subscriptions } as never);
  vi.mocked(subsApi.listAlerts).mockResolvedValue({ items: alerts } as never);
}

function renderShell(auth: AuthState) {
  return render(
    <MemoryRouter>
      <AuthProvider initialState={auth}>
        <AlertsProvider>
          <Shell>
            <div>body</div>
          </Shell>
        </AlertsProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: reduce && query.includes("prefers-reduced-motion"),
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

const ALERTS = [
  alert(5, "2026-10-01T10:00:00Z", "Santa has landed"),
  alert(7, "2026-10-01T12:00:00Z", "A message from the elves", "event_message"),
  alert(6, "2026-10-01T11:00:00Z", "Santa is in the air"),
];

beforeEach(() => {
  window.localStorage.clear();
  vi.mocked(subsApi.listMySubscriptions).mockReset();
  vi.mocked(subsApi.listAlerts).mockReset();
  seed(makeContent());
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  act(() => store.setState({ ...initialStore }));
});

describe("AlertsBell visibility", () => {
  it("is absent signed out and fetches nothing", async () => {
    mockLists([ACTIVE], ALERTS);
    const { queryByTestId } = renderShell({ status: "signedOut" });
    await act(async () => {});
    expect(queryByTestId("alerts-bell")).toBeNull();
    expect(subsApi.listAlerts).not.toHaveBeenCalled();
    expect(subsApi.listMySubscriptions).not.toHaveBeenCalled();
  });

  it("is absent signed in with no active subscription and no alerts", async () => {
    mockLists([{ ...ACTIVE, verifiedAt: null }, { ...ACTIVE, id: 2, unsubscribedAt: "2026-09-02T00:00:00Z" }], []);
    const { queryByTestId } = renderShell(SIGNED_IN);
    await waitFor(() => expect(subsApi.listAlerts).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(queryByTestId("alerts-bell")).toBeNull();
  });

  it("is present with an active subscription, between sign-in and the theme picker", async () => {
    mockLists([ACTIVE], []);
    const { findByTestId, getByTestId } = renderShell(SIGNED_IN);
    const bell = await findByTestId("alerts-bell");
    expect(bell.getAttribute("aria-label")).toBe("Alerts");
    const actions = Array.from(bell.parentElement!.children);
    const signOut = getByTestId("menu-sign-out");
    const theme = getByTestId("theme-toggle").parentElement!;
    expect(actions.indexOf(signOut)).toBeLessThan(actions.indexOf(bell));
    expect(actions.indexOf(bell)).toBeLessThan(actions.indexOf(theme));
  });

  it("leaves the empty state on SignInRequired without throwing", async () => {
    vi.mocked(subsApi.listMySubscriptions).mockRejectedValue(new SignInRequired());
    vi.mocked(subsApi.listAlerts).mockRejectedValue(new SignInRequired());
    const { queryByTestId } = renderShell(SIGNED_IN);
    await waitFor(() => expect(subsApi.listAlerts).toHaveBeenCalled());
    await act(async () => {});
    expect(queryByTestId("alerts-bell")).toBeNull();
  });
});

describe("AlertsBell badge", () => {
  it("draws the notification bell glyph", async () => {
    mockLists([ACTIVE], ALERTS);
    const { findByTestId } = renderShell(SIGNED_IN);
    const bell = await findByTestId("alerts-bell");
    const glyph = bell.querySelector('[data-testid="alerts-bell-glyph"]');
    expect(glyph?.tagName.toLowerCase()).toBe("svg");
    expect(glyph?.getAttribute("stroke")).toBe("currentColor");
    expect(glyph?.getAttribute("stroke-width")).toBe("1.75");
    expect(glyph?.getAttribute("width")).toBe("20");
  });

  it("counts every alert when the storage key is absent", async () => {
    mockLists([ACTIVE], ALERTS);
    const { findByTestId } = renderShell(SIGNED_IN);
    const bell = await findByTestId("alerts-bell");
    await waitFor(() => expect(bell.getAttribute("aria-label")).toBe("Alerts, 3 new"));
    expect(bell.querySelector('[data-testid="alerts-badge"]')?.textContent).toBe("3");
  });

  it("counts the alerts above the stored id", async () => {
    window.localStorage.setItem(ALERTS_SEEN_KEY, "5");
    mockLists([ACTIVE], ALERTS);
    const { findByTestId } = renderShell(SIGNED_IN);
    const bell = await findByTestId("alerts-bell");
    await waitFor(() => expect(bell.getAttribute("aria-label")).toBe("Alerts, 2 new"));
    expect(bell.querySelector('[data-testid="alerts-badge"]')?.textContent).toBe("2");
  });

  it("shows no badge when every alert is seen", async () => {
    window.localStorage.setItem(ALERTS_SEEN_KEY, "7");
    mockLists([ACTIVE], ALERTS);
    const { findByTestId } = renderShell(SIGNED_IN);
    const bell = await findByTestId("alerts-bell");
    expect(bell.getAttribute("aria-label")).toBe("Alerts");
    expect(bell.querySelector('[data-testid="alerts-badge"]')).toBeNull();
  });

  it("reads 9+ past nine", async () => {
    const many = Array.from({ length: 12 }, (_, i) => alert(i + 1, `2026-10-01T0${i % 10}:00:00Z`, `s${i}`));
    mockLists([ACTIVE], many);
    const { findByTestId } = renderShell(SIGNED_IN);
    const badge = await findByTestId("alerts-badge");
    expect(badge.textContent).toBe("9+");
  });
});

describe("AlertsDialog", () => {
  it("never opens on its own", async () => {
    mockLists([ACTIVE], ALERTS);
    const { findByTestId, queryByTestId } = renderShell(SIGNED_IN);
    await findByTestId("alerts-badge");
    expect(queryByTestId("alerts-dialog")).toBeNull();
  });

  it("opening stores the newest id, clears the badge, and keeps the New markers until it closes", async () => {
    window.localStorage.setItem(ALERTS_SEEN_KEY, "5");
    mockLists([ACTIVE], ALERTS);
    const { findByTestId, getByTestId, queryByTestId } = renderShell(SIGNED_IN);
    const bell = await findByTestId("alerts-bell");
    await findByTestId("alerts-badge");
    fireEvent.click(bell);
    const dialog = getByTestId("alerts-dialog");
    expect(window.localStorage.getItem(ALERTS_SEEN_KEY)).toBe("7");
    expect(queryByTestId("alerts-badge")).toBeNull();
    expect(bell.getAttribute("aria-label")).toBe("Alerts");

    expect(dialog.textContent).toContain("Your alerts");
    const rows = dialog.querySelectorAll("li");
    expect(Array.from(rows).map((r) => r.getAttribute("data-testid"))).toEqual([
      "alerts-dialog-row-7",
      "alerts-dialog-row-6",
      "alerts-dialog-row-5",
    ]);
    expect(rows[0].querySelector('[data-testid="alerts-dialog-new"]')?.textContent).toBe("New");
    expect(rows[1].querySelector('[data-testid="alerts-dialog-new"]')).not.toBeNull();
    expect(rows[2].querySelector('[data-testid="alerts-dialog-new"]')).toBeNull();
    expect(rows[0].textContent).toContain("Santa 2026");
    expect(rows[0].textContent).toContain("A message from the elves");
    expect(rows[0].querySelector(".kind")?.textContent).toBe("update");
    expect(rows[0].querySelector(".kind")?.classList.contains("kindUpdate")).toBe(true);
    expect(rows[1].querySelector(".kind")?.textContent).toBe("status");
    expect(rows[1].querySelector(".kind")?.classList.contains("kindStatus")).toBe(true);

    fireEvent.click(getByTestId("alerts-dialog-close"));
    expect(queryByTestId("alerts-dialog")).toBeNull();
    fireEvent.click(bell);
    expect(getByTestId("alerts-dialog").querySelector('[data-testid="alerts-dialog-new"]')).toBeNull();
  });

  it("shows each alert's message under its subject, and no body element when the message is null", async () => {
    mockLists([ACTIVE], [
      { ...alert(5, "2026-10-01T10:00:00Z", "Santa is delayed"), message: "Fog over the bay.\nWe will fly at nine." },
      { ...alert(6, "2026-10-01T11:00:00Z", "A message from the elves", "event_message"), message: "Cocoa at the north gate." },
      { ...alert(7, "2026-10-01T12:00:00Z", "Santa is in the air"), message: null },
    ]);
    const { findByTestId, getByTestId } = renderShell(SIGNED_IN);
    fireEvent.click(await findByTestId("alerts-bell"));
    const dialog = getByTestId("alerts-dialog");
    const status = dialog.querySelector('[data-testid="alerts-dialog-row-5"]')!;
    const body = status.querySelector('[data-testid="alerts-dialog-message"]')!;
    expect(body.textContent).toBe("Fog over the bay.\nWe will fly at nine.");
    expect(body.classList.contains("message")).toBe(true);
    expect(body.previousElementSibling?.classList.contains("subject")).toBe(true);
    const update = dialog.querySelector('[data-testid="alerts-dialog-row-6"]')!;
    expect(update.querySelector('[data-testid="alerts-dialog-message"]')?.textContent).toBe("Cocoa at the north gate.");
    const bare = dialog.querySelector('[data-testid="alerts-dialog-row-7"]')!;
    expect(bare.querySelector('[data-testid="alerts-dialog-message"]')).toBeNull();
    expect(bare.querySelector(".subject")?.textContent).toBe("Santa is in the air");
  });

  it("closes on a backdrop press", async () => {
    mockLists([ACTIVE], ALERTS);
    const { findByTestId, getByTestId, queryByTestId } = renderShell(SIGNED_IN);
    fireEvent.click(await findByTestId("alerts-bell"));
    fireEvent.click(getByTestId("alerts-dialog"));
    expect(queryByTestId("alerts-dialog")).toBeNull();
  });

  it("shows the empty text when no alert has been sent", async () => {
    mockLists([ACTIVE], []);
    const { findByTestId, getByTestId } = renderShell(SIGNED_IN);
    fireEvent.click(await findByTestId("alerts-bell"));
    expect(getByTestId("alerts-dialog-empty").textContent).toBe("No alerts have been sent to you yet");
  });

  it("has Close in the footer and no Manage alerts link, even with an alerts_signup page", async () => {
    mockLists([ACTIVE], ALERTS);
    const { findByTestId, getByTestId, queryByTestId } = renderShell(SIGNED_IN);
    fireEvent.click(await findByTestId("alerts-bell"));
    expect(getByTestId("alerts-dialog-close").textContent).toBe("Close");
    expect(queryByTestId("alerts-dialog-manage")).toBeNull();
    expect(getByTestId("alerts-dialog").querySelector("a")).toBeNull();
  });
});

describe("AlertsProvider cadence", () => {
  it("fetches once per sign-in and not on a store update", async () => {
    mockLists([ACTIVE], ALERTS);
    const { findByTestId } = renderShell(SIGNED_IN);
    await findByTestId("alerts-bell");
    expect(subsApi.listAlerts).toHaveBeenCalledTimes(1);
    expect(subsApi.listMySubscriptions).toHaveBeenCalledTimes(1);
    act(() => {
      store.setState({ diag: { ...store.getState().diag, consecutivePollFailures: 0 } } as never);
    });
    seed(makeContent());
    await act(async () => {});
    expect(subsApi.listAlerts).toHaveBeenCalledTimes(1);
    expect(subsApi.listMySubscriptions).toHaveBeenCalledTimes(1);
  });

  it("fetches once 60 seconds after the snapshot url changes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockLists([ACTIVE], ALERTS);
    renderShell(SIGNED_IN);
    await act(async () => {});
    expect(subsApi.listAlerts).toHaveBeenCalledTimes(1);
    seed(makeContent(), "https://cdn/snap-2.json");
    await act(async () => {
      vi.advanceTimersByTime(ALERTS_AFTER_SNAPSHOT_MS - 1000);
    });
    expect(subsApi.listAlerts).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(subsApi.listAlerts).toHaveBeenCalledTimes(2);
    expect(subsApi.listMySubscriptions).toHaveBeenCalledTimes(2);
  });
});

describe("AlertsBell swing", () => {
  async function riseCount() {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockLists([ACTIVE], ALERTS.slice(0, 1));
    const view = renderShell(SIGNED_IN);
    await act(async () => {});
    const body = view.getByTestId("alerts-bell-body");
    expect(body.className).not.toContain("swing");
    mockLists([ACTIVE], ALERTS);
    seed(makeContent(), "https://cdn/snap-2.json");
    await act(async () => {
      vi.advanceTimersByTime(ALERTS_AFTER_SNAPSHOT_MS);
    });
    await act(async () => {});
    expect(view.getByTestId("alerts-bell").getAttribute("aria-label")).toBe("Alerts, 3 new");
    return view.getByTestId("alerts-bell-body");
  }

  it("swings once when the unread count rises", async () => {
    stubReducedMotion(false);
    const body = await riseCount();
    expect(body.className).toContain("swing");
  });

  it("adds no swing class under reduced motion", async () => {
    stubReducedMotion(true);
    const body = await riseCount();
    expect(body.className).not.toContain("swing");
  });
});
