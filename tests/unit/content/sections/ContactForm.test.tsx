// docs/site.md section 22.1. ContactForm covers section 14 limits,
// trimming, and each response row.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { store } from "../../../../src/store/useStore";
import { initialStore } from "../../../../src/store/types";
import {
  ContactForm,
  validateContactForm,
} from "../../../../src/content/sections/ContactForm/ContactForm";
import type { ContentBundle } from "../../../../src/store/types";
import { ApiRequestError } from "../../../../src/api/client";

vi.mock("../../../../src/api/contact", () => ({
  submitContact: vi.fn(),
}));

import * as contactApi from "../../../../src/api/contact";

const bundle: ContentBundle = {
  content: null as unknown as ContentBundle["content"],
  media: {},
  icons: {},
};

function renderForm() {
  return render(
    <MemoryRouter>
      <ContactForm
        data={{ heading: "Send a note", copy: "copy", successText: "Thanks. We got it." }}
        items={[]}
        bundle={bundle}
      />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  act(() => store.setState({ ...initialStore }));
  vi.mocked(contactApi.submitContact).mockReset();
});
afterEach(() => {
  cleanup();
  act(() => store.setState({ ...initialStore }));
});

describe("validateContactForm limits and trimming", () => {
  it("trims each field before checking", () => {
    const v = validateContactForm({ name: "  bob  ", email: "  a@b.co  ", message: "  hi  " });
    expect(v.ok).toBe(true);
    expect(v.values).toEqual({ name: "bob", email: "a@b.co", message: "hi" });
  });

  it("name empty after trim fails", () => {
    expect(validateContactForm({ name: "   ", email: "a@b.co", message: "hi" }).ok).toBe(false);
  });

  it("name over 100 fails", () => {
    expect(validateContactForm({ name: "a".repeat(101), email: "a@b.co", message: "hi" }).ok).toBe(false);
  });

  it("email must be a valid address shape", () => {
    expect(validateContactForm({ name: "bob", email: "not-an-email", message: "hi" }).ok).toBe(false);
    expect(validateContactForm({ name: "bob", email: "a@b.co", message: "hi" }).ok).toBe(true);
  });

  it("message over 2000 fails; message empty fails", () => {
    expect(validateContactForm({ name: "bob", email: "a@b.co", message: "" }).ok).toBe(false);
    expect(validateContactForm({ name: "bob", email: "a@b.co", message: "a".repeat(2001) }).ok).toBe(false);
    expect(validateContactForm({ name: "bob", email: "a@b.co", message: "a".repeat(2000) }).ok).toBe(true);
  });
});

describe("ContactForm submit", () => {
  it("submit is disabled until all fields pass validation", async () => {
    const { getByTestId, getByLabelText } = renderForm();
    expect(getByTestId("contact-submit")).toBeDisabled();
    await userEvent.type(getByLabelText("Name"), "Bob");
    await userEvent.type(getByLabelText("Email"), "b@x.co");
    expect(getByTestId("contact-submit")).toBeDisabled();
    await userEvent.type(getByLabelText("Message"), "hi");
    expect(getByTestId("contact-submit")).toBeEnabled();
  });

  it("201 clears the form and renders successText", async () => {
    vi.mocked(contactApi.submitContact).mockResolvedValueOnce({ id: 1, createdAt: "" } as never);
    const { getByLabelText, getByTestId, findByTestId } = renderForm();
    await userEvent.type(getByLabelText("Name"), "Bob");
    await userEvent.type(getByLabelText("Email"), "b@x.co");
    await userEvent.type(getByLabelText("Message"), "hi");
    await userEvent.click(getByTestId("contact-submit"));
    const success = await findByTestId("contact-success");
    expect(success.textContent).toContain("Thanks. We got it.");
    expect((getByLabelText("Name") as HTMLInputElement).value).toBe("");
  });

  it("400 validation_failed renders per-field errors", async () => {
    vi.mocked(contactApi.submitContact).mockRejectedValueOnce(
      new ApiRequestError(400, {
        code: "validation_failed",
        message: "x",
        details: { fields: { email: "server-email-error", message: "server-message-error" } },
        requestId: "r",
      }, null),
    );
    const { getByLabelText, getByTestId, findByText } = renderForm();
    await userEvent.type(getByLabelText("Name"), "Bob");
    await userEvent.type(getByLabelText("Email"), "b@x.co");
    await userEvent.type(getByLabelText("Message"), "hi");
    await userEvent.click(getByTestId("contact-submit"));
    expect(await findByText("server-email-error")).toBeInTheDocument();
    expect(await findByText("server-message-error")).toBeInTheDocument();
  });

  it("429 rate_limited disables submit and shows the try-again copy without body.message", async () => {
    vi.mocked(contactApi.submitContact).mockRejectedValueOnce(
      new ApiRequestError(
        429,
        { code: "rate_limited", message: "server text should not appear", details: { retryAfterSeconds: 60 }, requestId: "r" },
        60,
      ),
    );
    const { getByLabelText, getByTestId, findByTestId, queryByText } = renderForm();
    await userEvent.type(getByLabelText("Name"), "Bob");
    await userEvent.type(getByLabelText("Email"), "b@x.co");
    await userEvent.type(getByLabelText("Message"), "hi");
    await userEvent.click(getByTestId("contact-submit"));
    await findByTestId("contact-cooldown");
    expect(getByTestId("contact-submit")).toBeDisabled();
    expect(queryByText(/server text should not appear/)).toBeNull();
  });

  it("network keeps the entered text and shows retry copy without body.message", async () => {
    vi.mocked(contactApi.submitContact).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const { getByLabelText, getByTestId, findByTestId } = renderForm();
    await userEvent.type(getByLabelText("Name"), "Bob");
    await userEvent.type(getByLabelText("Email"), "b@x.co");
    await userEvent.type(getByLabelText("Message"), "hi");
    await userEvent.click(getByTestId("contact-submit"));
    await findByTestId("contact-error");
    expect((getByLabelText("Message") as HTMLTextAreaElement).value).toBe("hi");
  });

  it("shows the message counter", async () => {
    const { getByLabelText, getByTestId } = renderForm();
    await userEvent.type(getByLabelText("Message"), "hello");
    await waitFor(() => expect(getByTestId("contact-message-counter").textContent).toBe("5/2000"));
  });

  it("exposes contact-name, contact-email, contact-message testids on the inputs", () => {
    const { getByTestId } = renderForm();
    expect(getByTestId("contact-name").tagName).toBe("INPUT");
    expect(getByTestId("contact-email").tagName).toBe("INPUT");
    expect(getByTestId("contact-message").tagName).toBe("TEXTAREA");
  });
});
