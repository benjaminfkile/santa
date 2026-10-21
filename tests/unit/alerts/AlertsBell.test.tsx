// docs/site.md section 7.7, Alerts bell. The header bell's visibility (for
// every visitor while the snapshot has an event), the badge against
// `wmsfo.alerts.seenId` and the removal of the old `wmsfo.alerts.seen`,
// the dialog from `snapshot.event.alerts` (newest first, the New markers,
// the empty text, the footer with Close, the close X in the head outside
// the scroll region), the glyph, the swing under reduced motion, and the
// one write: opening sends `PUT /me/notifications/seen` once for a
// signed-in subscriber when the marker advances, and nothing otherwise.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Shell } from "../../../src/app/Shell";
import { AuthProvider, type AuthState } from "../../../src/auth/AuthProvider";
import {
  AlertsProvider,
  ALERTS_OLD_SEEN_KEY,
  ALERTS_SEEN_KEY,
} from "../../../src/alerts/AlertsProvider";
import { SubscriptionProvider } from "../../../src/alerts/SubscriptionProvider";
import { SUBSCRIPTION_FLAG_KEY } from "../../../src/alerts/subscriptionFlag";
import { seenMarker } from "../../../src/alerts/seenMarker";
import { store } from "../../../src/store/useStore";
import { initialStore } from "../../../src/store/types";
import type { ContentDocument, SnapshotAlert } from "../../../src/contracts";

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
vi.mock("../../../src/ui/Dialog.module.css", () => ({
  dialog: "dialog",
  dialogNarrow: "dialogNarrow",
  body: "body",
  head: "head",
  closeX: "closeX",
  scroll: "scroll",
  title: "title",
  meta: "meta",
  copy: "copy",
  actions: "actions",
  alert: "alert",
  notice: "notice",
}));

vi.mock("../../../src/api/subscriptions", () => ({
  getMyNotifications: vi.fn(),
  putSeenUpTo: vi.fn(),
}));

import * as subsApi from "../../../src/api/subscriptions";

const SIGNED_IN: AuthState = { status: "signedIn", email: "p@example.com", expired: false };

