// docs/site.md section 22.1. AlertsSignup covers each response row from
// section 13.1.

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

  it("fetches /me and /me/subscriptions on mount and prefills the address", async () => {
    vi.mocked(subsApi.getMe).mockResolvedValueOnce({ person: { email: "p@example.com" }, isAdmin: false } as never);
    vi.mocked(subsApi.listMySubscriptions).mockResolvedValueOnce({ items: [] } as never);
    const { findByTestId, container } = renderWith({ status: "signedIn", email: "p@e", expired: false });
    await findByTestId("alerts-signed-in");
    expect(container.querySelector('input[type="email"]')).toHaveValue("p@example.com");
    expect(subsApi.getMe).toHaveBeenCalled();
    expect(subsApi.listMySubscriptions).toHaveBeenCalled();
  });

  it("201 with verifiedAt null adds a Pending row", async () => {
    vi.mocked(subsApi.getMe).mockResolvedValueOnce({ person: { email: "p@e.com" }, isAdmin: false } as never);
    vi.mocked(subsApi.listMySubscriptions).mockResolvedValueOnce({ items: [] } as never);
    vi.mocked(subsApi.createSubscription).mockResolvedValueOnce({
      id: 1, channel: "email", address: "p@e.com", verifiedAt: null, unsubscribedAt: null, createdAt: "",
    } as never);
    const { findByTestId, getByTestId } = renderWith({ status: "signedIn", email: "p@e", expired: false });
    await findByTestId("alerts-signed-in");
    await userEvent.click(getByTestId("alerts-submit"));
    await waitFor(() =>
      expect(getByTestId("subscription-state-label").textContent).toBe("Pending"),
    );
  });

  it("201 with verifiedAt set (re-activation) adds an Active row", async () => {
    vi.mocked(subsApi.getMe).mockResolvedValueOnce({ person: { email: "p@e.com" }, isAdmin: false } as never);
    vi.mocked(subsApi.listMySubscriptions).mockResolvedValueOnce({ items: [] } as never);
    vi.mocked(subsApi.createSubscription).mockResolvedValueOnce({
      id: 1, channel: "email", address: "p@e.com", verifiedAt: "2024-12-24T00:00:00Z", unsubscribedAt: null, createdAt: "",
    } as never);
    const { findByTestId, getByTestId } = renderWith({ status: "signedIn", email: "p@e", expired: false });
    await findByTestId("alerts-signed-in");
    await userEvent.click(getByTestId("alerts-submit"));
    await waitFor(() =>
      expect(getByTestId("subscription-state-label").textContent).toBe("Verified"),
    );
  });

  it("409 address_taken shows a field error and never renders body.message", async () => {
    vi.mocked(subsApi.getMe).mockResolvedValueOnce({ person: { email: "p@e.com" }, isAdmin: false } as never);
    vi.mocked(subsApi.listMySubscriptions).mockResolvedValueOnce({ items: [] } as never);
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
    vi.mocked(subsApi.getMe).mockResolvedValueOnce({ person: { email: "p@e.com" }, isAdmin: false } as never);
    vi.mocked(subsApi.listMySubscriptions).mockResolvedValueOnce({ items: [] } as never);
    vi.mocked(subsApi.createSubscription).mockRejectedValueOnce(
      new ApiRequestError(409, { code: "already_subscribed", message: "x", details: null, requestId: "r" }, null),
    );
    const { findByTestId, getByTestId } = renderWith({ status: "signedIn", email: "p@e", expired: false });
    await findByTestId("alerts-signed-in");
    await userEvent.click(getByTestId("alerts-submit"));
    await waitFor(() => expect(getByTestId("alerts-field-error").textContent).toMatch(/already receiving/));
  });

  it("400 validation_failed shows the address field error", async () => {
    vi.mocked(subsApi.getMe).mockResolvedValueOnce({ person: { email: "p@e.com" }, isAdmin: false } as never);
    vi.mocked(subsApi.listMySubscriptions).mockResolvedValueOnce({ items: [] } as never);
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
    vi.mocked(subsApi.getMe).mockResolvedValueOnce({ person: { email: "p@e.com" }, isAdmin: false } as never);
    vi.mocked(subsApi.listMySubscriptions).mockResolvedValueOnce({ items: [] } as never);
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
    const { container } = renderWith({ status: "signedIn", email: "p@e", expired: true });
    await waitFor(() => expect(container.textContent).toContain("Sign in to sign up for alerts."));
  });

  it("resend confirmation calls the API and refreshes on already_verified", async () => {
    vi.mocked(subsApi.getMe).mockResolvedValueOnce({ person: { email: "p@e.com" }, isAdmin: false } as never);
    vi.mocked(subsApi.listMySubscriptions).mockResolvedValueOnce({
      items: [{ id: 5, channel: "email", address: "p@e.com", verifiedAt: null, unsubscribedAt: null, createdAt: "" }],
    } as never);
    vi.mocked(subsApi.resendVerification).mockRejectedValueOnce(
      new ApiRequestError(409, { code: "already_verified", message: "x", details: null, requestId: "r" }, null),
    );
    // The reload happens right after; provide a fresh me/list pair.
    vi.mocked(subsApi.getMe).mockResolvedValueOnce({ person: { email: "p@e.com" }, isAdmin: false } as never);
    vi.mocked(subsApi.listMySubscriptions).mockResolvedValueOnce({
      items: [{ id: 5, channel: "email", address: "p@e.com", verifiedAt: "2024-12-24T00:00:00Z", unsubscribedAt: null, createdAt: "" }],
    } as never);
    const { findByTestId, container } = renderWith({ status: "signedIn", email: "p@e", expired: false });
    await findByTestId("alerts-signed-in");
    const resend = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Resend confirmation")!;
    await userEvent.click(resend);
    await waitFor(() =>
      expect(container.querySelector('[data-testid="subscription-state-label"]')?.textContent).toBe("Verified"),
    );
  });

  it("unsubscribe DELETE updates the row to Unsubscribed", async () => {
    vi.mocked(subsApi.getMe).mockResolvedValueOnce({ person: { email: "p@e.com" }, isAdmin: false } as never);
    vi.mocked(subsApi.listMySubscriptions).mockResolvedValueOnce({
      items: [{ id: 5, channel: "email", address: "p@e.com", verifiedAt: "2024-12-24T00:00:00Z", unsubscribedAt: null, createdAt: "" }],
    } as never);
    vi.mocked(subsApi.deleteSubscription).mockResolvedValueOnce(undefined);
    const { findByTestId, container } = renderWith({ status: "signedIn", email: "p@e", expired: false });
    await findByTestId("alerts-signed-in");
    const unsub = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Unsubscribe")!;
    await userEvent.click(unsub);
    await waitFor(() =>
      expect(container.querySelector('[data-testid="subscription-state-label"]')?.textContent).toBe("Unsubscribed"),
    );
  });
});
