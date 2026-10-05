// docs/site.md sections 7.6, 9, and 10. The live screen's cookie tally: a
// bare right-aligned column of count-then-icon rows ranked by count, the
// leave-a-cookie glyph under it, and the cookie dialog it opens, signed
// out and signed in.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { store } from "../../../../src/store/useStore";
import { initialStore } from "../../../../src/store/types";
import type { ContentBundle } from "../../../../src/store/types";
import type { LiveObject, Snapshot } from "../../../../src/contracts";
import { AuthProvider } from "../../../../src/auth/AuthProvider";
import type { AuthState } from "../../../../src/auth/AuthProvider";
import { CookieTally } from "../../../../src/content/sections/Map/CookieTally";
import { resetTrackerTogglesForTests } from "../../../../src/content/sections/Map/trackerToggles";
import { CookieDialog } from "../../../../src/content/sections/CookieControl/CookieControl";
import * as mapStyles from "../../../../src/content/sections/Map/Map.module.css";

vi.mock("../../../../src/api/cookies", () => ({
  getMyCookies: vi.fn(),
  leaveCookies: vi.fn(),
}));

// CSS processing is off in unit tests, so the Map module's classes map to
// their own names here; the rules themselves are read from the file.
vi.mock("../../../../src/content/sections/Map/Map.module.css", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const css = readFileSync(resolve(__dirname, "../../../../src/content/sections/Map/Map.module.css"), "utf8");
  const names = new Set(Array.from(css.matchAll(/\.([a-zA-Z][a-zA-Z0-9]*)/g), (m) => m[1]));
  return Object.fromEntries(Array.from(names, (n) => [n, n]));
});

vi.mock("../../../../src/map/MapView", () => ({
  MapView: (props: {
    children?: (state: { controller: unknown; error: unknown; retry: () => void }) => unknown;
  }) => (
    <div>
      {typeof props.children === "function"
        ? (props.children({ controller: null, error: null, retry: () => {} }) as React.ReactNode)
        : null}
    </div>
  ),
}));

import * as cookiesApi from "../../../../src/api/cookies";

const bundle: ContentBundle = {
  content: null as unknown as ContentBundle["content"],
  media: {},
  icons: {},
};

const TYPES: NonNullable<Snapshot["cookieTypes"]> = [
  { id: 1, name: "Chip", icon: null, sort: 10 },
  { id: 2, name: "Ginger", icon: null, sort: 20 },
  { id: 3, name: "Sugar", icon: { source: "library", id: "no-such-icon" }, sort: 30 },
];

function setState(tally: LiveObject["cookieTally"], eventStatusId = 3) {
  act(() =>
    store.setState({
      snapshot: { schemaVersion: 1, cookieTypes: TYPES } as Snapshot,
      live: {
        schemaVersion: 1,
        publishedAt: "",
        eventStatusId,
        cookieTally: tally,
      } as LiveObject,
    }),
  );
}

function names(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('[data-testid="cookie-tally-row"]')).map(
    (r) => r.getAttribute("title") ?? "",
  );
}

const signedIn: AuthState = { status: "signedIn", email: "p@e", expired: false };

async function renderMap(overlays: Record<string, boolean>, auth: AuthState = { status: "signedOut" }) {
  const { Map } = await import("../../../../src/content/sections/Map/Map");
  return render(
    <MemoryRouter>
      <AuthProvider initialState={auth}>
        <Map data={{ overlays }} items={[]} bundle={bundle} />
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  // The tally's collapse choice lives in a module, so it leaks between tests.
  resetTrackerTogglesForTests();
  act(() => store.setState({ ...initialStore }));
  vi.mocked(cookiesApi.getMyCookies).mockReset();
  vi.mocked(cookiesApi.leaveCookies).mockReset();
});

afterEach(() => {
  cleanup();
  resetTrackerTogglesForTests();
  act(() => store.setState({ ...initialStore }));
});

