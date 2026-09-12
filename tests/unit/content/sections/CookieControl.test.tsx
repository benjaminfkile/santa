// docs/site.md section 22.1: CookieControl covers each response row from
// section 10, on the cookie dialog with its per-type steppers.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { store } from "../../../../src/store/useStore";
import { initialStore } from "../../../../src/store/types";
import { CookieControl } from "../../../../src/content/sections/CookieControl/CookieControl";
import { AuthProvider } from "../../../../src/auth/AuthProvider";
import type { AuthState } from "../../../../src/auth/AuthProvider";
import type { ContentBundle } from "../../../../src/store/types";
import { ApiRequestError } from "../../../../src/api/client";

vi.mock("../../../../src/api/cookies", () => ({
  getMyCookies: vi.fn(),
  leaveCookie: vi.fn(),
}));

import * as cookiesApi from "../../../../src/api/cookies";

const bundle: ContentBundle = {
  content: null as unknown as ContentBundle["content"],
  media: {},
  icons: {},
};

function setLiveStatus(id: number | null) {
  act(() => {
    store.setState((s) => ({
      ...s,
      live: id === null
        ? null
        : {
            schemaVersion: 1,
            eventId: 1,
            eventStatusId: id,
            pollIntervalMs: 5000,
            snapshotUrl: null,
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
            publishedAt: "2024-12-24T00:00:00Z",
          },
    }));
  });
}

function setCookieTypes(types: Array<{ id: number; name: string }>) {
  act(() => {
    store.setState((s) => ({
      ...s,
      snapshot: {
        schemaVersion: 1,
        content: null,
        media: {},
        icons: {},
        event: null,
        cookieTypes: types.map((t) => ({ ...t, sort: t.id, icon: null, active: true })),
      } as unknown as (typeof s)["snapshot"],
    }));
  });
}

function renderWith(authState: AuthState) {
  const data = {
    heading: "Leave a cookie",
    copy: "copy",
    signedOutCopy: "Sign in to leave a cookie.",
    closedCopy: "Event closed.",
  };
  return render(
    <MemoryRouter>
      <AuthProvider initialState={authState}>
        <CookieControl data={data} items={[]} bundle={bundle} />
      </AuthProvider>
    </MemoryRouter>,
  );
}

const signedIn: AuthState = { status: "signedIn", email: "p@e", expired: false };

async function openWith(limit: number, used: number, remaining: number) {
  vi.mocked(cookiesApi.getMyCookies).mockResolvedValueOnce({ limit, used, remaining, items: [] } as never);
  const utils = renderWith(signedIn);
  await userEvent.click(utils.getByTestId("cookie-control-open"));
  await utils.findByTestId("cookie-remaining");
  return utils;
}

beforeEach(() => {
  act(() => store.setState({ ...initialStore }));
  vi.mocked(cookiesApi.getMyCookies).mockReset();
  vi.mocked(cookiesApi.leaveCookie).mockReset();
});

afterEach(() => {
  cleanup();
  act(() => store.setState({ ...initialStore }));
});

