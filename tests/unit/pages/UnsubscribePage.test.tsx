// docs/site.md section 22.1. UnsubscribePage covers each response row
// from section 13.3 plus the token regex gate and post-on-mount.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { UnsubscribePage } from "../../../src/pages/Alerts/UnsubscribePage";
import { ApiRequestError } from "../../../src/api/client";

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

beforeEach(() => {
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

  it("404 renders 'This link is not valid'", async () => {
    vi.mocked(subsApi.unsubscribe).mockRejectedValueOnce(
      new ApiRequestError(404, { code: "not_found", message: "x", details: null, requestId: "r" }, null),
    );
    const { container } = renderAt(`/alerts/unsubscribe?token=${validToken}`);
    await waitFor(() => expect(container.textContent).toContain("This link is not valid"));
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
});