describe("CookieTally", () => {
  it("ranks by count with a zero type last, and a count change reorders the rows", () => {
    setState({ "2": 4, "3": 1 });
    const { container } = render(<CookieTally bundle={bundle} />);
    expect(names(container)).toEqual(["Ginger", "Sugar", "Chip"]);
    const counts = Array.from(container.querySelectorAll('[data-testid="cookie-tally-row"]')).map(
      (r) => r.getAttribute("data-count"),
    );
    expect(counts).toEqual(["4", "1", "0"]);

    setState({ "1": 9, "2": 4, "3": 1 });
    expect(names(container)).toEqual(["Chip", "Ginger", "Sugar"]);
    expect(container.querySelector('[data-testid="cookie-tally-row"]')?.getAttribute("data-count")).toBe("9");
  });

  it("puts the count before the icon, right-aligned rows, the placeholder for an unresolved icon", () => {
    setState({ "1": 12 });
    const { container } = render(<CookieTally bundle={bundle} />);
    const rows = container.querySelectorAll('[data-testid="cookie-tally-row"]');
    expect(rows.length).toBe(3);
    for (const row of Array.from(rows)) {
      expect(row.className).toContain(mapStyles.cookieTallyRow);
      const children = Array.from(row.children);
      expect(children[0].getAttribute("data-testid")).toBe("leaderboard-count");
      expect(children[1].getAttribute("data-testid")).toBe("cookie-tally-icon");
      expect(children[1].className).toContain(mapStyles.cookieTallyPlaceholder);
    }
    expect(rows[0].textContent).toContain("12");
  });

  it("has no glass box and no header, and its only control is the collapse chevron", () => {
    setState({ "1": 1 });
    const { container } = render(<CookieTally bundle={bundle} />);
    expect(container.querySelector(`.${mapStyles.glass}`)).toBeNull();
    for (const el of Array.from(container.querySelectorAll("*"))) {
      expect(el.className.toString().split(" ")).not.toContain(mapStyles.glass);
    }
    const buttons = Array.from(container.querySelectorAll("button"));
    expect(buttons).toHaveLength(1);
    expect(buttons[0].getAttribute("data-testid")).toBe("cookie-tally-toggle");
    expect(container.textContent).not.toContain("Cookies");
  });

  it("the chevron folds the counts away and brings them back, and the choice survives a remount", () => {
    setState({ "1": 1 });
    const view = render(<CookieTally bundle={bundle} />);
    const toggle = () => view.getByTestId("cookie-tally-toggle");
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    expect(view.queryByTestId("cookie-tally")).not.toBeNull();

    fireEvent.click(toggle());
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    // Collapsed: no counts, no rows, and the chevron is still reachable.
    expect(view.queryByTestId("cookie-tally")).toBeNull();
    expect(view.queryAllByTestId("cookie-tally-row")).toHaveLength(0);
    expect(toggle().getAttribute("aria-label")).toBe("Show the cookie counts");

    // A remount (a live flip, the unavailable panel's retry) keeps the choice.
    view.unmount();
    const again = render(<CookieTally bundle={bundle} />);
    expect(again.getByTestId("cookie-tally-toggle").getAttribute("aria-expanded")).toBe("false");
    expect(again.queryByTestId("cookie-tally")).toBeNull();

    fireEvent.click(again.getByTestId("cookie-tally-toggle"));
    expect(again.queryByTestId("cookie-tally")).not.toBeNull();
    expect(again.getByTestId("cookie-tally-toggle").getAttribute("aria-label")).toBe("Hide the cookie counts");
  });

  it("the column's rules draw no box and carry the shadows and tabular digits", () => {
    const css = readFileSync(resolve(__dirname, "../../../../src/content/sections/Map/Map.module.css"), "utf8");
    const rule = (name: string) => css.match(new RegExp(`\\.${name} \\{([^}]*)\\}`))?.[1] ?? "";
    for (const name of ["cookieTally", "cookieTallyRow", "cookieTallyCount", "cookieTallyIcon", "cookieLeave"]) {
      const body = rule(name);
      expect(body).not.toBe("");
      expect(body).not.toMatch(/composes|background:(?!\s*transparent)|border:(?!\s*0;)|box-shadow/);
    }
    expect(rule("cookieTallyRow")).toMatch(/justify-content: flex-end/);
    expect(rule("cookieTallyRow")).toMatch(/gap: 5px/);
    expect(rule("cookieTallyCount")).toContain("text-shadow: 0 0 2px var(--panel), 0 0 5px var(--panel), 0 0 9px var(--panel)");
    expect(rule("cookieTallyCount")).toMatch(/tabular-nums/);
    expect(rule("cookieTallyIcon")).toMatch(/drop-shadow\([^)]*var\(--panel\)\)/);
    expect(rule("cookieLeave")).toMatch(/width: 44px/);
  });

  it("renders nothing without cookie types", () => {
    act(() => store.setState({ snapshot: { schemaVersion: 1, cookieTypes: [] } as Snapshot }));
    const { container } = render(<CookieTally bundle={bundle} />);
    expect(container.querySelector('[data-testid="cookie-tally"]')).toBeNull();
  });
});

