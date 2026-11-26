// docs/site.md section 22.1: CookieControl covers each response row from
// section 10, on the cookie dialog with its per-type steppers, and the
// dialog's order: the leaderboard views ranked live, the picking view
// ranked once per open.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { store } from "../../../../src/store/useStore";
import { initialStore } from "../../../../src/store/types";
import { CookieControl, CookieDialog } from "../../../../src/content/sections/CookieControl/CookieControl";
import * as rowStyles from "../../../../src/content/sections/CookieControl/CookieControl.module.css";
import { AuthProvider } from "../../../../src/auth/AuthProvider";
import type { AuthState } from "../../../../src/auth/AuthProvider";
import type { ContentBundle } from "../../../../src/store/types";
import { ApiRequestError } from "../../../../src/api/client";

// The test run loads no CSS, so the recipe's class names are stood in by
// their own keys.
vi.mock("../../../../src/ui/Dialog.module.css", () => ({
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

vi.mock("../../../../src/content/sections/CookieControl/CookieControl.module.css", () => ({
  cookieControl: "cookieControl",
  cookieControlClosed: "cookieControlClosed",
  cookieControlOpen: "cookieControlOpen",
  cookieControlPending: "cookieControlPending",
  cookieControlSignedOut: "cookieControlSignedOut",
  count: "count",
  countOn: "countOn",
  row: "row",
  rowIcon: "rowIcon",
  rowIconPlaceholder: "rowIconPlaceholder",
  rowLeader: "rowLeader",
  rowName: "rowName",
  rowRank: "rowRank",
  rowRanked: "rowRanked",
  rowTally: "rowTally",
  rowText: "rowText",
  rows: "rows",
  signInNotice: "signInNotice",
  stepBtn: "stepBtn",
  stepper: "stepper",
  visuallyHidden: "visuallyHidden",
}));

vi.mock("../../../../src/api/cookies", () => ({
  getMyCookies: vi.fn(),
  leaveCookies: vi.fn(),
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

function setTally(tally: Record<string, number>) {
  act(() => {
    store.setState((s) => ({
      ...s,
      live: { ...(s.live as NonNullable<(typeof s)["live"]>), cookieTally: tally },
    }));
  });
}

function setLimit(limit: number) {
  act(() => {
    store.setState((s) => ({
      ...s,
      snapshot: { ...(s.snapshot as NonNullable<(typeof s)["snapshot"]>), cookieLimitPerPerson: limit },
    }));
  });
}

// The type ids in the order the dialog lists its rows.
function rowIds(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('[data-testid="cookie-row"]')).map(
    (r) => r.getAttribute("data-cookie-type-id") ?? "",
  );
}

function renderDialog(authState: AuthState) {
  return render(
    <MemoryRouter>
      <AuthProvider initialState={authState}>
        <CookieDialog bundle={bundle} onClose={() => {}} />
      </AuthProvider>
    </MemoryRouter>,
  );
}

const THREE = [
  { id: 10, name: "Chip" },
  { id: 11, name: "Ginger" },
  { id: 12, name: "Oat" },
];

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
  vi.mocked(cookiesApi.leaveCookies).mockReset();
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
    const { getByTestId } = await openWith(5, 2, 3);
    // The counter reads what has been left for Santa, not what is unused.
    expect(getByTestId("cookie-remaining").textContent).toBe("2 of 5 left");
    expect(getByTestId("cookie-submit")).toBeDisabled();
    expect(getByTestId("cookie-type")).not.toBeDisabled();
  });

  it("puts the cookie dialog on the narrow modifier with a close X outside its scroll region", async () => {
    setLiveStatus(3);
    setCookieTypes([{ id: 10, name: "Chocolate chip" }]);
    const { getByTestId, queryByTestId } = await openWith(5, 0, 5);
    const sheet = getByTestId("cookie-sheet");
    expect(sheet.classList.contains("dialog")).toBe(true);
    expect(sheet.classList.contains("dialogNarrow")).toBe(true);
    const scroll = getByTestId("cookie-dialog-scroll");
    expect(scroll.classList.contains("scroll")).toBe(true);
    const x = getByTestId("cookie-dialog-close-x");
    expect(scroll.contains(x)).toBe(false);
    expect(scroll.contains(getByTestId("cookie-submit"))).toBe(false);
    await userEvent.click(x);
    expect(queryByTestId("cookie-sheet")).toBeNull();
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

  it("posts the whole pick in one /cookies call and updates remaining from the response", async () => {
    setLiveStatus(3);
    setCookieTypes([
      { id: 10, name: "Chip" },
      { id: 11, name: "Ginger" },
    ]);
    vi.mocked(cookiesApi.leaveCookies).mockResolvedValueOnce({
      eventId: 1,
      left: 3,
      remaining: 2,
      cookies: [
        { id: 1, cookieTypeId: 10, leftAt: "" },
        { id: 2, cookieTypeId: 10, leftAt: "" },
        { id: 3, cookieTypeId: 11, leftAt: "" },
      ],
    } as never);
    const { getAllByTestId, getByTestId } = await openWith(5, 0, 5);
    const plus = getAllByTestId("cookie-type");
    await userEvent.click(plus[0]);
    await userEvent.click(plus[0]);
    await userEvent.click(plus[1]);
    await userEvent.click(getByTestId("cookie-submit"));
    await waitFor(() => expect(getByTestId("cookie-remaining").textContent).toBe("3 of 5 left"));
    expect(getByTestId("cookie-confirmation").textContent).toContain("3 cookies");
    expect(cookiesApi.leaveCookies).toHaveBeenCalledTimes(1);
    expect(cookiesApi.leaveCookies).toHaveBeenCalledWith({
      items: [
        { cookieTypeId: 10, count: 2 },
        { cookieTypeId: 11, count: 1 },
      ],
      note: null,
    });
  });

  it("handles 409 cookie_limit_reached: remaining=0, the all-left view with fixed copy (not server message)", async () => {
    setLiveStatus(3);
    setCookieTypes([{ id: 10, name: "Chocolate chip" }]);
    vi.mocked(cookiesApi.leaveCookies).mockRejectedValueOnce(
      new ApiRequestError(409, { code: "cookie_limit_reached", message: "server text should be ignored", details: null, requestId: "r" }, null),
    );
    const { getByTestId, queryByTestId, queryByText } = await openWith(3, 3, 1);
    await userEvent.click(getByTestId("cookie-type"));
    await userEvent.click(getByTestId("cookie-submit"));
    await waitFor(() => expect(getByTestId("cookie-remaining").textContent).toBe("3 of 3 left"));
    expect(getByTestId("cookie-all-left").textContent).toMatch(/all your cookies/);
    expect(queryByTestId("cookie-error")).toBeNull();
    expect(queryByTestId("cookie-submit")).toBeNull();
    expect(queryByText(/server text should be ignored/)).toBeNull();
  });

  it("handles 409 cookie_limit_reached with details.remaining by keeping the dialog open for a smaller pick", async () => {
    setLiveStatus(3);
    setCookieTypes([{ id: 10, name: "Chocolate chip" }]);
    vi.mocked(cookiesApi.leaveCookies).mockRejectedValueOnce(
      new ApiRequestError(409, { code: "cookie_limit_reached", message: "x", details: { remaining: 2 }, requestId: "r" }, null),
    );
    const { getByTestId } = await openWith(10, 5, 5);
    await userEvent.click(getByTestId("cookie-type"));
    await userEvent.click(getByTestId("cookie-type"));
    await userEvent.click(getByTestId("cookie-type"));
    await userEvent.click(getByTestId("cookie-submit"));
    await waitFor(() => expect(getByTestId("cookie-remaining").textContent).toBe("8 of 10 left"));
    expect(getByTestId("cookie-error").textContent).toMatch(/only have 2 cookies left/);
    expect(getByTestId("cookie-count").textContent).toBe("0");
    expect(getByTestId("cookie-type")).not.toBeDisabled();
  });

  it("handles 409 no_live_event by closing the dialog", async () => {
    setLiveStatus(3);
    setCookieTypes([{ id: 10, name: "Chocolate chip" }]);
    vi.mocked(cookiesApi.leaveCookies).mockRejectedValueOnce(
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
    vi.mocked(cookiesApi.leaveCookies).mockRejectedValueOnce(
      new ApiRequestError(404, { code: "not_found", message: "x", details: { cookieTypeIds: [10] }, requestId: "r" }, null),
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
    vi.mocked(cookiesApi.leaveCookies).mockRejectedValueOnce(
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
    vi.mocked(cookiesApi.leaveCookies).mockRejectedValueOnce(
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

  it("has no note box; with cookies left there is no all-left line", async () => {
    setLiveStatus(3);
    setCookieTypes([{ id: 10, name: "Chip" }]);
    const { container, queryByTestId } = await openWith(3, 0, 3);
    expect(container.querySelector("textarea")).toBeNull();
    expect(queryByTestId("cookie-note-counter")).toBeNull();
    expect(queryByTestId("cookie-all-left")).toBeNull();
  });

  it("at remaining 0 on load shows the ranked leaderboard, no steppers, the all-left line last, and Close alone", async () => {
    setLiveStatus(3);
    setCookieTypes(THREE);
    setTally({ "11": 4, "12": 9 });
    const { container, getByTestId, queryAllByTestId } = await openWith(3, 3, 0);
    expect(getByTestId("cookie-remaining").textContent).toBe("3 of 3 left");
    expect(rowIds(container)).toEqual(["12", "11", "10"]);
    expect(queryAllByTestId("cookie-type")).toHaveLength(0);
    expect(queryAllByTestId("cookie-minus")).toHaveLength(0);
    const scroll = getByTestId("cookie-dialog-scroll");
    expect(scroll.lastElementChild).toBe(getByTestId("cookie-all-left"));
    expect(getByTestId("cookie-all-left").textContent).toBe("You have left all your cookies for this year");
    const actions = container.querySelector(".actions") as HTMLElement;
    expect(Array.from(actions.querySelectorAll("button")).map((b) => b.textContent)).toEqual(["Close"]);
  });

  it("shows the all-left line after a submit uses the last cookie", async () => {
    setLiveStatus(3);
    setCookieTypes([{ id: 10, name: "Chip" }]);
    vi.mocked(cookiesApi.leaveCookies).mockResolvedValueOnce({ eventId: 1, left: 1, remaining: 0, cookies: [] } as never);
    const { getByTestId, findByTestId, queryByTestId } = await openWith(1, 0, 1);
    await userEvent.click(getByTestId("cookie-type"));
    await userEvent.click(getByTestId("cookie-submit"));
    expect((await findByTestId("cookie-all-left")).textContent).toBe("You have left all your cookies for this year");
    expect(vi.mocked(cookiesApi.leaveCookies).mock.calls[0][0]).toMatchObject({ note: null });
    // The leaderboard view: no steppers, the thanks above the all-left line,
    // which is last, and Close alone.
    expect(queryByTestId("cookie-type")).toBeNull();
    expect(getByTestId("cookie-row-rank").textContent).toBe("1");
    const scroll = getByTestId("cookie-dialog-scroll");
    const confirmation = getByTestId("cookie-confirmation");
    expect(confirmation.nextElementSibling).toBe(getByTestId("cookie-all-left"));
    expect(scroll.lastElementChild).toBe(getByTestId("cookie-all-left"));
    expect(queryByTestId("cookie-submit")).toBeNull();
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
    vi.mocked(cookiesApi.leaveCookies).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const { getByTestId, queryByText } = await openWith(3, 0, 3);
    await userEvent.click(getByTestId("cookie-type"));
    await userEvent.click(getByTestId("cookie-submit"));
    await waitFor(() => expect(getByTestId("cookie-error")).toBeInTheDocument());
    expect(queryByText(/Failed to fetch/)).toBeNull();
  });

  it("at a per-person limit of 0 renders the closed line in place of its button and fetches nothing", async () => {
    setLiveStatus(3);
    setCookieTypes([{ id: 10, name: "Chip" }]);
    act(() => {
      store.setState((s) => ({
        ...s,
        snapshot: { ...(s.snapshot as NonNullable<(typeof s)["snapshot"]>), cookieLimitPerPerson: 0 },
      }));
    });
    for (const auth of [signedIn, { status: "signedOut" } as AuthState]) {
      const { getByTestId, queryByTestId, queryByRole, unmount } = renderWith(auth);
      expect(getByTestId("cookie-control-closed").textContent).toBe("Cookies are closed for now");
      expect(queryByTestId("cookie-control-open")).toBeNull();
      expect(queryByRole("button")).toBeNull();
      expect(queryByTestId("cookie-sheet")).toBeNull();
      unmount();
    }
    expect(cookiesApi.getMyCookies).not.toHaveBeenCalled();
  });
});

describe("the cookie dialog's order", () => {
  it("signed out lists the types by rankCookieTypes and reorders on a new tally", () => {
    setLiveStatus(3);
    setCookieTypes(THREE);
    setTally({ "10": 1, "12": 5 });
    const { container, getAllByTestId } = renderDialog({ status: "signedOut" });
    expect(rowIds(container)).toEqual(["12", "10", "11"]);
    expect(getAllByTestId("cookie-row-rank").map((r) => r.textContent)).toEqual(["1", "2", "3"]);
    setTally({ "10": 1, "11": 8, "12": 5 });
    expect(rowIds(container)).toEqual(["11", "12", "10"]);
  });

  it("ties fall back to sort then id", () => {
    setLiveStatus(3);
    setCookieTypes(THREE);
    setTally({});
    const { container } = renderDialog({ status: "signedOut" });
    expect(rowIds(container)).toEqual(["10", "11", "12"]);
  });

  it("tints the leader and gives it rank 1; no other row is tinted", () => {
    setLiveStatus(3);
    setCookieTypes(THREE);
    setTally({ "11": 3 });
    const { getAllByTestId } = renderDialog({ status: "signedOut" });
    const rows = getAllByTestId("cookie-row");
    expect(rows[0].className.split(" ")).toContain(rowStyles.rowLeader);
    expect(rows[0].querySelector('[data-testid="cookie-row-rank"]')?.textContent).toBe("1");
    expect(rows[0].getAttribute("data-cookie-type-id")).toBe("11");
    for (const r of rows.slice(1)) expect(r.className.split(" ")).not.toContain(rowStyles.rowLeader);
    // The rank comes before the icon.
    expect(rows[0].firstElementChild?.getAttribute("data-testid")).toBe("cookie-row-rank");
  });

  it("the picking view is ranked at open and keeps its order after a tally change and a submit with cookies left", async () => {
    setLiveStatus(3);
    setCookieTypes(THREE);
    setTally({ "11": 2, "12": 1 });
    vi.mocked(cookiesApi.leaveCookies).mockResolvedValueOnce({ eventId: 1, left: 1, remaining: 4, cookies: [] } as never);
    const { container, getAllByTestId, getByTestId, queryByTestId } = await openWith(5, 0, 5);
    expect(rowIds(container)).toEqual(["11", "12", "10"]);
    // No rank numbers or leader tint while picking.
    expect(queryByTestId("cookie-row-rank")).toBeNull();
    for (const r of getAllByTestId("cookie-row")) expect(r.className.split(" ")).not.toContain(rowStyles.rowLeader);
    setTally({ "10": 9, "11": 2, "12": 1 });
    expect(rowIds(container)).toEqual(["11", "12", "10"]);
    // The counts under the names still follow the live tally.
    expect(getAllByTestId("cookie-row-tally")[2].textContent).toContain("9");
    await userEvent.click(getAllByTestId("cookie-type")[0]);
    await userEvent.click(getByTestId("cookie-submit"));
    await waitFor(() => expect(getByTestId("cookie-remaining").textContent).toBe("1 of 5 left"));
    setTally({ "10": 9, "11": 3, "12": 20 });
    expect(rowIds(container)).toEqual(["11", "12", "10"]);
    expect(getAllByTestId("cookie-type")).toHaveLength(3);
  });

  it("the picking view puts a type it did not hold at the end and skips a held type that is gone", async () => {
    setLiveStatus(3);
    setCookieTypes([
      { id: 10, name: "Chip" },
      { id: 11, name: "Ginger" },
    ]);
    setTally({ "11": 2 });
    const { container } = await openWith(5, 0, 5);
    expect(rowIds(container)).toEqual(["11", "10"]);
    setTally({ "11": 2, "13": 50, "12": 1 });
    setCookieTypes([
      { id: 11, name: "Ginger" },
      { id: 12, name: "Oat" },
      { id: 13, name: "Shortbread" },
    ]);
    expect(rowIds(container)).toEqual(["11", "13", "12"]);
  });

  it("reopening the dialog ranks afresh", async () => {
    setLiveStatus(3);
    setCookieTypes(THREE);
    setTally({ "10": 5 });
    const utils = await openWith(5, 0, 5);
    expect(rowIds(utils.container)).toEqual(["10", "11", "12"]);
    setTally({ "10": 5, "12": 7 });
    expect(rowIds(utils.container)).toEqual(["10", "11", "12"]);
    await userEvent.click(utils.getByTestId("cookie-dialog-close-x"));
    expect(utils.queryByTestId("cookie-sheet")).toBeNull();
    vi.mocked(cookiesApi.getMyCookies).mockResolvedValueOnce({ limit: 5, used: 0, remaining: 5, items: [] } as never);
    await userEvent.click(utils.getByTestId("cookie-control-open"));
    await utils.findByTestId("cookie-remaining");
    expect(rowIds(utils.container)).toEqual(["12", "10", "11"]);
  });

  it("the all-left view re-ranks live", async () => {
    setLiveStatus(3);
    setCookieTypes(THREE);
    setTally({ "10": 2 });
    const { container } = await openWith(3, 3, 0);
    expect(rowIds(container)).toEqual(["10", "11", "12"]);
    setTally({ "10": 2, "12": 3 });
    expect(rowIds(container)).toEqual(["12", "10", "11"]);
  });

  it("closed while open shows the ranked rows with the closed line, live, and Close", async () => {
    setLiveStatus(3);
    setCookieTypes(THREE);
    setTally({ "11": 1 });
    vi.mocked(cookiesApi.getMyCookies).mockResolvedValueOnce({ limit: 5, used: 0, remaining: 5, items: [] } as never);
    const { container, getByTestId, getAllByTestId, queryByTestId, findByTestId } = renderDialog(signedIn);
    await findByTestId("cookie-remaining");
    setLimit(0);
    expect(getByTestId("cookie-dialog-closed").textContent).toBe("Cookies are closed for now");
    expect(rowIds(container)).toEqual(["11", "10", "12"]);
    expect(getAllByTestId("cookie-row-rank")).toHaveLength(3);
    expect(queryByTestId("cookie-type")).toBeNull();
    setTally({ "11": 1, "12": 4 });
    expect(rowIds(container)).toEqual(["12", "11", "10"]);
    const actions = container.querySelector(".actions") as HTMLElement;
    expect(Array.from(actions.querySelectorAll("button")).map((b) => b.textContent)).toEqual(["Close"]);
  });

  describe("row movement", () => {
    // jsdom has no layout: each row's top is its index times 48.
    const desc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetTop");
    beforeEach(() => {
      Object.defineProperty(HTMLElement.prototype, "offsetTop", {
        configurable: true,
        get(this: HTMLElement) {
          const parent = this.parentElement;
          return parent === null ? 0 : Array.from(parent.children).indexOf(this) * 48;
        },
      });
    });
    afterEach(() => {
      if (desc) Object.defineProperty(HTMLElement.prototype, "offsetTop", desc);
    });

    it("a reorder in a live view slides the moved rows over 300 ms", () => {
      setLiveStatus(3);
      setCookieTypes(THREE);
      setTally({});
      const { getAllByTestId } = renderDialog({ status: "signedOut" });
      for (const r of getAllByTestId("cookie-row")) expect(r.style.transition).toBe("");
      setTally({ "12": 3 });
      const rows = getAllByTestId("cookie-row");
      expect(rows[0].getAttribute("data-cookie-type-id")).toBe("12");
      for (const r of rows) {
        expect(r.style.transition).toBe("transform 300ms ease");
        expect(r.style.transform).toBe("");
      }
    });

    it("the picking view never moves a row", async () => {
      setLiveStatus(3);
      setCookieTypes(THREE);
      setTally({});
      const { getAllByTestId } = await openWith(5, 0, 5);
      setTally({ "12": 3 });
      for (const r of getAllByTestId("cookie-row")) {
        expect(r.style.transition).toBe("");
        expect(r.style.transform).toBe("");
      }
    });
  });
});
