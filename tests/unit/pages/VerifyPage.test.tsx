// docs/site.md section 22.1. VerifyPage covers each response row from
// section 13.2 plus the token regex gate, post-on-mount, and the pending
// subscription flag becoming active on 200.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { VerifyPage } from "../../../src/pages/Alerts/VerifyPage";
import { ApiRequestError } from "../../../src/api/client";
import { SUBSCRIPTION_FLAG_KEY, readFlag } from "../../../src/alerts/subscriptionFlag";

vi.mock("../../../src/api/subscriptions", () => ({
  verifySubscription: vi.fn(),
  unsubscribe: vi.fn(),
}));

import * as subsApi from "../../../src/api/subscriptions";

const validToken = "wsv_" + "A".repeat(43);
const invalidToken = "wsv_short";

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <VerifyPage />
    </MemoryRouter>,
  );
}

const PENDING = { account: "p@e.com", id: 5, address: "p@e.com", state: "pending" as const };

beforeEach(() => {
  window.localStorage.clear();
  vi.mocked(subsApi.verifySubscription).mockReset();
});
afterEach(() => cleanup());

describe("VerifyPage", () => {
  it("renders 'not valid' when the token does not match the regex", () => {
    const { container } = renderAt(`/alerts/verify?token=${invalidToken}`);
    expect(container.textContent).toContain("This link is not valid");
    expect(subsApi.verifySubscription).not.toHaveBeenCalled();
  });

  it("renders 'not valid' when no token is present", () => {
    const { container } = renderAt("/alerts/verify");
    expect(container.textContent).toContain("This link is not valid");
    expect(subsApi.verifySubscription).not.toHaveBeenCalled();
  });

  it("posts on mount with the token from the query string", async () => {
    vi.mocked(subsApi.verifySubscription).mockResolvedValueOnce({ verifiedAt: "2024-12-24T00:00:00Z" });
    renderAt(`/alerts/verify?token=${validToken}`);
    await waitFor(() => expect(subsApi.verifySubscription).toHaveBeenCalledWith(validToken));
  });

  it("200 renders 'Your alerts are on'", async () => {
    vi.mocked(subsApi.verifySubscription).mockResolvedValueOnce({ verifiedAt: "2024-12-24T00:00:00Z" });
    const { container } = renderAt(`/alerts/verify?token=${validToken}`);
    await waitFor(() => expect(container.textContent).toContain("Your alerts are on"));
  });

  it("200 makes a pending flag active", async () => {
    window.localStorage.setItem(SUBSCRIPTION_FLAG_KEY, JSON.stringify(PENDING));
    vi.mocked(subsApi.verifySubscription).mockResolvedValueOnce({ verifiedAt: "2024-12-24T00:00:00Z" });
    const { container } = renderAt(`/alerts/verify?token=${validToken}`);
    await waitFor(() => expect(container.textContent).toContain("Your alerts are on"));
    await waitFor(() => expect(readFlag()).toEqual({ ...PENDING, state: "active" }));
  });

  it("200 writes no flag when there is none", async () => {
    vi.mocked(subsApi.verifySubscription).mockResolvedValueOnce({ verifiedAt: "2024-12-24T00:00:00Z" });
    const { container } = renderAt(`/alerts/verify?token=${validToken}`);
    await waitFor(() => expect(container.textContent).toContain("Your alerts are on"));
    expect(readFlag()).toBeNull();
  });

  it("404 leaves a pending flag pending", async () => {
    window.localStorage.setItem(SUBSCRIPTION_FLAG_KEY, JSON.stringify(PENDING));
    vi.mocked(subsApi.verifySubscription).mockRejectedValueOnce(
      new ApiRequestError(404, { code: "not_found", message: "x", details: null, requestId: "r" }, null),
    );
    const { container } = renderAt(`/alerts/verify?token=${validToken}`);
    await waitFor(() => expect(container.textContent).toContain("expired or is not valid"));
    expect(readFlag()).toEqual(PENDING);
  });

  it("404 renders 'expired or is not valid'", async () => {
    vi.mocked(subsApi.verifySubscription).mockRejectedValueOnce(
      new ApiRequestError(404, { code: "not_found", message: "x", details: null, requestId: "r" }, null),
    );
    const { container } = renderAt(`/alerts/verify?token=${validToken}`);
    await waitFor(() => expect(container.textContent).toContain("expired or is not valid"));
  });

  it("400 renders the same expired copy", async () => {
    vi.mocked(subsApi.verifySubscription).mockRejectedValueOnce(
      new ApiRequestError(400, { code: "invalid_token", message: "x", details: null, requestId: "r" }, null),
    );
    const { container } = renderAt(`/alerts/verify?token=${validToken}`);
    await waitFor(() => expect(container.textContent).toContain("expired or is not valid"));
  });

  it("network error shows Retry", async () => {
    vi.mocked(subsApi.verifySubscription)
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({ verifiedAt: "2024-12-24T00:00:00Z" });
    const { container, getByText } = renderAt(`/alerts/verify?token=${validToken}`);
    await waitFor(() => expect(container.textContent).toContain("Could not reach the server"));
    await userEvent.click(getByText("Retry"));
    await waitFor(() => expect(container.textContent).toContain("Your alerts are on"));
  });
});

describe("VerifyPage titles on the status card", () => {
  const title = (c: HTMLElement) => c.querySelector("h1")?.textContent;

  it("bad link", () => {
    const { container } = renderAt(`/alerts/verify?token=${invalidToken}`);
    expect(title(container)).toBe("This link is not valid");
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.querySelector('a[href="/"]')?.textContent).toBe("Home");
  });

  it("confirming, then on", async () => {
    let resolve: (v: { verifiedAt: string }) => void = () => undefined;
    vi.mocked(subsApi.verifySubscription).mockReturnValueOnce(new Promise((r) => (resolve = r)));
    const { container } = renderAt(`/alerts/verify?token=${validToken}`);
    await waitFor(() => expect(title(container)).toBe("Confirming your alerts"));
    expect(container.querySelector('[role="status"]')?.getAttribute("aria-live")).toBe("polite");
    resolve({ verifiedAt: "2024-12-24T00:00:00Z" });
    await waitFor(() => expect(title(container)).toBe("Your alerts are on"));
    expect(container.textContent).toContain("We will email you when Santa is scheduled and when he lifts off.");
  });

  it("expired", async () => {
    vi.mocked(subsApi.verifySubscription).mockRejectedValueOnce(
      new ApiRequestError(404, { code: "not_found", message: "x", details: null, requestId: "r" }, null),
    );
    const { container } = renderAt(`/alerts/verify?token=${validToken}`);
    await waitFor(() => expect(title(container)).toBe("This link has expired or is not valid"));
  });

  it("network", async () => {
    vi.mocked(subsApi.verifySubscription).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const { container } = renderAt(`/alerts/verify?token=${validToken}`);
    await waitFor(() => expect(title(container)).toBe("Could not reach the server"));
    expect(container.querySelector("button")?.textContent).toBe("Retry");
  });
});
