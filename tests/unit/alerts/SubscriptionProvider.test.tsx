// docs/site.md sections 6.1 step 4, 7.7, and 22.1. The subscription flag:
// the one `GET /me/subscriptions` per app load (after the first live
// object, signed in, with a flag of that account; never without, never on
// a route change or a store update), the rewrite from the newest row that
// is not unsubscribed, the clear when there is none, the flag left as it
// was on SignInRequired or a failure, and the clears on sign-out and on
// another account.

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
import {
  SUBSCRIPTION_FLAG_KEY,
  newestOpenRow,
  readFlag,
  type SubscriptionFlag,
} from "../../../src/alerts/subscriptionFlag";
import { store } from "../../../src/store/useStore";
import { initialStore } from "../../../src/store/types";
import type { Subscription } from "../../../src/api/subscriptions";

vi.mock("../../../src/api/subscriptions", () => ({
  listMySubscriptions: vi.fn(),
}));

import * as subsApi from "../../../src/api/subscriptions";

const EMAIL = "p@e.com";
const SIGNED_IN: AuthState = { status: "signedIn", email: EMAIL, expired: false };
const FLAG: SubscriptionFlag = { account: EMAIL, id: 5, address: EMAIL, state: "pending" };

function row(id: number, createdAt: string, verifiedAt: string | null, unsubscribedAt: string | null = null): Subscription {
  return { id, channel: "email", address: `a${id}@e.com`, verifiedAt, unsubscribedAt, createdAt };
}

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
  vi.mocked(subsApi.listMySubscriptions).mockReset();
  act(() => store.setState({ ...initialStore }));
});

afterEach(() => {
  cleanup();
  act(() => session.clear());
  act(() => store.setState({ ...initialStore }));
});

describe("newestOpenRow", () => {
  it("takes the newest row that is not unsubscribed, or null", () => {
    expect(newestOpenRow([])).toBeNull();
    expect(newestOpenRow([row(1, "2026-01-01", null, "2026-01-02")])).toBeNull();
    const picked = newestOpenRow([
      row(1, "2026-01-01", "2026-01-01"),
      row(2, "2026-03-01", null, "2026-03-02"),
      row(3, "2026-02-01", null),
    ]);
    expect(picked?.id).toBe(3);
  });
});