describe("CookieControl", () => {
  it("renders closedCopy when status is not 3", () => {
    setLiveStatus(1);
    const { container } = renderWith(signedIn);
    expect(container.textContent).toContain("Event closed.");
  });

  it("renders signedOutCopy and a sign-in button while status is 3 and signed out", () => {
    setLiveStatus(3);
    const { container } = renderWith({ status: "signedOut" });
    expect(container.textContent).toContain("Sign in to leave a cookie.");
    expect(container.querySelector("button")?.textContent).toBe("Sign in");
  });

  it("opens the dialog, fetches /me/cookies, shows remaining, and disables submit while nothing is picked", async () => {
    setLiveStatus(3);
    setCookieTypes([{ id: 10, name: "Chocolate chip" }]);
    const { getByTestId } = await openWith(5, 5, 0);
    expect(getByTestId("cookie-remaining").textContent).toBe("0 of 5 left");
    expect(getByTestId("cookie-submit")).toBeDisabled();
    // Nothing can be added when nothing is left.
    expect(getByTestId("cookie-type")).toBeDisabled();
  });

  it("caps the picks at the remaining allowance across every type", async () => {
    setLiveStatus(3);
    setCookieTypes([
      { id: 10, name: "Chip" },
      { id: 11, name: "Ginger" },
    ]);
    const { getAllByTestId, getByTestId } = await openWith(10, 8, 2);
    const plus = getAllByTestId("cookie-type");
    await userEvent.click(plus[0]);
    await userEvent.click(plus[0]);
    await userEvent.click(plus[0]);
    const counts = getAllByTestId("cookie-count").map((c) => c.textContent);
    expect(counts).toEqual(["2", "0"]);
    expect(plus[1]).toBeDisabled();
    expect(getByTestId("cookie-submit").textContent).toBe("Leave 2 cookies");
  });

  it("posts one /cookies call per cookie picked and updates remaining from the last response", async () => {
    setLiveStatus(3);
    setCookieTypes([
      { id: 10, name: "Chip" },
      { id: 11, name: "Ginger" },
    ]);
    vi.mocked(cookiesApi.leaveCookie)
      .mockResolvedValueOnce({ id: 1, eventId: 1, cookieTypeId: 10, note: null, leftAt: "", remaining: 4 } as never)
      .mockResolvedValueOnce({ id: 2, eventId: 1, cookieTypeId: 10, note: null, leftAt: "", remaining: 3 } as never)
      .mockResolvedValueOnce({ id: 3, eventId: 1, cookieTypeId: 11, note: null, leftAt: "", remaining: 2 } as never);
    const { getAllByTestId, getByTestId } = await openWith(5, 0, 5);
    const plus = getAllByTestId("cookie-type");
    await userEvent.click(plus[0]);
    await userEvent.click(plus[0]);
    await userEvent.click(plus[1]);
    await userEvent.click(getByTestId("cookie-submit"));
    await waitFor(() => expect(getByTestId("cookie-remaining").textContent).toBe("2 of 5 left"));
    expect(getByTestId("cookie-confirmation").textContent).toContain("3 cookies");
    expect(cookiesApi.leaveCookie).toHaveBeenCalledTimes(3);
    expect(cookiesApi.leaveCookie).toHaveBeenNthCalledWith(1, { cookieTypeId: 10, note: null });
    expect(cookiesApi.leaveCookie).toHaveBeenNthCalledWith(3, { cookieTypeId: 11, note: null });
  });

  it("handles 409 cookie_limit_reached: remaining=0, disables submit, shows fixed copy (not server message)", async () => {
    setLiveStatus(3);
    setCookieTypes([{ id: 10, name: "Chocolate chip" }]);
    vi.mocked(cookiesApi.leaveCookie).mockRejectedValueOnce(
      new ApiRequestError(409, { code: "cookie_limit_reached", message: "server text should be ignored", details: null, requestId: "r" }, null),
    );
    const { getByTestId, queryByText } = await openWith(3, 3, 1);
    await userEvent.click(getByTestId("cookie-type"));
    await userEvent.click(getByTestId("cookie-submit"));
    await waitFor(() => expect(getByTestId("cookie-remaining").textContent).toBe("0 of 3 left"));
    expect(getByTestId("cookie-error").textContent).toMatch(/all your cookies/);
    expect(getByTestId("cookie-submit")).toBeDisabled();
    expect(queryByText(/server text should be ignored/)).toBeNull();
  });

  it("handles 409 no_live_event by closing the dialog", async () => {
    setLiveStatus(3);
    setCookieTypes([{ id: 10, name: "Chocolate chip" }]);
    vi.mocked(cookiesApi.leaveCookie).mockRejectedValueOnce(
      new ApiRequestError(409, { code: "no_live_event", message: "x", details: null, requestId: "r" }, null),
    );
    const { getByTestId, queryByTestId } = await openWith(3, 0, 3);
    await userEvent.click(getByTestId("cookie-type"));
    await userEvent.click(getByTestId("cookie-submit"));
    await waitFor(() => expect(queryByTestId("cookie-sheet")).toBeNull());
  });

  it("handles 404 not_found by refreshing the picker and dropping that pick", async () => {
    setLiveStatus(3);
    setCookieTypes([{ id: 10, name: "Old" }]);
    vi.mocked(cookiesApi.leaveCookie).mockRejectedValueOnce(
      new ApiRequestError(404, { code: "not_found", message: "x", details: null, requestId: "r" }, null),
    );
    const { getByTestId } = await openWith(3, 0, 3);
    await userEvent.click(getByTestId("cookie-type"));
    await userEvent.click(getByTestId("cookie-submit"));
    await waitFor(() => expect(getByTestId("cookie-error").textContent).toMatch(/no longer active/));
    expect(getByTestId("cookie-count").textContent).toBe("0");
    expect(getByTestId("cookie-submit")).toBeDisabled();
  });

  it("handles 429 rate_limited by showing a wait message and disabling submit", async () => {
    setLiveStatus(3);
    setCookieTypes([{ id: 10, name: "Chip" }]);
    vi.mocked(cookiesApi.leaveCookie).mockRejectedValueOnce(
      new ApiRequestError(429, { code: "rate_limited", message: "x", details: { retryAfterSeconds: 5 }, requestId: "r" }, 5),
    );
    const { getByTestId } = await openWith(3, 0, 3);
    await userEvent.click(getByTestId("cookie-type"));
    await userEvent.click(getByTestId("cookie-submit"));
    await waitFor(() => expect(getByTestId("cookie-error").textContent).toMatch(/Try again in/));
    expect(getByTestId("cookie-submit")).toBeDisabled();
  });

  it("handles 400 validation_failed by showing the note field error", async () => {
    setLiveStatus(3);
    setCookieTypes([{ id: 10, name: "Chip" }]);
    vi.mocked(cookiesApi.leaveCookie).mockRejectedValueOnce(
      new ApiRequestError(400, {
        code: "validation_failed",
        message: "x",
        details: { fields: { note: "Too long." } },
        requestId: "r",
      }, null),
    );
    const { getByTestId, container } = await openWith(3, 0, 3);
    await userEvent.click(getByTestId("cookie-type"));
    await userEvent.click(getByTestId("cookie-submit"));
    await waitFor(() => expect(container.querySelector("#cookie-note-error")?.textContent).toBe("Too long."));
  });

  it("exposes cookie-type on each cookie type's add button in the dialog", async () => {
    setLiveStatus(3);
    setCookieTypes([
      { id: 10, name: "Chip" },
      { id: 11, name: "Ginger" },
    ]);
    const { getAllByTestId } = await openWith(3, 0, 3);
    expect(getAllByTestId("cookie-type").length).toBe(2);
    expect(getAllByTestId("cookie-row").length).toBe(2);
  });

  it("network/5xx shows generic copy and never renders body.message", async () => {
    setLiveStatus(3);
    setCookieTypes([{ id: 10, name: "Chip" }]);
    vi.mocked(cookiesApi.leaveCookie).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const { getByTestId, queryByText } = await openWith(3, 0, 3);
    await userEvent.click(getByTestId("cookie-type"));
    await userEvent.click(getByTestId("cookie-submit"));
    await waitFor(() => expect(getByTestId("cookie-error")).toBeInTheDocument());
    expect(queryByText(/Failed to fetch/)).toBeNull();
  });
});
