// docs/site.md section 22.1. UnsubscribePage covers each response row
// from section 13.3 plus the token regex gate, post-on-mount, and the
// subscription flag cleared on 204.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { UnsubscribePage } from "../../../src/pages/Alerts/UnsubscribePage";
import { ApiRequestError } from "../../../src/api/client";
import { SUBSCRIPTION_FLAG_KEY, readFlag } from "../../../src/alerts/subscriptionFlag";

vi.mock("../../../src/api/subscriptions", () => ({
  verifySubscription: vi.fn(),
  unsubscribe: vi.fn(),
}));

import * as subsApi from "../../../src/api/subscriptions";

const validToken = "wsu_" + "A".repeat(43);
const invalidToken = "wsu_short";

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <UnsubscribePage />
    </MemoryRouter>,
  );
}

const FLAG = { account: "p@e.com", id: 5, address: "p@e.com", state: "active" as const };

beforeEach(() => {
  window.localStorage.clear();
  vi.mocked(subsApi.unsubscribe).mockReset();
});
afterEach(() => cleanup());

describe("UnsubscribePage", () => {
  it("renders 'not valid' when the token does not match the regex", () => {
    const { container } = renderAt(`/alerts/unsubscribe?token=${invalidToken}`);
    expect(container.textContent).toContain("This link is not valid");
    expect(subsApi.unsubscribe).not.toHaveBeenCalled();
  });

  it("renders 'not valid' when no token is present", () => {
    const { container } = renderAt("/alerts/unsubscribe");
    expect(container.textContent).toContain("This link is not valid");
    expect(subsApi.unsubscribe).not.toHaveBeenCalled();
  });

  it("posts on mount with the token", async () => {
    vi.mocked(subsApi.unsubscribe).mockResolvedValueOnce(undefined);
    renderAt(`/alerts/unsubscribe?token=${validToken}`);
    await waitFor(() => expect(subsApi.unsubscribe).toHaveBeenCalledWith(validToken));
  });

  it("204 renders 'You are unsubscribed'", async () => {
    vi.mocked(subsApi.unsubscribe).mockResolvedValueOnce(undefined);
    const { container } = renderAt(`/alerts/unsubscribe?token=${validToken}`);
    await waitFor(() => expect(container.textContent).toContain("You are unsubscribed"));
  });

  it("404 renders 'This link has expired or is not valid'", async () => {
    vi.mocked(subsApi.unsubscribe).mockRejectedValueOnce(
      new ApiRequestError(404, { code: "not_found", message: "x", details: null, requestId: "r" }, null),
    );
    const { container } = renderAt(`/alerts/unsubscribe?token=${validToken}`);
    await waitFor(() => expect(container.textContent).toContain("This link has expired or is not valid"));
  });

  it("network error shows Retry", async () => {
    vi.mocked(subsApi.unsubscribe)
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(undefined);
    const { container, getByText } = renderAt(`/alerts/unsubscribe?token=${validToken}`);
    await waitFor(() => expect(container.textContent).toContain("Could not reach the server"));
    await userEvent.click(getByText("Retry"));
    await waitFor(() => expect(container.textContent).toContain("You are unsubscribed"));
  });
  it("204 clears the subscription flag", async () => {
    window.localStorage.setItem(SUBSCRIPTION_FLAG_KEY, JSON.stringify(FLAG));
    vi.mocked(subsApi.unsubscribe).mockResolvedValueOnce(undefined);
    const { container } = renderAt(`/alerts/unsubscribe?token=${validToken}`);
    await waitFor(() => expect(container.textContent).toContain("You are unsubscribed"));
    expect(readFlag()).toBeNull();
  });

  it("404 leaves the subscription flag", async () => {
    window.localStorage.setItem(SUBSCRIPTION_FLAG_KEY, JSON.stringify(FLAG));
    vi.mocked(subsApi.unsubscribe).mockRejectedValueOnce(
      new ApiRequestError(404, { code: "not_found", message: "x", details: null, requestId: "r" }, null),
    );
    const { container } = renderAt(`/alerts/unsubscribe?token=${validToken}`);
    await waitFor(() => expect(container.textContent).toContain("This link has expired or is not valid"));
    expect(readFlag()).toEqual(FLAG);
  });
});

describe("UnsubscribePage titles on the status card", () => {
  const title = (c: HTMLElement) => c.querySelector("h1")?.textContent;

  it("bad link", () => {
    const { container } = renderAt(`/alerts/unsubscribe?token=${invalidToken}`);
    expect(title(container)).toBe("This link is not valid");
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.querySelector('a[href="/"]')?.textContent).toBe("Home");
  });

  it("processing, then unsubscribed", async () => {
    let resolve: () => void = () => undefined;
    vi.mocked(subsApi.unsubscribe).mockReturnValueOnce(new Promise<void>((r) => (resolve = r)));
    const { container } = renderAt(`/alerts/unsubscribe?token=${validToken}`);
    await waitFor(() => expect(title(container)).toBe("Processing"));
    expect(container.querySelector('[role="status"]')?.getAttribute("aria-live")).toBe("polite");
    resolve();
    await waitFor(() => expect(title(container)).toBe("You are unsubscribed"));
    expect(container.textContent).toContain("We will not email you again.");
  });

  it("expired", async () => {
    vi.mocked(subsApi.unsubscribe).mockRejectedValueOnce(
      new ApiRequestError(404, { code: "not_found", message: "x", details: null, requestId: "r" }, null),
    );
    const { container } = renderAt(`/alerts/unsubscribe?token=${validToken}`);
    await waitFor(() => expect(title(container)).toBe("This link has expired or is not valid"));
  });

  it("network", async () => {
    vi.mocked(subsApi.unsubscribe).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const { container } = renderAt(`/alerts/unsubscribe?token=${validToken}`);
    await waitFor(() => expect(title(container)).toBe("Could not reach the server"));
    expect(container.querySelector("button")?.textContent).toBe("Retry");
  });
});
