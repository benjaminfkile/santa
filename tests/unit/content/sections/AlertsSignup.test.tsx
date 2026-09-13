// docs/site.md section 22.1. AlertsSignup covers each response row from
// section 13.1, the form-behind-link rule when a subscription is active,
// and the alerts-sent list plus its empty state.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { store } from "../../../../src/store/useStore";
import { initialStore } from "../../../../src/store/types";
import { AlertsSignup } from "../../../../src/content/sections/AlertsSignup/AlertsSignup";
import { AuthProvider, type AuthState } from "../../../../src/auth/AuthProvider";
import type { ContentBundle } from "../../../../src/store/types";
import { ApiRequestError } from "../../../../src/api/client";
import { SignInRequired } from "../../../../src/auth/getIdToken";

vi.mock("../../../../src/api/subscriptions", () => ({
  getMe: vi.fn(),
  listMySubscriptions: vi.fn(),
  listAlerts: vi.fn(),
  createSubscription: vi.fn(),
  resendVerification: vi.fn(),
  deleteSubscription: vi.fn(),
}));

import * as subsApi from "../../../../src/api/subscriptions";

const bundle: ContentBundle = {
  content: null as unknown as ContentBundle["content"],
  media: {},
  icons: {},
};

function renderWith(authState: AuthState) {
  return render(
    <MemoryRouter initialEntries={["/alerts"]}>
      <AuthProvider initialState={authState}>
        <AlertsSignup
          data={{ heading: "Get alerts", copy: "copy", signedOutCopy: "Sign in to sign up for alerts." }}
          items={[]}
          bundle={bundle}
        />
      </AuthProvider>
    </MemoryRouter>,
  );
}

function mockEmpty(email = "p@e.com") {
  vi.mocked(subsApi.getMe).mockResolvedValueOnce({ person: { email }, isAdmin: false } as never);
  vi.mocked(subsApi.listMySubscriptions).mockResolvedValueOnce({ items: [] } as never);
  vi.mocked(subsApi.listAlerts).mockResolvedValueOnce({ items: [] } as never);
}

