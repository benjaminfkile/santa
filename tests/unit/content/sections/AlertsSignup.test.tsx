// docs/site.md sections 13.1 and 22.1. AlertsSignup makes no API call on
// mount; it shows the subscription flag's row or the form prefilled with
// the account email from `useAuth()`, writes and clears the flag per
// response row of 13.1, renders the closed copy from
// `snapshot.subscriptionsOpen` and from `409 subscriptions_closed`, and
// lists the snapshot's alerts with their empty state. A `409
// already_subscribed` adopts the row through `GET /me/notifications`.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { store } from "../../../../src/store/useStore";
import { initialStore } from "../../../../src/store/types";
import { AlertsSignup } from "../../../../src/content/sections/AlertsSignup/AlertsSignup";
import { AuthProvider, type AuthState } from "../../../../src/auth/AuthProvider";
import { SubscriptionProvider } from "../../../../src/alerts/SubscriptionProvider";
import {
  SUBSCRIPTION_FLAG_KEY,
  writeFlag,
  type SubscriptionFlag,
} from "../../../../src/alerts/subscriptionFlag";
import { copy } from "../../../../src/copy/copy";
import type { ContentBundle } from "../../../../src/store/types";
import type { SnapshotAlert } from "../../../../src/contracts";
import { ApiRequestError } from "../../../../src/api/client";
import { SignInRequired } from "../../../../src/auth/getIdToken";

vi.mock("../../../../src/api/subscriptions", () => ({
  getMyNotifications: vi.fn(),
  createSubscription: vi.fn(),
  resendVerification: vi.fn(),
  deleteSubscription: vi.fn(),
}));

import * as subsApi from "../../../../src/api/subscriptions";

const EMAIL = "p@e.com";
const SIGNED_IN: AuthState = { status: "signedIn", email: EMAIL, expired: false };

const bundle: ContentBundle = {
  content: null as unknown as ContentBundle["content"],
  media: {},
  icons: {},
};

function seed(opts: { alerts?: SnapshotAlert[]; subscriptionsOpen?: boolean } = {}) {
  act(() => {
    store.setState({
      ...initialStore,
      snapshot: {
        schemaVersion: 1,
        event: { statusId: 1, name: "Walk", alerts: opts.alerts ?? [] },
        subscriptionsOpen: opts.subscriptionsOpen ?? true,
      },
    } as never);
  });
}

function storeFlag(flag: SubscriptionFlag) {
  window.localStorage.setItem(SUBSCRIPTION_FLAG_KEY, JSON.stringify(flag));
}

function storedFlag(): SubscriptionFlag | null {
  const raw = window.localStorage.getItem(SUBSCRIPTION_FLAG_KEY);
  return raw === null ? null : (JSON.parse(raw) as SubscriptionFlag);
}

function apiError(status: number, code: string, details: Record<string, unknown> | null = null, retry: number | null = null) {
  return new ApiRequestError(status, { code, message: "server-only text", details, requestId: "r" }, retry);
}

