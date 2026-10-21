// docs/site.md sections 6.1 step 4, 7.7, and 22.1. The one read,
// `GET /me/notifications`: once on a sign-in during the page load and not
// on a restored session, once per load after the first live object with a
// flag of the signed-in account, never without a flag, never on a route
// change or a store update; the flag written or cleared from
// `subscription`, the read marker raised from `seenUpToId` and never
// lowered, both left as they were on SignInRequired or a failure, and the
// clears on sign-out and on another account.

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
  type SubscriptionFlag,
} from "../../../src/alerts/subscriptionFlag";
import { store } from "../../../src/store/useStore";
import { initialStore } from "../../../src/store/types";
import type { Subscription } from "../../../src/api/subscriptions";

vi.mock("../../../src/api/subscriptions", () => ({
  getMyNotifications: vi.fn(),
}));

import * as subsApi from "../../../src/api/subscriptions";

const EMAIL = "p@e.com";
const SIGNED_IN: AuthState = { status: "signedIn", email: EMAIL, expired: false };
const FLAG: SubscriptionFlag = { account: EMAIL, id: 5, address: EMAIL, state: "pending" };

function row(id: number, createdAt: string, verifiedAt: string | null, unsubscribedAt: string | null = null): Subscription {
  return { id, channel: "email", address: `a${id}@e.com`, verifiedAt, unsubscribedAt, createdAt };
}

function answer(subscription: Subscription | null, seenUpToId: number | null = null) {
  return { subscription, seenUpToId };
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
  vi.mocked(subsApi.getMyNotifications).mockReset();
  act(() => store.setState({ ...initialStore }));
});

afterEach(() => {
  cleanup();
  act(() => session.clear());
  act(() => store.setState({ ...initialStore }));
});

