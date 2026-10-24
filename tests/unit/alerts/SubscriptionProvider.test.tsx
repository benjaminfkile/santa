// docs/site.md sections 6.1 step 4, 7.7, and 22.1. The one read,
// `GET /me`: once on a sign-in during the page load, once
// per signed-in page load after the first live object (a restored session
// included, with or without a flag), never signed out, never on a route
// change or a store update; the flag written or cleared from
// `subscription`, the read marker raised from `seenUpToId` and never
// lowered, both left as they were on SignInRequired or a failure, and the
// clears on sign-out and on another account. The answer's `preferences`
// applied when non-null; null ones with a local choice pushed once, and
// nothing sent when both are empty.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider, type AuthState } from "../../../src/auth/AuthProvider";
import { session } from "../../../src/auth/session";
import { SignInRequired } from "../../../src/auth/getIdToken";
import {
  SubscriptionProvider,
  useSubscription,
} from "../../../src/alerts/SubscriptionProvider";
import { ALERTS_SEEN_KEY, seenMarker } from "../../../src/alerts/seenMarker";
import {
  SUBSCRIPTION_FLAG_KEY,
  readFlag,
  writeFlag,
  type SubscriptionFlag,
} from "../../../src/alerts/subscriptionFlag";
import { store } from "../../../src/store/useStore";
import { initialStore } from "../../../src/store/types";
import type { Subscription } from "../../../src/api/subscriptions";

vi.mock("../../../src/api/subscriptions", () => ({
  getMe: vi.fn(),
}));

vi.mock("../../../src/api/preferences", () => ({
  putPreferences: vi.fn(),
}));

import * as subsApi from "../../../src/api/subscriptions";
import * as prefsApi from "../../../src/api/preferences";
import type { Preferences } from "../../../src/api/preferences";
import { THEME_KEY, clearTheme, getChoice } from "../../../src/content/theme/colorScheme";
import {
  TRACKER_SETTINGS_KEY,
  readTrackerSettings,
  resetTrackerTogglesForTests,
} from "../../../src/content/sections/Map/trackerToggles";
import { THEME_STORAGE_KEY, readThemeKey, resetThemeKeyForTests } from "../../../src/map/themes";

const EMAIL = "p@e.com";
const SIGNED_IN: AuthState = { status: "signedIn", email: EMAIL, expired: false };
const FLAG: SubscriptionFlag = { account: EMAIL, id: 5, address: EMAIL, state: "pending" };

function row(id: number, createdAt: string, verifiedAt: string | null, unsubscribedAt: string | null = null): Subscription {
  return { id, channel: "email", address: `a${id}@e.com`, verifiedAt, unsubscribedAt, createdAt };
}

function answer(
  subscription: Subscription | null,
  seenUpToId: number | null = null,
  preferences: Preferences | null = null,
) {
  return { subscription, seenUpToId, preferences };
}

const TOKENS = {
  idToken: "i",
  accessToken: "a",
  refreshToken: "r",
  email: EMAIL,
  sub: "s",
  idExpiresAt: Date.now() + 3_600_000,
};

function storeFlag(flag: SubscriptionFlag) {
  window.localStorage.setItem(SUBSCRIPTION_FLAG_KEY, JSON.stringify(flag));
}

function applyLive(seq = 1) {
  act(() => {
    store.setState({
      live: { schemaVersion: 1, eventId: 1, eventStatusId: 1, seq, publishedAt: `2026-10-01T00:00:0${seq}Z` },
    } as never);
  });
}

function Probe() {
  const { flag } = useSubscription();
  return <div data-testid="flag">{flag === null ? "none" : JSON.stringify(flag)}</div>;
}