function renderWith(authState: AuthState) {
  return render(
    <MemoryRouter initialEntries={["/alerts"]}>
      <AuthProvider initialState={authState}>
        <SubscriptionProvider>
          <AlertsSignup
            data={{ heading: "Get alerts", copy: "copy", signedOutCopy: "Sign in to sign up for alerts." }}
            items={[]}
            bundle={bundle}
          />
        </SubscriptionProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

const PENDING: SubscriptionFlag = { account: EMAIL, id: 5, address: EMAIL, state: "pending" };
const ACTIVE: SubscriptionFlag = { ...PENDING, state: "active" };

beforeEach(() => {
  window.localStorage.clear();
  for (const fn of Object.values(subsApi)) {
    if (typeof fn === "function") (fn as ReturnType<typeof vi.fn>).mockReset?.();
  }
  seed();
});

afterEach(() => {
  cleanup();
  act(() => store.setState({ ...initialStore }));
});

describe("AlertsSignup", () => {
  it("renders signedOutCopy when signed out", () => {
    const { container } = renderWith({ status: "signedOut" });
    expect(container.textContent).toContain("Sign in to sign up for alerts.");
    expect(container.querySelector("button")?.textContent).toBe("Sign in");
  });

  it("makes no API call on mount and prefills the address with the account email", async () => {
    const { getByTestId, container } = renderWith(SIGNED_IN);
    await act(async () => {});
    expect(getByTestId("alerts-signed-in")).toBeInTheDocument();
    expect(container.querySelector('input[type="email"]')).toHaveValue(EMAIL);
    expect(getByTestId("alerts-account").textContent).toBe(`Account: ${EMAIL}`);
    for (const fn of Object.values(subsApi)) expect(fn).not.toHaveBeenCalled();
  });

  it("shows the flag's subscription as a row in place of the form, with no Add another address", async () => {
    storeFlag(ACTIVE);
    const { getByTestId, queryByTestId } = renderWith(SIGNED_IN);
    await act(async () => {});
    expect(queryByTestId("alerts-submit")).toBeNull();
    expect(queryByTestId("alerts-add-another")).toBeNull();
    const row = getByTestId("subscription-5");
    expect(row.textContent).toContain(EMAIL);
    expect(getByTestId("subscription-state-label").textContent).toBe("Active");
    expect(queryByTestId("subscription-resend")).toBeNull();
    expect(getByTestId("subscription-unsubscribe")).toBeInTheDocument();
  });

  it("offers Resend confirmation on a pending flag", async () => {
    storeFlag(PENDING);
    const { getByTestId } = renderWith(SIGNED_IN);
    await act(async () => {});
    expect(getByTestId("subscription-state-label").textContent).toBe("Pending, check your email");
    expect(getByTestId("subscription-resend").textContent).toBe("Resend confirmation");
  });

  it("201 with verifiedAt null writes a pending flag", async () => {
    vi.mocked(subsApi.createSubscription).mockResolvedValueOnce({
      id: 1, channel: "email", address: EMAIL, verifiedAt: null, unsubscribedAt: null, createdAt: "",
    } as never);
    const { getByTestId } = renderWith(SIGNED_IN);
    await userEvent.click(getByTestId("alerts-submit"));
    await waitFor(() =>
      expect(getByTestId("subscription-state-label").textContent).toBe("Pending, check your email"),
    );
    expect(storedFlag()).toEqual({ account: EMAIL, id: 1, address: EMAIL, state: "pending" });
  });

  it("201 with verifiedAt set (re-activation) writes an active flag", async () => {
    vi.mocked(subsApi.createSubscription).mockResolvedValueOnce({
      id: 1, channel: "email", address: EMAIL, verifiedAt: "2024-12-24T00:00:00Z", unsubscribedAt: null, createdAt: "",
    } as never);
    const { getByTestId } = renderWith(SIGNED_IN);
    await userEvent.click(getByTestId("alerts-submit"));
    await waitFor(() => expect(getByTestId("subscription-state-label").textContent).toBe("Active"));
    expect(storedFlag()?.state).toBe("active");
  });

  it("shows the own-address hint above the field only while it holds the account email", async () => {
    const { getByTestId, queryByTestId, container } = renderWith(SIGNED_IN);
    await act(async () => {});
    expect(copy.alerts.ownAddressHint).toBe("Your account address needs no confirmation email.");
    const hint = getByTestId("alerts-own-address-hint");
    expect(hint.textContent).toBe(copy.alerts.ownAddressHint);
    const input = container.querySelector('input[type="email"]') as HTMLInputElement;
    expect(hint.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await userEvent.clear(input);
    await userEvent.type(input, "other@e.com");
    expect(queryByTestId("alerts-own-address-hint")).toBeNull();
    await userEvent.clear(input);
    await userEvent.type(input, " P@E.com ");
    expect(getByTestId("alerts-own-address-hint")).toBeInTheDocument();
  });

  it("the account address verified at once (201 with verifiedAt) shows the Active row and 'You are subscribed.'", async () => {
    vi.mocked(subsApi.createSubscription).mockResolvedValueOnce({
      id: 9, channel: "email", address: EMAIL, verifiedAt: "2026-10-22T00:00:00Z", unsubscribedAt: null, createdAt: "",
    } as never);
    const { getByTestId } = renderWith(SIGNED_IN);
    await userEvent.click(getByTestId("alerts-submit"));
    await waitFor(() => expect(getByTestId("subscription-state-label").textContent).toBe("Active"));
    expect(getByTestId("alerts-notice").textContent).toBe("You are subscribed.");
    expect(storedFlag()).toEqual({ account: EMAIL, id: 9, address: EMAIL, state: "active" });
  });

  it("a flag written outside the provider (the sign-up alerts intent) shows the row", async () => {
    const { getByTestId, queryByTestId } = renderWith(SIGNED_IN);
    await act(async () => {});
    expect(getByTestId("alerts-submit")).toBeInTheDocument();
    act(() => writeFlag(ACTIVE));
    expect(queryByTestId("alerts-submit")).toBeNull();
    expect(getByTestId("subscription-state-label").textContent).toBe("Active");
  });

  it("200 (the pending re-POST) writes the pending flag", async () => {
    vi.mocked(subsApi.createSubscription).mockResolvedValueOnce({
      id: 3, channel: "email", address: EMAIL, verifiedAt: null, unsubscribedAt: null, createdAt: "",
    } as never);
    const { getByTestId } = renderWith(SIGNED_IN);
    await userEvent.click(getByTestId("alerts-submit"));
    await waitFor(() => expect(storedFlag()).toEqual({ account: EMAIL, id: 3, address: EMAIL, state: "pending" }));
  });

  it("409 address_taken shows a field error, writes no flag, and never renders body.message", async () => {
    vi.mocked(subsApi.createSubscription).mockRejectedValueOnce(apiError(409, "address_taken"));
    const { getByTestId, queryByText } = renderWith(SIGNED_IN);
    await userEvent.click(getByTestId("alerts-submit"));
    await waitFor(() => expect(getByTestId("alerts-field-error").textContent).toMatch(/different account/));
    expect(queryByText(/server-only text/)).toBeNull();
    expect(storedFlag()).toBeNull();
  });

  it("409 already_subscribed adopts the existing row through one GET /me/notifications and shows it", async () => {
    vi.mocked(subsApi.createSubscription).mockRejectedValueOnce(apiError(409, "already_subscribed"));
    vi.mocked(subsApi.getMyNotifications).mockResolvedValueOnce({
      subscription: { id: 7, channel: "email", address: EMAIL, verifiedAt: "2024-12-24T00:00:00Z", unsubscribedAt: null, createdAt: "2024-12-01T00:00:00Z" },
      seenUpToId: null,
    });
    const { getByTestId, queryByTestId } = renderWith(SIGNED_IN);
    await userEvent.click(getByTestId("alerts-submit"));
    await waitFor(() => expect(getByTestId("subscription-state-label").textContent).toBe("Active"));
    expect(subsApi.getMyNotifications).toHaveBeenCalledTimes(1);
    expect(storedFlag()).toEqual({ account: EMAIL, id: 7, address: EMAIL, state: "active" });
    expect(getByTestId("alerts-notice").textContent).toMatch(/already subscribed/);
    expect(queryByTestId("alerts-submit")).toBeNull();
    expect(queryByTestId("alerts-field-error")).toBeNull();
  });

  it("409 already_subscribed with a null subscription falls back to the field error and writes no flag", async () => {
    vi.mocked(subsApi.createSubscription).mockRejectedValueOnce(apiError(409, "already_subscribed"));
    vi.mocked(subsApi.getMyNotifications).mockResolvedValueOnce({ subscription: null, seenUpToId: null });
    const { getByTestId } = renderWith(SIGNED_IN);
    await userEvent.click(getByTestId("alerts-submit"));
    await waitFor(() => expect(getByTestId("alerts-field-error").textContent).toMatch(/already receiving/));
    expect(storedFlag()).toBeNull();
  });

  it("409 already_subscribed with a failed GET falls back to the field error", async () => {
    vi.mocked(subsApi.createSubscription).mockRejectedValueOnce(apiError(409, "already_subscribed"));
    vi.mocked(subsApi.getMyNotifications).mockRejectedValueOnce(apiError(500, "internal"));
    const { getByTestId } = renderWith(SIGNED_IN);
    await userEvent.click(getByTestId("alerts-submit"));
    await waitFor(() => expect(getByTestId("alerts-field-error").textContent).toMatch(/already receiving/));
    expect(storedFlag()).toBeNull();
  });

  it("400 validation_failed shows the address field error", async () => {
    vi.mocked(subsApi.createSubscription).mockRejectedValueOnce(
      apiError(400, "validation_failed", { fields: { address: "Not a valid email" } }),
    );
    const { getByTestId } = renderWith(SIGNED_IN);
    await userEvent.click(getByTestId("alerts-submit"));
    await waitFor(() => expect(getByTestId("alerts-field-error").textContent).toBe("Not a valid email"));
  });

  it("429 rate_limited disables the form", async () => {
    vi.mocked(subsApi.createSubscription).mockRejectedValueOnce(
      apiError(429, "rate_limited", { retryAfterSeconds: 10 }, 10),
    );
    const { getByTestId } = renderWith(SIGNED_IN);
    await userEvent.click(getByTestId("alerts-submit"));
    await waitFor(() => expect(getByTestId("alerts-field-error").textContent).toMatch(/Try again in/));
    expect(getByTestId("alerts-submit")).toBeDisabled();
  });

  it("SignInRequired renders the signed-out variant", async () => {
    vi.mocked(subsApi.createSubscription).mockRejectedValueOnce(new SignInRequired());
    const { getByTestId, container } = renderWith(SIGNED_IN);
    await userEvent.click(getByTestId("alerts-submit"));
    await waitFor(() => expect(container.textContent).toContain("Sign in to sign up for alerts."));
  });

  it("202 from resend rewrites the flag with its state unchanged", async () => {
    storeFlag(PENDING);
    vi.mocked(subsApi.resendVerification).mockResolvedValueOnce({
      id: 5, channel: "email", address: EMAIL, verifiedAt: null, unsubscribedAt: null, createdAt: "",
    } as never);
    const { getByTestId } = renderWith(SIGNED_IN);
    await userEvent.click(getByTestId("subscription-resend"));
    await waitFor(() => expect(getByTestId("alerts-notice").textContent).toBe("Confirmation resent."));
    expect(subsApi.resendVerification).toHaveBeenCalledWith(5);
    expect(storedFlag()).toEqual(PENDING);
  });

  it("409 already_verified on resend shows the row as Active", async () => {
    storeFlag(PENDING);
    vi.mocked(subsApi.resendVerification).mockRejectedValueOnce(apiError(409, "already_verified"));
    const { getByTestId } = renderWith(SIGNED_IN);
    await userEvent.click(getByTestId("subscription-resend"));
    await waitFor(() => expect(getByTestId("subscription-state-label").textContent).toBe("Active"));
    expect(storedFlag()?.state).toBe("active");
    expect(subsApi.getMyNotifications).not.toHaveBeenCalled();
  });

  it("204 from unsubscribe clears the flag and brings the form back", async () => {
    storeFlag(ACTIVE);
    vi.mocked(subsApi.deleteSubscription).mockResolvedValueOnce(undefined);
    const { getByTestId, queryByTestId } = renderWith(SIGNED_IN);
    await userEvent.click(getByTestId("subscription-unsubscribe"));
    await waitFor(() => expect(queryByTestId("alerts-submit")).not.toBeNull());
    expect(subsApi.deleteSubscription).toHaveBeenCalledWith(5);
    expect(queryByTestId("subscription-5")).toBeNull();
    expect(storedFlag()).toBeNull();
  });

  it("never shows a flag of another account", async () => {
    storeFlag({ ...ACTIVE, account: "other@e.com" });
    const { getByTestId, queryByTestId } = renderWith(SIGNED_IN);
    await act(async () => {});
    expect(queryByTestId("subscription-5")).toBeNull();
    expect(getByTestId("alerts-submit")).toBeInTheDocument();
    expect(storedFlag()).toBeNull();
  });
});

describe("AlertsSignup closed", () => {
  it("renders the closed copy in place of the form while snapshot.subscriptionsOpen is false", async () => {
    seed({ subscriptionsOpen: false });
    const { getByTestId, queryByTestId } = renderWith(SIGNED_IN);
    await act(async () => {});
    expect(getByTestId("alerts-closed").textContent).toBe("New alert sign-ups are closed for now");
    expect(queryByTestId("alerts-submit")).toBeNull();
  });

  it("still offers Unsubscribe on an existing flag while closed, and no Resend", async () => {
    seed({ subscriptionsOpen: false });
    storeFlag(PENDING);
    const { getByTestId, queryByTestId } = renderWith(SIGNED_IN);
    await act(async () => {});
    expect(getByTestId("alerts-closed")).toBeInTheDocument();
    expect(getByTestId("subscription-unsubscribe")).toBeInTheDocument();
    expect(queryByTestId("subscription-resend")).toBeNull();
  });

  it("renders the closed copy after 409 subscriptions_closed and writes no flag", async () => {
    vi.mocked(subsApi.createSubscription).mockRejectedValueOnce(apiError(409, "subscriptions_closed"));
    const { getByTestId, queryByTestId } = renderWith(SIGNED_IN);
    await userEvent.click(getByTestId("alerts-submit"));
    await waitFor(() =>
      expect(getByTestId("alerts-closed").textContent).toBe("New alert sign-ups are closed for now"),
    );
    expect(queryByTestId("alerts-submit")).toBeNull();
    expect(queryByTestId("alerts-field-error")).toBeNull();
    expect(storedFlag()).toBeNull();
  });

  it("renders the closed copy after 409 subscriptions_closed on resend, keeping Unsubscribe", async () => {
    storeFlag(PENDING);
    vi.mocked(subsApi.resendVerification).mockRejectedValueOnce(apiError(409, "subscriptions_closed"));
    const { getByTestId, queryByTestId } = renderWith(SIGNED_IN);
    await userEvent.click(getByTestId("subscription-resend"));
    await waitFor(() => expect(getByTestId("alerts-closed")).toBeInTheDocument());
    expect(queryByTestId("subscription-resend")).toBeNull();
    expect(getByTestId("subscription-unsubscribe")).toBeInTheDocument();
    expect(storedFlag()).toEqual(PENDING);
  });
});

describe("AlertsSignup alerts list", () => {
  function alert(id: number, kind: string, subject: string, createdAt: string, message: string | null = null): SnapshotAlert {
    return { id, kind, statusId: kind === "event_status" ? 3 : null, messageId: null, subject, message, createdAt };
  }

  it("says No alerts yet when the snapshot has none", async () => {
    const { getByTestId } = renderWith(SIGNED_IN);
    expect(getByTestId("alerts-sent-empty").textContent).toBe("No alerts yet");
  });

  it("lists the snapshot's alerts newest first with kind, the event name, and subject", async () => {
    seed({
      alerts: [
        alert(1, "event_status", "We are live", "2024-12-24T18:00:00Z"),
        alert(2, "event_message", "Latest update", "2024-12-24T20:00:00Z"),
      ],
    });
    const { getAllByTestId } = renderWith(SIGNED_IN);
    expect(getAllByTestId("alert-kind").map((n) => n.textContent)).toEqual(["update", "status"]);
    expect(getAllByTestId("alert-event").map((n) => n.textContent)).toEqual(["Walk", "Walk"]);
    expect(getAllByTestId("alert-subject").map((n) => n.textContent)).toEqual(["Latest update", "We are live"]);
    expect(getAllByTestId("alert-sent-at")[0].textContent).not.toBe("");
    expect(subsApi.getMyNotifications).not.toHaveBeenCalled();
  });

  it("shows each alert's message under its subject, and no body element when the message is null", async () => {
    seed({
      alerts: [
        alert(1, "event_status", "Postponed", "2024-12-24T18:00:00Z", "Fog over the bay.\nWe will walk tomorrow."),
        alert(2, "event_message", "Latest update", "2024-12-24T20:00:00Z", "Cocoa at the north gate."),
        alert(3, "event_status", "We are live", "2024-12-24T22:00:00Z"),
      ],
    });
    const { getByTestId } = renderWith(SIGNED_IN);
    const body = getByTestId("alert-1").querySelector('[data-testid="alert-message"]')!;
    expect(body.textContent).toBe("Fog over the bay.\nWe will walk tomorrow.");
    expect(body.previousElementSibling?.getAttribute("data-testid")).toBe("alert-subject");
    expect(getByTestId("alert-2").querySelector('[data-testid="alert-message"]')?.textContent).toBe(
      "Cocoa at the north gate.",
    );
    const bare = getByTestId("alert-3");
    expect(bare.querySelector('[data-testid="alert-message"]')).toBeNull();
    expect(bare.querySelector('[data-testid="alert-subject"]')?.textContent).toBe("We are live");
  });
});