describe("the one check per app load", () => {
  it("calls GET /me/subscriptions once after the first live object and rewrites the flag as active", async () => {
    storeFlag(FLAG);
    vi.mocked(subsApi.listMySubscriptions).mockResolvedValue({
      items: [row(7, "2026-09-01", "2026-09-02")],
    } as never);
    const view = renderApp(SIGNED_IN);
    await act(async () => {});
    expect(subsApi.listMySubscriptions).not.toHaveBeenCalled();
    applyLive(1);
    await act(async () => {});
    expect(subsApi.listMySubscriptions).toHaveBeenCalledTimes(1);
    const expected = { account: EMAIL, id: 7, address: "a7@e.com", state: "active" };
    expect(shownFlag(view)).toEqual(expected);
    expect(readFlag()).toEqual(expected);

    applyLive(2);
    await act(async () => {});
    fireEvent.click(view.getByText("About"));
    await act(async () => {});
    expect(view.getByText("about")).toBeInTheDocument();
    expect(subsApi.listMySubscriptions).toHaveBeenCalledTimes(1);
  });

  it("writes pending from an unverified row", async () => {
    storeFlag({ ...FLAG, state: "active" });
    vi.mocked(subsApi.listMySubscriptions).mockResolvedValue({ items: [row(8, "2026-09-01", null)] } as never);
    applyLive();
    const view = renderApp(SIGNED_IN);
    await act(async () => {});
    expect(shownFlag(view)?.state).toBe("pending");
    expect(shownFlag(view)?.id).toBe(8);
  });

  it("clears the flag when every row is unsubscribed", async () => {
    storeFlag(FLAG);
    vi.mocked(subsApi.listMySubscriptions).mockResolvedValue({
      items: [row(5, "2026-09-01", "2026-09-01", "2026-09-03")],
    } as never);
    applyLive();
    const view = renderApp(SIGNED_IN);
    await act(async () => {});
    expect(shownFlag(view)).toBeNull();
    expect(window.localStorage.getItem(SUBSCRIPTION_FLAG_KEY)).toBeNull();
  });

  it("leaves the flag as it was on SignInRequired or a failure", async () => {
    storeFlag(FLAG);
    vi.mocked(subsApi.listMySubscriptions).mockRejectedValueOnce(new SignInRequired());
    applyLive();
    const view = renderApp(SIGNED_IN);
    await act(async () => {});
    expect(shownFlag(view)).toEqual(FLAG);
    cleanup();

    vi.mocked(subsApi.listMySubscriptions).mockRejectedValueOnce(new Error("network"));
    const again = renderApp(SIGNED_IN);
    await act(async () => {});
    expect(shownFlag(again)).toEqual(FLAG);
    expect(readFlag()).toEqual(FLAG);
  });

  it("makes no call without a flag", async () => {
    applyLive();
    renderApp(SIGNED_IN);
    await act(async () => {});
    expect(subsApi.listMySubscriptions).not.toHaveBeenCalled();
  });

  it("makes no call signed out, and clears the flag", async () => {
    storeFlag(FLAG);
    applyLive();
    const view = renderApp({ status: "signedOut" });
    await act(async () => {});
    expect(subsApi.listMySubscriptions).not.toHaveBeenCalled();
    expect(shownFlag(view)).toBeNull();
    expect(readFlag()).toBeNull();
  });

  it("makes no call while the auth state is unknown and keeps the flag", async () => {
    storeFlag(FLAG);
    applyLive();
    const view = renderApp({ status: "unknown" });
    await act(async () => {});
    expect(subsApi.listMySubscriptions).not.toHaveBeenCalled();
    expect(shownFlag(view)).toEqual(FLAG);
  });

  it("clears the flag of another account and makes no call", async () => {
    storeFlag({ ...FLAG, account: "other@e.com" });
    applyLive();
    const view = renderApp(SIGNED_IN);
    await act(async () => {});
    expect(subsApi.listMySubscriptions).not.toHaveBeenCalled();
    expect(shownFlag(view)).toBeNull();
  });

  it("runs the check once when the visitor signs in during the session with a flag for that account", async () => {
    storeFlag(FLAG);
    vi.mocked(subsApi.listMySubscriptions).mockResolvedValue({ items: [row(5, "2026-09-01", null)] } as never);
    applyLive();
    const view = renderApp({ status: "unknown" });
    await act(async () => {});
    expect(subsApi.listMySubscriptions).not.toHaveBeenCalled();
    act(() =>
      session.set({
        idToken: "i",
        accessToken: "a",
        refreshToken: "r",
        email: EMAIL,
        sub: "s",
        idExpiresAt: Date.now() + 3_600_000,
      }),
    );
    await act(async () => {});
    expect(subsApi.listMySubscriptions).toHaveBeenCalledTimes(1);
    expect(shownFlag(view)?.state).toBe("pending");
  });

  it("a flag written through setFlag counts as checked: no GET follows it", async () => {
    vi.mocked(subsApi.listMySubscriptions).mockResolvedValue({ items: [row(5, "2026-09-01", null)] } as never);
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
    expect(subsApi.listMySubscriptions).not.toHaveBeenCalled();
    fireEvent.click(view.getByText("write"));
    await act(async () => {});
    applyLive(2);
    await act(async () => {});
    expect(subsApi.listMySubscriptions).not.toHaveBeenCalled();
    expect(shownFlag(view)?.id).toBe(9);
  });

  it("clears the flag on sign-out", async () => {
    storeFlag(FLAG);
    vi.mocked(subsApi.listMySubscriptions).mockResolvedValue({ items: [row(5, "2026-09-01", null)] } as never);
    act(() =>
      session.set({
        idToken: "i",
        accessToken: "a",
        refreshToken: "r",
        email: EMAIL,
        sub: "s",
        idExpiresAt: Date.now() + 3_600_000,
      }),
    );
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