function renderApp(auth: AuthState) {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <AuthProvider initialState={auth}>
        <SubscriptionProvider>
          <Probe />
          <Link to="/about">About</Link>
          <Routes>
            <Route path="/" element={<div>home</div>} />
            <Route path="/about" element={<div>about</div>} />
          </Routes>
        </SubscriptionProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

function shownFlag(view: ReturnType<typeof renderApp>): SubscriptionFlag | null {
  const text = view.getByTestId("flag").textContent ?? "none";
  return text === "none" ? null : (JSON.parse(text) as SubscriptionFlag);
}

beforeEach(() => {
  window.localStorage.clear();
  resetTrackerTogglesForTests();
  resetThemeKeyForTests();
  vi.mocked(subsApi.getMe).mockReset();
  vi.mocked(prefsApi.putPreferences).mockReset();
  vi.mocked(prefsApi.putPreferences).mockResolvedValue(undefined);
  act(() => store.setState({ ...initialStore }));
});

afterEach(() => {
  cleanup();
  clearTheme();
  resetTrackerTogglesForTests();
  resetThemeKeyForTests();
  act(() => session.clear());
  act(() => store.setState({ ...initialStore }));
});

describe("the one read per app load for a subscriber", () => {
  it("calls GET /me once after the first live object and rewrites the flag as active", async () => {
    storeFlag(FLAG);
    vi.mocked(subsApi.getMe).mockResolvedValue(answer(row(7, "2026-09-01", "2026-09-02")));
    const view = renderApp(SIGNED_IN);
    await act(async () => {});
    expect(subsApi.getMe).not.toHaveBeenCalled();
    applyLive(1);
    await act(async () => {});
    expect(subsApi.getMe).toHaveBeenCalledTimes(1);
    const expected = { account: EMAIL, id: 7, address: "a7@e.com", state: "active" };
    expect(shownFlag(view)).toEqual(expected);
    expect(readFlag()).toEqual(expected);

    applyLive(2);
    await act(async () => {});
    fireEvent.click(view.getByText("About"));
    await act(async () => {});
    expect(view.getByText("about")).toBeInTheDocument();
    expect(subsApi.getMe).toHaveBeenCalledTimes(1);
  });

  it("writes pending from an unverified row", async () => {
    storeFlag({ ...FLAG, state: "active" });
    vi.mocked(subsApi.getMe).mockResolvedValue(answer(row(8, "2026-09-01", null)));
    applyLive();
    const view = renderApp(SIGNED_IN);
    await act(async () => {});
    expect(shownFlag(view)?.state).toBe("pending");
    expect(shownFlag(view)?.id).toBe(8);
  });

  it("clears the flag when subscription is null", async () => {
    storeFlag(FLAG);
    vi.mocked(subsApi.getMe).mockResolvedValue(answer(null));
    applyLive();
    const view = renderApp(SIGNED_IN);
    await act(async () => {});
    expect(shownFlag(view)).toBeNull();
    expect(window.localStorage.getItem(SUBSCRIPTION_FLAG_KEY)).toBeNull();
  });

  it("raises the read marker from seenUpToId and never lowers it", async () => {
    storeFlag(FLAG);
    vi.mocked(subsApi.getMe).mockResolvedValue(answer(row(5, "2026-09-01", null), 40));
    window.localStorage.setItem(ALERTS_SEEN_KEY, "12");
    applyLive();
    renderApp(SIGNED_IN);
    await act(async () => {});
    expect(seenMarker.read()).toBe(40);
    cleanup();

    window.localStorage.setItem(ALERTS_SEEN_KEY, "90");
    vi.mocked(subsApi.getMe).mockResolvedValue(answer(row(5, "2026-09-01", null), 40));
    renderApp(SIGNED_IN);
    await act(async () => {});
    expect(seenMarker.read()).toBe(90);
  });

  it("a null seenUpToId leaves the marker as it was", async () => {
    storeFlag(FLAG);
    window.localStorage.setItem(ALERTS_SEEN_KEY, "12");
    vi.mocked(subsApi.getMe).mockResolvedValue(answer(row(5, "2026-09-01", null), null));
    applyLive();
    renderApp(SIGNED_IN);
    await act(async () => {});
    expect(seenMarker.read()).toBe(12);
  });

  it("leaves the flag and the marker as they were on SignInRequired or a failure", async () => {
    storeFlag(FLAG);
    window.localStorage.setItem(ALERTS_SEEN_KEY, "12");
    vi.mocked(subsApi.getMe).mockRejectedValueOnce(new SignInRequired());
    applyLive();
    const view = renderApp(SIGNED_IN);
    await act(async () => {});
    expect(shownFlag(view)).toEqual(FLAG);
    expect(seenMarker.read()).toBe(12);
    cleanup();

    vi.mocked(subsApi.getMe).mockRejectedValueOnce(new Error("network"));
    const again = renderApp(SIGNED_IN);
    await act(async () => {});
    expect(shownFlag(again)).toEqual(FLAG);
    expect(readFlag()).toEqual(FLAG);
    expect(seenMarker.read()).toBe(12);
  });

  it("reads once without a flag when signed in, and writes the flag from the answer", async () => {
    vi.mocked(subsApi.getMe).mockResolvedValue(answer(row(5, "2026-09-01", "2026-09-02")));
    applyLive();
    const view = renderApp(SIGNED_IN);
    await act(async () => {});
    expect(subsApi.getMe).toHaveBeenCalledTimes(1);
    expect(shownFlag(view)?.state).toBe("active");
    applyLive(2);
    await act(async () => {});
    expect(subsApi.getMe).toHaveBeenCalledTimes(1);
  });

  it("makes no call signed out, and clears the flag", async () => {
    storeFlag(FLAG);
    applyLive();
    const view = renderApp({ status: "signedOut" });
    await act(async () => {});
    expect(subsApi.getMe).not.toHaveBeenCalled();
    expect(shownFlag(view)).toBeNull();
    expect(readFlag()).toBeNull();
  });

  it("makes no call while the auth state is unknown and keeps the flag", async () => {
    storeFlag(FLAG);
    applyLive();
    const view = renderApp({ status: "unknown" });
    await act(async () => {});
    expect(subsApi.getMe).not.toHaveBeenCalled();
    expect(shownFlag(view)).toEqual(FLAG);
  });

  it("clears the flag of another account and reads once for the signed-in account", async () => {
    storeFlag({ ...FLAG, account: "other@e.com" });
    vi.mocked(subsApi.getMe).mockResolvedValue(answer(null));
    applyLive();
    const view = renderApp(SIGNED_IN);
    await act(async () => {});
    expect(subsApi.getMe).toHaveBeenCalledTimes(1);
    expect(shownFlag(view)).toBeNull();
  });

  it("a flag written through setFlag counts as checked: no GET follows it", async () => {
    vi.mocked(subsApi.getMe).mockResolvedValue(answer(row(5, "2026-09-01", null)));
    function Writer() {
      const { setFlag } = useSubscription();
      return (
        <button type="button" onClick={() => setFlag({ account: EMAIL, id: 9, address: EMAIL, state: "active" })}>
          write
        </button>
      );
    }
    const view = render(
      <MemoryRouter initialEntries={["/"]}>
        <AuthProvider initialState={SIGNED_IN}>
          <SubscriptionProvider>
            <Probe />
            <Writer />
          </SubscriptionProvider>
        </AuthProvider>
      </MemoryRouter>,
    );
    // The row is written before the first live object applies (a sign-up
    // on a page that loaded before the live object), so the load read of
    // step 4 (b) has nothing left to learn and does not run.
    fireEvent.click(view.getByText("write"));
    await act(async () => {});
    applyLive();
    await act(async () => {});
    applyLive(2);
    await act(async () => {});
    expect(subsApi.getMe).not.toHaveBeenCalled();
    expect(shownFlag(view)?.id).toBe(9);
  });

  it("clears the flag on sign-out", async () => {
    storeFlag(FLAG);
    vi.mocked(subsApi.getMe).mockResolvedValue(answer(row(5, "2026-09-01", null)));
    act(() => session.set(TOKENS));
    applyLive();
    const view = renderApp(SIGNED_IN);
    await act(async () => {});
    expect(shownFlag(view)).not.toBeNull();
    act(() => session.clear());
    await act(async () => {});
    expect(shownFlag(view)).toBeNull();
    expect(readFlag()).toBeNull();
  });
});

describe("the one read on sign-in", () => {
  it("calls once when the visitor signs in, without a flag, and writes the flag and the marker", async () => {
    vi.mocked(subsApi.getMe).mockResolvedValue(answer(row(5, "2026-09-01", "2026-09-02"), 33));
    const view = renderApp({ status: "signedOut" });
    await act(async () => {});
    expect(subsApi.getMe).not.toHaveBeenCalled();
    act(() => session.set(TOKENS));
    await act(async () => {});
    expect(subsApi.getMe).toHaveBeenCalledTimes(1);
    expect(shownFlag(view)).toEqual({ account: EMAIL, id: 5, address: "a5@e.com", state: "active" });
    expect(seenMarker.read()).toBe(33);

    applyLive();
    await act(async () => {});
    fireEvent.click(view.getByText("About"));
    await act(async () => {});
    expect(subsApi.getMe).toHaveBeenCalledTimes(1);
  });

  it("runs once when the visitor signs in with a flag for that account", async () => {
    storeFlag(FLAG);
    vi.mocked(subsApi.getMe).mockResolvedValue(answer(row(5, "2026-09-01", null)));
    applyLive();
    const view = renderApp({ status: "unknown" });
    await act(async () => {});
    expect(subsApi.getMe).not.toHaveBeenCalled();
    act(() => session.set(TOKENS));
    await act(async () => {});
    expect(subsApi.getMe).toHaveBeenCalledTimes(1);
    expect(shownFlag(view)?.state).toBe("pending");
  });

  it("a sign-in that answers no subscription leaves no flag", async () => {
    vi.mocked(subsApi.getMe).mockResolvedValue(answer(null, null));
    const view = renderApp({ status: "signedOut" });
    act(() => session.set(TOKENS));
    await act(async () => {});
    expect(subsApi.getMe).toHaveBeenCalledTimes(1);
    expect(shownFlag(view)).toBeNull();
    expect(seenMarker.read()).toBeNull();
  });

  it("a flag written outside the provider while the sign-in read is in flight survives a null answer", async () => {
    let resolveRead: (v: ReturnType<typeof answer>) => void = () => {};
    vi.mocked(subsApi.getMe).mockReturnValueOnce(
      new Promise((r) => { resolveRead = r; }),
    );
    const view = renderApp({ status: "signedOut" });
    act(() => session.set(TOKENS));
    const written: SubscriptionFlag = { account: EMAIL, id: 9, address: EMAIL, state: "active" };
    act(() => writeFlag(written));
    expect(shownFlag(view)).toEqual(written);
    await act(async () => resolveRead(answer(null)));
    expect(shownFlag(view)).toEqual(written);
    expect(readFlag()).toEqual(written);
  });

  it("a refresh is not a sign-in", async () => {
    vi.mocked(subsApi.getMe).mockResolvedValue(answer(null));
    renderApp({ status: "signedOut" });
    act(() => session.set(TOKENS, "refresh"));
    await act(async () => {});
    expect(subsApi.getMe).not.toHaveBeenCalled();
  });

  it("a session restored at boot without a flag reads once after the first live object", async () => {
    vi.mocked(subsApi.getMe).mockResolvedValue(answer(null));
    window.localStorage.setItem("wmsfo.auth.session", JSON.stringify(TOKENS));
    const restored = vi.fn();
    const off = session.subscribe(restored);
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AuthProvider>
          <SubscriptionProvider>
            <Probe />
          </SubscriptionProvider>
        </AuthProvider>
      </MemoryRouter>,
    );
    applyLive();
    await act(async () => {});
    off();
    expect(restored).toHaveBeenCalledWith("restore");
    expect(subsApi.getMe).toHaveBeenCalledTimes(1);
  });

  it("a session restored at boot with a matching flag reads once after the first live object", async () => {
    storeFlag(FLAG);
    vi.mocked(subsApi.getMe).mockResolvedValue(answer(row(5, "2026-09-01", null)));
    window.localStorage.setItem("wmsfo.auth.session", JSON.stringify(TOKENS));
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AuthProvider>
          <SubscriptionProvider>
            <Probe />
          </SubscriptionProvider>
        </AuthProvider>
      </MemoryRouter>,
    );
    await act(async () => {});
    expect(subsApi.getMe).not.toHaveBeenCalled();
    applyLive();
    await act(async () => {});
    expect(subsApi.getMe).toHaveBeenCalledTimes(1);
  });

  it("leaves the flag and the marker on a failed sign-in read", async () => {
    window.localStorage.setItem(ALERTS_SEEN_KEY, "7");
    vi.mocked(subsApi.getMe).mockRejectedValueOnce(new Error("network"));
    const view = renderApp({ status: "signedOut" });
    act(() => session.set(TOKENS));
    await act(async () => {});
    expect(subsApi.getMe).toHaveBeenCalledTimes(1);
    expect(shownFlag(view)).toBeNull();
    expect(seenMarker.read()).toBe(7);
  });
});