function alert(id: number, createdAt: string, subject: string, kind = "event_status"): SnapshotAlert {
  return { id, kind, statusId: kind === "event_status" ? 2 : null, messageId: null, subject, message: null, createdAt };
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

function seed(
  content: ContentDocument,
  alerts: SnapshotAlert[] | null = [],
  snapshotUrl = "https://cdn/snap-1.json",
) {
  act(() => {
    store.setState({
      ...initialStore,
      snapshot: {
        schemaVersion: 1,
        content: content as unknown,
        media: {},
        icons: {},
        event: alerts === null ? null : { statusId: 1, name: "Santa 2026", alerts },
      },
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

// Seeds the snapshot with the alerts; null seeds a snapshot with no event.
function mockLists(alerts: SnapshotAlert[] | null) {
  seed(makeContent(), alerts);
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
  vi.mocked(subsApi.getMyNotifications).mockReset();
  vi.mocked(subsApi.getMyNotifications).mockResolvedValue({ subscription: null, seenUpToId: null });
  vi.mocked(subsApi.putSeenUpTo).mockReset();
  vi.mocked(subsApi.putSeenUpTo).mockResolvedValue(undefined);
  seed(makeContent());
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  act(() => store.setState({ ...initialStore }));
});

describe("AlertsBell visibility", () => {
  it("shows for a signed-out visitor whenever the snapshot has an event", async () => {
    mockLists(ALERTS);
    const { findByTestId } = renderShell({ status: "signedOut" });
    const bell = await findByTestId("alerts-bell");
    expect(bell.getAttribute("aria-label")).toBe("Alerts, 3 new");
  });

  it("shows with an event and no alerts, signed in or not", async () => {
    mockLists([]);
    const signedOut = renderShell({ status: "signedOut" });
    expect(signedOut.getByTestId("alerts-bell").getAttribute("aria-label")).toBe("Alerts");
    signedOut.unmount();
    const signedIn = renderShell(SIGNED_IN);
    expect(signedIn.getByTestId("alerts-bell")).not.toBeNull();
  });

  it("is hidden while the snapshot's event is null", async () => {
    mockLists(null);
    const { queryByTestId } = renderShell(SIGNED_IN);
    await act(async () => {});
    expect(queryByTestId("alerts-bell")).toBeNull();
  });

  it("sits between sign-in and the theme picker", async () => {
    mockLists([]);
    const { findByTestId, getByTestId } = renderShell(SIGNED_IN);
    const bell = await findByTestId("alerts-bell");
    const actions = Array.from(bell.parentElement!.children);
    const signOut = getByTestId("menu-sign-out");
    const theme = getByTestId("theme-toggle").parentElement!;
    expect(actions.indexOf(signOut)).toBeLessThan(actions.indexOf(bell));
    expect(actions.indexOf(bell)).toBeLessThan(actions.indexOf(theme));
  });
});

describe("AlertsBell badge", () => {
  it("draws the notification bell glyph", async () => {
    mockLists(ALERTS);
    const { findByTestId } = renderShell(SIGNED_IN);
    const bell = await findByTestId("alerts-bell");
    const glyph = bell.querySelector('[data-testid="alerts-bell-glyph"]');
    expect(glyph?.tagName.toLowerCase()).toBe("svg");
    expect(glyph?.getAttribute("stroke")).toBe("currentColor");
    expect(glyph?.getAttribute("stroke-width")).toBe("1.75");
    expect(glyph?.getAttribute("width")).toBe("20");
  });

  it("counts every alert when the storage key is absent", async () => {
    mockLists(ALERTS);
    const { findByTestId } = renderShell(SIGNED_IN);
    const bell = await findByTestId("alerts-bell");
    await waitFor(() => expect(bell.getAttribute("aria-label")).toBe("Alerts, 3 new"));
    expect(bell.querySelector('[data-testid="alerts-badge"]')?.textContent).toBe("3");
  });

  it("counts the alerts above the stored id", async () => {
    window.localStorage.setItem(ALERTS_SEEN_KEY, "5");
    mockLists(ALERTS);
    const { findByTestId } = renderShell(SIGNED_IN);
    const bell = await findByTestId("alerts-bell");
    await waitFor(() => expect(bell.getAttribute("aria-label")).toBe("Alerts, 2 new"));
    expect(bell.querySelector('[data-testid="alerts-badge"]')?.textContent).toBe("2");
  });

  it("shows no badge when every alert is seen", async () => {
    window.localStorage.setItem(ALERTS_SEEN_KEY, "7");
    mockLists(ALERTS);
    const { findByTestId } = renderShell(SIGNED_IN);
    const bell = await findByTestId("alerts-bell");
    expect(bell.getAttribute("aria-label")).toBe("Alerts");
    expect(bell.querySelector('[data-testid="alerts-badge"]')).toBeNull();
  });

  it("removes the old seen key on the first read and ignores its number", async () => {
    window.localStorage.setItem(ALERTS_OLD_SEEN_KEY, "999");
    mockLists(ALERTS);
    const { findByTestId } = renderShell({ status: "signedOut" });
    const bell = await findByTestId("alerts-bell");
    expect(bell.getAttribute("aria-label")).toBe("Alerts, 3 new");
    expect(window.localStorage.getItem(ALERTS_OLD_SEEN_KEY)).toBeNull();
    expect(ALERTS_SEEN_KEY).toBe("wmsfo.alerts.seenId");
  });

  it("reads 9+ past nine", async () => {
    const many = Array.from({ length: 12 }, (_, i) => alert(i + 1, `2026-10-01T0${i % 10}:00:00Z`, `s${i}`));
    mockLists(many);
    const { findByTestId } = renderShell(SIGNED_IN);
    const badge = await findByTestId("alerts-badge");
    expect(badge.textContent).toBe("9+");
  });
});

describe("AlertsDialog", () => {
  it("never opens on its own", async () => {
    mockLists(ALERTS);
    const { findByTestId, queryByTestId } = renderShell(SIGNED_IN);
    await findByTestId("alerts-badge");
    expect(queryByTestId("alerts-dialog")).toBeNull();
  });

  it("opening stores the newest id, clears the badge, and keeps the New markers until it closes", async () => {
    window.localStorage.setItem(ALERTS_SEEN_KEY, "5");
    mockLists(ALERTS);
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
    mockLists([
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
    mockLists(ALERTS);
    const { findByTestId, getByTestId, queryByTestId } = renderShell(SIGNED_IN);
    fireEvent.click(await findByTestId("alerts-bell"));
    fireEvent.click(getByTestId("alerts-dialog"));
    expect(queryByTestId("alerts-dialog")).toBeNull();
  });

  it("shows the empty text when the snapshot has no alerts", async () => {
    mockLists([]);
    const { findByTestId, getByTestId } = renderShell(SIGNED_IN);
    fireEvent.click(await findByTestId("alerts-bell"));
    expect(getByTestId("alerts-dialog-empty").textContent).toBe("No alerts yet");
  });

  it("keeps the close X and the bottom Close outside the scroll region with thirty alerts", async () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      alert(i + 1, `2026-10-01T${String(i % 24).padStart(2, "0")}:${String(i).padStart(2, "0")}:00Z`, `Alert ${i + 1}`),
    );
    mockLists(many);
    const { findByTestId, getByTestId } = renderShell(SIGNED_IN);
    fireEvent.click(await findByTestId("alerts-bell"));
    const dialog = getByTestId("alerts-dialog");
    expect(dialog.classList.contains("dialog")).toBe(true);
    expect(dialog.classList.contains("dialogNarrow")).toBe(false);
    const scroll = getByTestId("alerts-dialog-scroll");
    expect(scroll.classList.contains("scroll")).toBe(true);
    expect(scroll.querySelectorAll("li")).toHaveLength(30);
    const x = getByTestId("alerts-dialog-close-x");
    const close = getByTestId("alerts-dialog-close");
    expect(x.getAttribute("aria-label")).toBe("Close");
    expect(x.closest(".head")).not.toBeNull();
    expect(scroll.contains(x)).toBe(false);
    expect(scroll.contains(close)).toBe(false);
    expect(close.closest(".actions")).not.toBeNull();
  });

  it("closes from the close X in the head", async () => {
    mockLists(ALERTS);
    const { findByTestId, getByTestId, queryByTestId } = renderShell(SIGNED_IN);
    fireEvent.click(await findByTestId("alerts-bell"));
    fireEvent.click(getByTestId("alerts-dialog-close-x"));
    expect(queryByTestId("alerts-dialog")).toBeNull();
  });

  it("has Close in the footer and no Manage alerts link, even with an alerts_signup page", async () => {
    mockLists(ALERTS);
    const { findByTestId, getByTestId, queryByTestId } = renderShell(SIGNED_IN);
    fireEvent.click(await findByTestId("alerts-bell"));
    expect(getByTestId("alerts-dialog-close").textContent).toBe("Close");
    expect(queryByTestId("alerts-dialog-manage")).toBeNull();
    expect(getByTestId("alerts-dialog").querySelector("a")).toBeNull();
  });
});

describe("AlertsBell swing", () => {
  async function riseCount() {
    mockLists(ALERTS.slice(0, 1));
    const view = renderShell({ status: "signedOut" });
    await act(async () => {});
    const body = view.getByTestId("alerts-bell-body");
    expect(body.className).not.toContain("swing");
    seed(makeContent(), ALERTS, "https://cdn/snap-2.json");
    await act(async () => {});
    expect(view.getByTestId("alerts-bell").getAttribute("aria-label")).toBe("Alerts, 3 new");
    return view.getByTestId("alerts-bell-body");
  }

  it("swings once when the unread count rises", async () => {
    stubReducedMotion(false);
    const body = await riseCount();
    expect(body.className).toContain("swing");
  });

  it("swings when matchMedia reports reduced motion", async () => {
    stubReducedMotion(true);
    const body = await riseCount();
    expect(body.className).toContain("swing");
  });
});

const EMAIL = "p@example.com";

// Stores a flag for the account; the provider's one read answers with
// the same row, so the flag stays.
function storeFlag(account = EMAIL) {
  window.localStorage.setItem(
    SUBSCRIPTION_FLAG_KEY,
    JSON.stringify({ account, id: 3, address: account, state: "active" }),
  );
  vi.mocked(subsApi.getMyNotifications).mockResolvedValue({
    subscription: { id: 3, channel: "email", address: account, verifiedAt: "2026-10-01T00:00:00Z", unsubscribedAt: null, createdAt: "2026-10-01T00:00:00Z" },
    seenUpToId: null,
  });
}

function renderWithFlag(auth: AuthState) {
  return render(
    <MemoryRouter>
      <AuthProvider initialState={auth}>
        <SubscriptionProvider>
          <AlertsProvider>
            <Shell>
              <div>body</div>
            </Shell>
          </AlertsProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("Opening the bell records seen up to", () => {
  it("sends PUT /me/notifications/seen once for a signed-in subscriber when the marker advances", async () => {
    storeFlag();
    window.localStorage.setItem(ALERTS_SEEN_KEY, "5");
    mockLists(ALERTS);
    const { findByTestId, getByTestId } = renderWithFlag(SIGNED_IN);
    const bell = await findByTestId("alerts-bell");
    fireEvent.click(bell);
    expect(window.localStorage.getItem(ALERTS_SEEN_KEY)).toBe("7");
    expect(subsApi.putSeenUpTo).toHaveBeenCalledTimes(1);
    expect(subsApi.putSeenUpTo).toHaveBeenCalledWith(7);

    fireEvent.click(getByTestId("alerts-dialog-close"));
    fireEvent.click(bell);
    expect(subsApi.putSeenUpTo).toHaveBeenCalledTimes(1);
  });

  it("sends nothing when there is nothing new", async () => {
    storeFlag();
    window.localStorage.setItem(ALERTS_SEEN_KEY, "7");
    mockLists(ALERTS);
    const { findByTestId } = renderWithFlag(SIGNED_IN);
    fireEvent.click(await findByTestId("alerts-bell"));
    expect(window.localStorage.getItem(ALERTS_SEEN_KEY)).toBe("7");
    expect(subsApi.putSeenUpTo).not.toHaveBeenCalled();
  });

  it("sends nothing signed in without a flag, and the marker still rises", async () => {
    mockLists(ALERTS);
    const { findByTestId } = renderWithFlag(SIGNED_IN);
    fireEvent.click(await findByTestId("alerts-bell"));
    expect(window.localStorage.getItem(ALERTS_SEEN_KEY)).toBe("7");
    expect(subsApi.putSeenUpTo).not.toHaveBeenCalled();
  });

  it("sends nothing signed out, and the marker still rises", async () => {
    storeFlag();
    mockLists(ALERTS);
    const { findByTestId } = renderWithFlag({ status: "signedOut" });
    fireEvent.click(await findByTestId("alerts-bell"));
    expect(window.localStorage.getItem(ALERTS_SEEN_KEY)).toBe("7");
    expect(subsApi.putSeenUpTo).not.toHaveBeenCalled();
  });

  it("ignores a failed write, and the next advance sends again", async () => {
    storeFlag();
    vi.mocked(subsApi.putSeenUpTo).mockRejectedValueOnce(new Error("network"));
    mockLists(ALERTS);
    const { findByTestId, getByTestId } = renderWithFlag(SIGNED_IN);
    const bell = await findByTestId("alerts-bell");
    fireEvent.click(bell);
    await act(async () => {});
    expect(subsApi.putSeenUpTo).toHaveBeenCalledWith(7);
    expect(window.localStorage.getItem(ALERTS_SEEN_KEY)).toBe("7");
    fireEvent.click(getByTestId("alerts-dialog-close"));

    mockLists([...ALERTS, alert(9, "2026-10-01T13:00:00Z", "Santa is near")]);
    fireEvent.click(bell);
    expect(subsApi.putSeenUpTo).toHaveBeenCalledTimes(2);
    expect(subsApi.putSeenUpTo).toHaveBeenLastCalledWith(9);
  });

  it("the badge follows a raise of the marker from elsewhere in the page load", async () => {
    mockLists(ALERTS);
    const { findByTestId, queryByTestId } = renderShell({ status: "signedOut" });
    await findByTestId("alerts-badge");
    act(() => {
      seenMarker.raise(7);
    });
    expect(queryByTestId("alerts-badge")).toBeNull();
  });
});
