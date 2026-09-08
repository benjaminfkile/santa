// docs/site.md section 22.1. VerifyPage covers each response row from
// section 13.2 plus the token regex gate and post-on-mount.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { VerifyPage } from "../../../src/pages/Alerts/VerifyPage";
import { ApiRequestError } from "../../../src/api/client";

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

beforeEach(() => {
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

  it("200 renders 'Your alerts are confirmed'", async () => {
    vi.mocked(subsApi.verifySubscription).mockResolvedValueOnce({ verifiedAt: "2024-12-24T00:00:00Z" });
    const { container } = renderAt(`/alerts/verify?token=${validToken}`);
    await waitFor(() => expect(container.textContent).toContain("Your alerts are confirmed"));
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
    await waitFor(() => expect(container.textContent).toContain("Your alerts are confirmed"));
  });
});