describe("the one read per app load for a subscriber", () => {
  it("calls GET /me/notifications once after the first live object and rewrites the flag as active", async () => {
    storeFlag(FLAG);
    vi.mocked(subsApi.getMyNotifications).mockResolvedValue(answer(row(7, "2026-09-01", "2026-09-02")));
    const view = renderApp(SIGNED_IN);
    await act(async () => {});
    expect(subsApi.getMyNotifications).not.toHaveBeenCalled();
    applyLive(1);
    await act(async () => {});
    expect(subsApi.getMyNotifications).toHaveBeenCalledTimes(1);
    const expected = { account: EMAIL, id: 7, address: "a7@e.com", state: "active" };
    expect(shownFlag(view)).toEqual(expected);
    expect(readFlag()).toEqual(expected);

    applyLive(2);
    await act(async () => {});
    fireEvent.click(view.getByText("About"));
    await act(async () => {});
    expect(view.getByText("about")).toBeInTheDocument();
    expect(subsApi.getMyNotifications).toHaveBeenCalledTimes(1);
  });

  it("writes pending from an unverified row", async () => {
    storeFlag({ ...FLAG, state: "active" });
    vi.mocked(subsApi.getMyNotifications).mockResolvedValue(answer(row(8, "2026-09-01", null)));
    applyLive();
    const view = renderApp(SIGNED_IN);
    await act(async () => {});
    expect(shownFlag(view)?.state).toBe("pending");
    expect(shownFlag(view)?.id).toBe(8);
  });

  it("clears the flag when subscription is null", async () => {
    storeFlag(FLAG);
    vi.mocked(subsApi.getMyNotifications).mockResolvedValue(answer(null));
    applyLive();
    const view = renderApp(SIGNED_IN);
    await act(async () => {});
    expect(shownFlag(view)).toBeNull();
    expect(window.localStorage.getItem(SUBSCRIPTION_FLAG_KEY)).toBeNull();
  });

  it("raises the read marker from seenUpToId and never lowers it", async () => {
    storeFlag(FLAG);
    vi.mocked(subsApi.getMyNotifications).mockResolvedValue(answer(row(5, "2026-09-01", null), 40));
    window.localStorage.setItem(ALERTS_SEEN_KEY, "12");
    applyLive();
    renderApp(SIGNED_IN);
    await act(async () => {});
    expect(seenMarker.read()).toBe(40);
    cleanup();

    window.localStorage.setItem(ALERTS_SEEN_KEY, "90");
    vi.mocked(subsApi.getMyNotifications).mockResolvedValue(answer(row(5, "2026-09-01", null), 40));
    renderApp(SIGNED_IN);
    await act(async () => {});
    expect(seenMarker.read()).toBe(90);
  });

  it("a null seenUpToId leaves the marker as it was", async () => {
    storeFlag(FLAG);
    window.localStorage.setItem(ALERTS_SEEN_KEY, "12");
    vi.mocked(subsApi.getMyNotifications).mockResolvedValue(answer(row(5, "2026-09-01", null), null));
    applyLive();
    renderApp(SIGNED_IN);
    await act(async () => {});
    expect(seenMarker.read()).toBe(12);
  });

  it("leaves the flag and the marker as they were on SignInRequired or a failure", async () => {
    storeFlag(FLAG);
    window.localStorage.setItem(ALERTS_SEEN_KEY, "12");
    vi.mocked(subsApi.getMyNotifications).mockRejectedValueOnce(new SignInRequired());
    applyLive();
    const view = renderApp(SIGNED_IN);
    await act(async () => {});
    expect(shownFlag(view)).toEqual(FLAG);
    expect(seenMarker.read()).toBe(12);
    cleanup();

    vi.mocked(subsApi.getMyNotifications).mockRejectedValueOnce(new Error("network"));
    const again = renderApp(SIGNED_IN);
    await act(async () => {});
    expect(shownFlag(again)).toEqual(FLAG);
    expect(readFlag()).toEqual(FLAG);
    expect(seenMarker.read()).toBe(12);
  });

  it("makes no call without a flag", async () => {
    applyLive();
    renderApp(SIGNED_IN);
    await act(async () => {});
    expect(subsApi.getMyNotifications).not.toHaveBeenCalled();
  });

  it("makes no call signed out, and clears the flag", async () => {
    storeFlag(FLAG);
    applyLive();
    const view = renderApp({ status: "signedOut" });
    await act(async () => {});
    expect(subsApi.getMyNotifications).not.toHaveBeenCalled();
    expect(shownFlag(view)).toBeNull();
    expect(readFlag()).toBeNull();
  });

  it("makes no call while the auth state is unknown and keeps the flag", async () => {
    storeFlag(FLAG);
    applyLive();
    const view = renderApp({ status: "unknown" });
    await act(async () => {});
    expect(subsApi.getMyNotifications).not.toHaveBeenCalled();
    expect(shownFlag(view)).toEqual(FLAG);
  });

  it("clears the flag of another account and makes no call", async () => {
    storeFlag({ ...FLAG, account: "other@e.com" });
    applyLive();
    const view = renderApp(SIGNED_IN);
    await act(async () => {});
    expect(subsApi.getMyNotifications).not.toHaveBeenCalled();
    expect(shownFlag(view)).toBeNull();
  });

  it("a flag written through setFlag counts as checked: no GET follows it", async () => {
    vi.mocked(subsApi.getMyNotifications).mockResolvedValue(answer(row(5, "2026-09-01", null)));
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
    applyLive();
    await act(async () => {});
    expect(subsApi.getMyNotifications).not.toHaveBeenCalled();
    fireEvent.click(view.getByText("write"));
    await act(async () => {});
    applyLive(2);
    await act(async () => {});
    expect(subsApi.getMyNotifications).not.toHaveBeenCalled();
    expect(shownFlag(view)?.id).toBe(9);
  });

  it("clears the flag on sign-out", async () => {
    storeFlag(FLAG);
    vi.mocked(subsApi.getMyNotifications).mockResolvedValue(answer(row(5, "2026-09-01", null)));
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
    vi.mocked(subsApi.getMyNotifications).mockResolvedValue(answer(row(5, "2026-09-01", "2026-09-02"), 33));
    const view = renderApp({ status: "signedOut" });
    await act(async () => {});
    expect(subsApi.getMyNotifications).not.toHaveBeenCalled();
    act(() => session.set(TOKENS));
    await act(async () => {});
    expect(subsApi.getMyNotifications).toHaveBeenCalledTimes(1);
    expect(shownFlag(view)).toEqual({ account: EMAIL, id: 5, address: "a5@e.com", state: "active" });
    expect(seenMarker.read()).toBe(33);

    applyLive();
    await act(async () => {});
    fireEvent.click(view.getByText("About"));
    await act(async () => {});
    expect(subsApi.getMyNotifications).toHaveBeenCalledTimes(1);
  });

  it("runs once when the visitor signs in with a flag for that account", async () => {
    storeFlag(FLAG);
    vi.mocked(subsApi.getMyNotifications).mockResolvedValue(answer(row(5, "2026-09-01", null)));
    applyLive();
    const view = renderApp({ status: "unknown" });
    await act(async () => {});
    expect(subsApi.getMyNotifications).not.toHaveBeenCalled();
    act(() => session.set(TOKENS));
    await act(async () => {});
    expect(subsApi.getMyNotifications).toHaveBeenCalledTimes(1);
    expect(shownFlag(view)?.state).toBe("pending");
  });

  it("a sign-in that answers no subscription leaves no flag", async () => {
    vi.mocked(subsApi.getMyNotifications).mockResolvedValue(answer(null, null));
    const view = renderApp({ status: "signedOut" });
    act(() => session.set(TOKENS));
    await act(async () => {});
    expect(subsApi.getMyNotifications).toHaveBeenCalledTimes(1);
    expect(shownFlag(view)).toBeNull();
    expect(seenMarker.read()).toBeNull();
  });

  it("a refresh is not a sign-in", async () => {
    vi.mocked(subsApi.getMyNotifications).mockResolvedValue(answer(null));
    renderApp({ status: "signedOut" });
    act(() => session.set(TOKENS, "refresh"));
    await act(async () => {});
    expect(subsApi.getMyNotifications).not.toHaveBeenCalled();
  });

  it("a session restored at boot without a flag makes no call", async () => {
    vi.mocked(subsApi.getMyNotifications).mockResolvedValue(answer(null));
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
    expect(subsApi.getMyNotifications).not.toHaveBeenCalled();
  });

  it("a session restored at boot with a matching flag reads once after the first live object", async () => {
    storeFlag(FLAG);
    vi.mocked(subsApi.getMyNotifications).mockResolvedValue(answer(row(5, "2026-09-01", null)));
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
    expect(subsApi.getMyNotifications).not.toHaveBeenCalled();
    applyLive();
    await act(async () => {});
    expect(subsApi.getMyNotifications).toHaveBeenCalledTimes(1);
  });

  it("leaves the flag and the marker on a failed sign-in read", async () => {
    window.localStorage.setItem(ALERTS_SEEN_KEY, "7");
    vi.mocked(subsApi.getMyNotifications).mockRejectedValueOnce(new Error("network"));
    const view = renderApp({ status: "signedOut" });
    act(() => session.set(TOKENS));
    await act(async () => {});
    expect(subsApi.getMyNotifications).toHaveBeenCalledTimes(1);
    expect(shownFlag(view)).toBeNull();
    expect(seenMarker.read()).toBe(7);
  });
});