describe("the preferences on the GET /me answer", () => {
  it("applies non-null preferences and still writes the flag and the marker", async () => {
    window.localStorage.setItem(THEME_KEY, "light");
    window.localStorage.setItem(TRACKER_SETTINGS_KEY, JSON.stringify({ snow: true }));
    vi.mocked(subsApi.getMe).mockResolvedValue(
      answer(row(7, "2026-09-01", "2026-09-02"), 40, {
        theme: "dark",
        tracker: { flightHistory: true, mapType: "roadmap" },
      }),
    );
    applyLive();
    const view = renderApp(SIGNED_IN);
    await act(async () => {});
    expect(getChoice()).toBe("dark");
    expect(readTrackerSettings()).toEqual({ flightHistory: true, mapType: "roadmap" });
    expect(shownFlag(view)).toEqual({ account: EMAIL, id: 7, address: "a7@e.com", state: "active" });
    expect(seenMarker.read()).toBe(40);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1100));
    });
    expect(prefsApi.putPreferences).not.toHaveBeenCalled();
  });

  it("pushes the local copy once when the server has none and local has a choice", async () => {
    window.localStorage.setItem(THEME_KEY, "dark");
    window.localStorage.setItem(TRACKER_SETTINGS_KEY, JSON.stringify({ cookieTally: false }));
    vi.mocked(subsApi.getMe).mockResolvedValue(answer(row(7, "2026-09-01", null), 12));
    applyLive();
    const view = renderApp(SIGNED_IN);
    await act(async () => {});
    expect(prefsApi.putPreferences).toHaveBeenCalledTimes(1);
    expect(prefsApi.putPreferences).toHaveBeenCalledWith({ theme: "dark", tracker: { cookieTally: false } });
    expect(shownFlag(view)?.state).toBe("pending");
    expect(seenMarker.read()).toBe(12);
  });

  it("lands the answer's tracker theme in the stored theme key, outside the settings object", async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "standard");
    vi.mocked(subsApi.getMe).mockResolvedValue(
      answer(row(7, "2026-09-01", "2026-09-02"), 40, {
        theme: null,
        tracker: { snow: true, theme: "expedition" },
      }),
    );
    applyLive();
    renderApp(SIGNED_IN);
    await act(async () => {});
    expect(readThemeKey()).toBe("expedition");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("expedition");
    expect(readTrackerSettings()).toEqual({ snow: true });
    expect(JSON.parse(window.localStorage.getItem(TRACKER_SETTINGS_KEY) ?? "{}")).toEqual({ snow: true });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1100));
    });
    expect(prefsApi.putPreferences).not.toHaveBeenCalled();
  });

  it("sends nothing when both the server and the browser are empty", async () => {
    vi.mocked(subsApi.getMe).mockResolvedValue(answer(null));
    applyLive();
    renderApp(SIGNED_IN);
    await act(async () => {});
    expect(subsApi.getMe).toHaveBeenCalledTimes(1);
    expect(prefsApi.putPreferences).not.toHaveBeenCalled();
    expect(getChoice()).toBe("system");
    expect(readTrackerSettings()).toEqual({});
  });
});