describe("the tally and the leave glyph on the live screen", () => {
  it("shows the column and the glyph while live with both flags on; no bottom-left pill", async () => {
    setState({ "1": 2 });
    const utils = await renderMap({ leaderboardPanel: true, cookieControl: true });
    expect(utils.getByTestId("cookie-tally")).toBeInTheDocument();
    const leave = utils.getByTestId("cookie-tally-leave");
    // Signed out, so the label says what the press actually does.
    expect(leave.getAttribute("aria-label")).toBe("Sign in to leave cookies");
    expect(leave.querySelector("svg")?.getAttribute("width")).toBe("26");
    expect(utils.queryByTestId("cookie-control-sign-in")).toBeNull();
    expect(utils.queryByTestId("cookie-control-open")).toBeNull();
    expect(utils.queryByText("Sign in to leave cookies")).toBeNull();
  });

  it("the flags off remove the column and the glyph", async () => {
    setState({ "1": 2 });
    const utils = await renderMap({ leaderboardPanel: false, cookieControl: false });
    expect(utils.queryByTestId("cookie-tally")).toBeNull();
    expect(utils.queryByTestId("cookie-tally-leave")).toBeNull();
  });

  it("the glyph is absent outside status 3", async () => {
    setState({ "1": 2 }, 2);
    const utils = await renderMap({ leaderboardPanel: true, cookieControl: true });
    expect(utils.getByTestId("cookie-tally")).toBeInTheDocument();
    expect(utils.queryByTestId("cookie-tally-leave")).toBeNull();
  });

  it("the tally and the glyph hide while the tracker menu is open", async () => {
    setState({ "1": 2 });
    const utils = await renderMap({ leaderboardPanel: true, cookieControl: true });
    fireEvent.click(utils.container.querySelector('button[aria-label="Tracker menu"]')!);
    expect(utils.queryByTestId("cookie-tally")).toBeNull();
    expect(utils.queryByTestId("cookie-tally-leave")).toBeNull();
  });

  it("the glyph opens the dialog; signed out it shows the sign-in body and never calls GET /me/cookies", async () => {
    setState({ "1": 2 });
    const utils = await renderMap({ leaderboardPanel: true, cookieControl: true });
    fireEvent.click(utils.getByTestId("cookie-tally-leave"));
    expect(utils.getByTestId("cookie-sheet")).toBeInTheDocument();
    expect(utils.getByTestId("cookie-dialog-signed-out").textContent).toBe("Sign in to leave cookies");
    expect(utils.getByTestId("cookie-dialog-sign-in").textContent).toBe("Sign in");
    expect(utils.getByText("Close")).toBeInTheDocument();
    expect(cookiesApi.getMyCookies).not.toHaveBeenCalled();
    fireEvent.click(utils.getByText("Close"));
    expect(utils.queryByTestId("cookie-sheet")).toBeNull();
    expect(cookiesApi.getMyCookies).not.toHaveBeenCalled();
  });

  it("signed in the glyph opens the dialog and loads as before", async () => {
    setState({ "1": 2 });
    vi.mocked(cookiesApi.getMyCookies).mockResolvedValueOnce({ limit: 5, used: 1, remaining: 4, items: [] } as never);
    const utils = await renderMap({ leaderboardPanel: true, cookieControl: true }, signedIn);
    fireEvent.click(utils.getByTestId("cookie-tally-leave"));
    await waitFor(() => expect(utils.getByTestId("cookie-remaining").textContent).toBe("1 of 5 left"));
    expect(cookiesApi.getMyCookies).toHaveBeenCalledTimes(1);
    expect(utils.getAllByTestId("cookie-row").length).toBe(3);
    expect(utils.queryByTestId("cookie-dialog-signed-out")).toBeNull();
  });
});

describe("CookieDialog", () => {
  function renderDialog(auth: AuthState, onClose = () => {}) {
    return render(
      <MemoryRouter initialEntries={["/live?x=1"]}>
        <AuthProvider initialState={auth}>
          <CookieDialog bundle={bundle} onClose={onClose} />
        </AuthProvider>
      </MemoryRouter>,
    );
  }

  it("while auth is unknown shows the loading state and calls nothing", () => {
    setState({});
    const utils = renderDialog({ status: "unknown" });
    expect(utils.getByText("Cancel")).toBeInTheDocument();
    expect(utils.queryByTestId("cookie-dialog-signed-out")).toBeNull();
    expect(cookiesApi.getMyCookies).not.toHaveBeenCalled();
  });

  it("Sign in closes the dialog and starts sign-in", () => {
    setState({});
    const onClose = vi.fn();
    const utils = renderDialog({ status: "signedOut" }, onClose);
    fireEvent.click(utils.getByTestId("cookie-dialog-sign-in"));
    expect(onClose).toHaveBeenCalled();
    expect(cookiesApi.getMyCookies).not.toHaveBeenCalled();
  });
});