beforeEach(() => {
  act(() => store.setState({ ...initialStore }));
  for (const k of Object.keys(subsApi)) {
    const fn = (subsApi as Record<string, unknown>)[k];
    if (typeof fn === "function") (fn as ReturnType<typeof vi.fn>).mockReset?.();
  }
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

  it("fetches /me, /me/subscriptions, and /me/alerts on mount and prefills the address", async () => {
    mockEmpty("p@example.com");
    const { findByTestId, container } = renderWith({ status: "signedIn", email: "p@e", expired: false });
    await findByTestId("alerts-signed-in");
    expect(container.querySelector('input[type="email"]')).toHaveValue("p@example.com");
    expect(subsApi.getMe).toHaveBeenCalled();
    expect(subsApi.listMySubscriptions).toHaveBeenCalled();
    expect(subsApi.listAlerts).toHaveBeenCalled();
  });

  it("201 with verifiedAt null adds a Pending row", async () => {
    mockEmpty();
    vi.mocked(subsApi.createSubscription).mockResolvedValueOnce({
      id: 1, channel: "email", address: "p@e.com", verifiedAt: null, unsubscribedAt: null, createdAt: "",
    } as never);
    const { findByTestId, getByTestId } = renderWith({ status: "signedIn", email: "p@e", expired: false });
    await findByTestId("alerts-signed-in");
    await userEvent.click(getByTestId("alerts-submit"));
    await waitFor(() =>
      expect(getByTestId("subscription-state-label").textContent).toBe("Pending, check your email"),
    );
  });

  it("201 with verifiedAt set (re-activation) adds an Active row", async () => {
    mockEmpty();
    vi.mocked(subsApi.createSubscription).mockResolvedValueOnce({
      id: 1, channel: "email", address: "p@e.com", verifiedAt: "2024-12-24T00:00:00Z", unsubscribedAt: null, createdAt: "",
    } as never);
    const { findByTestId, getByTestId } = renderWith({ status: "signedIn", email: "p@e", expired: false });
    await findByTestId("alerts-signed-in");
    await userEvent.click(getByTestId("alerts-submit"));
    await waitFor(() =>
      expect(getByTestId("subscription-state-label").textContent).toBe("Active"),
    );
  });

  it("409 address_taken shows a field error and never renders body.message", async () => {
    mockEmpty();
    vi.mocked(subsApi.createSubscription).mockRejectedValueOnce(
      new ApiRequestError(409, { code: "address_taken", message: "server-only text", details: null, requestId: "r" }, null),
    );
    const { findByTestId, getByTestId, queryByText } = renderWith({ status: "signedIn", email: "p@e", expired: false });
    await findByTestId("alerts-signed-in");
    await userEvent.click(getByTestId("alerts-submit"));
    await waitFor(() => expect(getByTestId("alerts-field-error").textContent).toMatch(/different account/));
    expect(queryByText(/server-only text/)).toBeNull();
  });

  it("409 already_subscribed shows a field error", async () => {
    mockEmpty();
    vi.mocked(subsApi.createSubscription).mockRejectedValueOnce(
      new ApiRequestError(409, { code: "already_subscribed", message: "x", details: null, requestId: "r" }, null),
    );
    const { findByTestId, getByTestId } = renderWith({ status: "signedIn", email: "p@e", expired: false });
    await findByTestId("alerts-signed-in");
    await userEvent.click(getByTestId("alerts-submit"));
    await waitFor(() => expect(getByTestId("alerts-field-error").textContent).toMatch(/already receiving/));
  });

  it("400 validation_failed shows the address field error", async () => {
    mockEmpty();
    vi.mocked(subsApi.createSubscription).mockRejectedValueOnce(
      new ApiRequestError(400, {
        code: "validation_failed",
        message: "x",
        details: { fields: { address: "Not a valid email" } },
        requestId: "r",
      }, null),
    );
    const { findByTestId, getByTestId } = renderWith({ status: "signedIn", email: "p@e", expired: false });
    await findByTestId("alerts-signed-in");
    await userEvent.click(getByTestId("alerts-submit"));
    await waitFor(() => expect(getByTestId("alerts-field-error").textContent).toBe("Not a valid email"));
  });

  it("429 rate_limited disables the form", async () => {
    mockEmpty();
    vi.mocked(subsApi.createSubscription).mockRejectedValueOnce(
      new ApiRequestError(429, { code: "rate_limited", message: "x", details: { retryAfterSeconds: 10 }, requestId: "r" }, 10),
    );
    const { findByTestId, getByTestId } = renderWith({ status: "signedIn", email: "p@e", expired: false });
    await findByTestId("alerts-signed-in");
    await userEvent.click(getByTestId("alerts-submit"));
    await waitFor(() =>
      expect(getByTestId("alerts-field-error").textContent).toMatch(/Try again in/),
    );
    expect(getByTestId("alerts-submit")).toBeDisabled();
  });

  it("SignInRequired renders the signed-out variant", async () => {
    vi.mocked(subsApi.getMe).mockRejectedValueOnce(new SignInRequired());
    vi.mocked(subsApi.listMySubscriptions).mockRejectedValueOnce(new SignInRequired());
    vi.mocked(subsApi.listAlerts).mockRejectedValueOnce(new SignInRequired());
    const { container } = renderWith({ status: "signedIn", email: "p@e", expired: true });
    await waitFor(() => expect(container.textContent).toContain("Sign in to sign up for alerts."));
  });

  it("resend confirmation calls the API and refreshes on already_verified", async () => {
    vi.mocked(subsApi.getMe).mockResolvedValueOnce({ person: { email: "p@e.com" }, isAdmin: false } as never);
    vi.mocked(subsApi.listMySubscriptions).mockResolvedValueOnce({
      items: [{ id: 5, channel: "email", address: "p@e.com", verifiedAt: null, unsubscribedAt: null, createdAt: "" }],
    } as never);
    vi.mocked(subsApi.listAlerts).mockResolvedValueOnce({ items: [] } as never);
    vi.mocked(subsApi.resendVerification).mockRejectedValueOnce(
      new ApiRequestError(409, { code: "already_verified", message: "x", details: null, requestId: "r" }, null),
    );
    // The reload happens right after; provide fresh me/subs/alerts.
    vi.mocked(subsApi.getMe).mockResolvedValueOnce({ person: { email: "p@e.com" }, isAdmin: false } as never);
    vi.mocked(subsApi.listMySubscriptions).mockResolvedValueOnce({
      items: [{ id: 5, channel: "email", address: "p@e.com", verifiedAt: "2024-12-24T00:00:00Z", unsubscribedAt: null, createdAt: "" }],
    } as never);
    vi.mocked(subsApi.listAlerts).mockResolvedValueOnce({ items: [] } as never);
    const { findByTestId, container } = renderWith({ status: "signedIn", email: "p@e", expired: false });
    await findByTestId("alerts-signed-in");
    const resend = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Resend confirmation")!;
    await userEvent.click(resend);
    await waitFor(() =>
      expect(container.querySelector('[data-testid="subscription-state-label"]')?.textContent).toBe("Active"),
    );
  });

  it("unsubscribe DELETE updates the row to Unsubscribed", async () => {
    vi.mocked(subsApi.getMe).mockResolvedValueOnce({ person: { email: "p@e.com" }, isAdmin: false } as never);
    vi.mocked(subsApi.listMySubscriptions).mockResolvedValueOnce({
      items: [{ id: 5, channel: "email", address: "p@e.com", verifiedAt: "2024-12-24T00:00:00Z", unsubscribedAt: null, createdAt: "" }],
    } as never);
    vi.mocked(subsApi.listAlerts).mockResolvedValueOnce({ items: [] } as never);
    vi.mocked(subsApi.deleteSubscription).mockResolvedValueOnce(undefined);
    const { findByTestId, container } = renderWith({ status: "signedIn", email: "p@e", expired: false });
    await findByTestId("alerts-signed-in");
    const unsub = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Unsubscribe")!;
    await userEvent.click(unsub);
    await waitFor(() =>
      expect(container.querySelector('[data-testid="subscription-state-label"]')?.textContent).toBe("Unsubscribed"),
    );
  });

  it("hides the form behind an Add another address link when a subscription is active", async () => {
    vi.mocked(subsApi.getMe).mockResolvedValueOnce({ person: { email: "p@e.com" }, isAdmin: false } as never);
    vi.mocked(subsApi.listMySubscriptions).mockResolvedValueOnce({
      items: [{ id: 5, channel: "email", address: "p@e.com", verifiedAt: "2024-12-24T00:00:00Z", unsubscribedAt: null, createdAt: "" }],
    } as never);
    vi.mocked(subsApi.listAlerts).mockResolvedValueOnce({ items: [] } as never);
    const { findByTestId, queryByTestId, getByTestId } = renderWith({ status: "signedIn", email: "p@e", expired: false });
    await findByTestId("alerts-signed-in");
    expect(queryByTestId("alerts-submit")).toBeNull();
    expect(getByTestId("alerts-add-another")).toBeInTheDocument();
    await userEvent.click(getByTestId("alerts-add-another"));
    await waitFor(() => expect(queryByTestId("alerts-submit")).not.toBeNull());
  });

  it("shows the form when the only subscription is unsubscribed (no active row)", async () => {
    vi.mocked(subsApi.getMe).mockResolvedValueOnce({ person: { email: "p@e.com" }, isAdmin: false } as never);
    vi.mocked(subsApi.listMySubscriptions).mockResolvedValueOnce({
      items: [{ id: 5, channel: "email", address: "p@e.com", verifiedAt: "2024-12-24T00:00:00Z", unsubscribedAt: "2024-12-25T00:00:00Z", createdAt: "" }],
    } as never);
    vi.mocked(subsApi.listAlerts).mockResolvedValueOnce({ items: [] } as never);
    const { findByTestId, queryByTestId } = renderWith({ status: "signedIn", email: "p@e", expired: false });
    await findByTestId("alerts-signed-in");
    expect(queryByTestId("alerts-submit")).not.toBeNull();
    expect(queryByTestId("alerts-add-another")).toBeNull();
  });

  it("renders the sent-alerts empty state when /me/alerts is empty", async () => {
    mockEmpty();
    const { findByTestId } = renderWith({ status: "signedIn", email: "p@e", expired: false });
    await findByTestId("alerts-signed-in");
    const empty = await findByTestId("alerts-sent-empty");
    expect(empty.textContent).toBe("No alerts have been sent to you yet.");
  });

  it("renders the sent-alerts list with kind, event, and subject, newest first", async () => {
    vi.mocked(subsApi.getMe).mockResolvedValueOnce({ person: { email: "p@e.com" }, isAdmin: false } as never);
    vi.mocked(subsApi.listMySubscriptions).mockResolvedValueOnce({
      items: [{ id: 5, channel: "email", address: "p@e.com", verifiedAt: "2024-12-24T00:00:00Z", unsubscribedAt: null, createdAt: "" }],
    } as never);
    vi.mocked(subsApi.listAlerts).mockResolvedValueOnce({
      items: [
        { id: 1, subscriptionId: 5, address: "p@e.com", kind: "status", eventId: 10, eventName: "Walk", statusId: 3, messageId: null, subject: "We are live", sentAt: "2024-12-24T18:00:00Z" },
        { id: 2, subscriptionId: 5, address: "p@e.com", kind: "update", eventId: 10, eventName: "Walk", statusId: null, messageId: 42, subject: "Latest update", sentAt: "2024-12-24T20:00:00Z" },
      ],
    } as never);
    const { findByTestId, getAllByTestId, queryByTestId } = renderWith({ status: "signedIn", email: "p@e", expired: false });
    await findByTestId("alerts-signed-in");
    await findByTestId("alerts-sent");
    const kinds = getAllByTestId("alert-kind").map((n) => n.textContent);
    expect(kinds).toEqual(["update", "status"]);
    const events = getAllByTestId("alert-event").map((n) => n.textContent);
    expect(events).toEqual(["Walk", "Walk"]);
    const subjects = getAllByTestId("alert-subject").map((n) => n.textContent);
    expect(subjects).toEqual(["Latest update", "We are live"]);
    // Only one subscription address, so per-row address is hidden.
    expect(queryByTestId("alert-address")).toBeNull();
  });

  it("shows the address column when the person has more than one subscription", async () => {
    vi.mocked(subsApi.getMe).mockResolvedValueOnce({ person: { email: "p@e.com" }, isAdmin: false } as never);
    vi.mocked(subsApi.listMySubscriptions).mockResolvedValueOnce({
      items: [
        { id: 5, channel: "email", address: "p@e.com", verifiedAt: "2024-12-24T00:00:00Z", unsubscribedAt: null, createdAt: "" },
        { id: 6, channel: "email", address: "other@e.com", verifiedAt: "2024-12-24T00:00:00Z", unsubscribedAt: null, createdAt: "" },
      ],
    } as never);
    vi.mocked(subsApi.listAlerts).mockResolvedValueOnce({
      items: [
        { id: 1, subscriptionId: 5, address: "p@e.com", kind: "status", eventId: 10, eventName: "Walk", statusId: 3, messageId: null, subject: "We are live", sentAt: "2024-12-24T18:00:00Z" },
      ],
    } as never);
    const { findByTestId, getByTestId } = renderWith({ status: "signedIn", email: "p@e", expired: false });
    await findByTestId("alerts-signed-in");
    expect(getByTestId("alert-address").textContent).toBe("p@e.com");
  });
});
