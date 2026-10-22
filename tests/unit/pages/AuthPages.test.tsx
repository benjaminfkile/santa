// docs/site.md 22.1 "Auth pages": client checks (address shape, 8
// characters, matching passwords); submit disabled in flight;
// UserNotConfirmedException routes to /auth/confirm with the email;
// confirm straight from sign-up signs in and lands on returnTo; forgot
// shows the same copy for unknown addresses. The sign-up alerts box
// stores the intent, and the confirm page's direct sign-in and a hand
// sign-in complete it.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";

vi.mock("../../../src/auth/cognito", () => ({
  cognito: {
    signUp: vi.fn(),
    confirm: vi.fn(),
    resendCode: vi.fn(),
    signIn: vi.fn(),
    forgot: vi.fn(),
    reset: vi.fn(),
    refresh: vi.fn(),
    revoke: vi.fn(),
  },
}));

vi.mock("../../../src/alerts/pendingSubscribe", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../../src/alerts/pendingSubscribe")>();
  return { ...real, completePendingSubscribe: vi.fn(async () => {}) };
});

import { SignInPage } from "../../../src/pages/Auth/SignInPage";
import { SignUpPage } from "../../../src/pages/Auth/SignUpPage";
import { ConfirmPage } from "../../../src/pages/Auth/ConfirmPage";
import { ForgotPasswordPage } from "../../../src/pages/Auth/ForgotPasswordPage";
import { ResetPasswordPage } from "../../../src/pages/Auth/ResetPasswordPage";
import { cognito } from "../../../src/auth/cognito";
import { session, _resetSessionForTests } from "../../../src/auth/session";
import { clearPendingSignUp, setPendingSignUp } from "../../../src/pages/Auth/pendingSignUp";
import { copy } from "../../../src/copy/copy";
import {
  PENDING_SUBSCRIBE_KEY,
  completePendingSubscribe,
  readPendingSubscribe,
} from "../../../src/alerts/pendingSubscribe";
import { store } from "../../../src/store/useStore";
import { initialStore } from "../../../src/store/types";
import type { Snapshot } from "../../../src/contracts";

function LocationProbe() {
  const l = useLocation();
  return <div data-testid="here">{l.pathname}{l.search}</div>;
}

function renderAt(url: string, element: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/*" element={<>{element}<LocationProbe /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  _resetSessionForTests();
  clearPendingSignUp();
  window.localStorage.clear();
  for (const fn of Object.values(cognito)) (fn as ReturnType<typeof vi.fn>).mockReset();
  vi.mocked(completePendingSubscribe).mockClear();
});
afterEach(() => {
  cleanup();
  _resetSessionForTests();
  act(() => store.setState({ ...initialStore }));
});

function setSignUpsOpen(open: boolean) {
  act(() => store.setState({ snapshot: { schemaVersion: 1, signUpsOpen: open } as Snapshot }));
}

function linkHrefs(): string[] {
  return Array.from(screen.getByTestId("auth-links").querySelectorAll("a")).map((a) => a.getAttribute("href") ?? "");
}

describe("SignInPage", () => {
  it("stores tokens and navigates to returnTo on success", async () => {
    const exp = Date.now() + 3600_000;
    (cognito.signIn as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      idToken: "id", accessToken: "a", refreshToken: "r",
      email: "person@example", sub: "s", idExpiresAt: exp,
    });
    renderAt("/auth/sign-in?returnTo=%2Falerts", <SignInPage />);
    await userEvent.type(screen.getByLabelText(copy.auth.signIn.email), " Person@Example ");
    await userEvent.type(screen.getByLabelText(copy.auth.signIn.password), "hunter22hunter");
    await userEvent.click(screen.getByTestId("auth-submit"));
    await waitFor(() => expect(screen.getByTestId("here").textContent).toBe("/alerts"));
    expect(cognito.signIn).toHaveBeenCalledWith("person@example", "hunter22hunter");
    expect(session.current()?.idToken).toBe("id");
  });

  it("completes the sign-up alerts intent after the tokens are stored and before navigating", async () => {
    (cognito.signIn as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      idToken: "id", accessToken: "a", refreshToken: "r",
      email: "a@e.com", sub: "s", idExpiresAt: Date.now() + 3600_000,
    });
    let sessionAtCall: string | undefined;
    let hereAtCall: string | null = null;
    vi.mocked(completePendingSubscribe).mockImplementationOnce(async () => {
      sessionAtCall = session.current()?.idToken;
      hereAtCall = screen.getByTestId("here").textContent;
    });
    renderAt("/auth/sign-in?returnTo=%2Falerts", <SignInPage />);
    await userEvent.type(screen.getByLabelText(copy.auth.signIn.email), "a@e.com");
    await userEvent.type(screen.getByLabelText(copy.auth.signIn.password), "hunter22hunter");
    await userEvent.click(screen.getByTestId("auth-submit"));
    await waitFor(() => expect(screen.getByTestId("here").textContent).toBe("/alerts"));
    expect(completePendingSubscribe).toHaveBeenCalledTimes(1);
    expect(completePendingSubscribe).toHaveBeenCalledWith("a@e.com");
    expect(sessionAtCall).toBe("id");
    expect(hereAtCall).toBe("/auth/sign-in?returnTo=%2Falerts");
  });

  it("does not complete the intent when the sign-in fails", async () => {
    (cognito.signIn as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      Object.assign(new Error("x"), { name: "NotAuthorizedException" }),
    );
    renderAt("/auth/sign-in", <SignInPage />);
    await userEvent.type(screen.getByLabelText(copy.auth.signIn.email), "a@e.com");
    await userEvent.type(screen.getByLabelText(copy.auth.signIn.password), "hunter22hunter");
    await userEvent.click(screen.getByTestId("auth-submit"));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(completePendingSubscribe).not.toHaveBeenCalled();
  });

  it("shows 'wrong email or password' on either UserNotFound or NotAuthorized", async () => {
    (cognito.signIn as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      Object.assign(new Error("x"), { name: "NotAuthorizedException" }),
    );
    renderAt("/auth/sign-in", <SignInPage />);
    await userEvent.type(screen.getByLabelText(copy.auth.signIn.email), "a@e.com");
    await userEvent.type(screen.getByLabelText(copy.auth.signIn.password), "hunter22hunter");
    await userEvent.click(screen.getByTestId("auth-submit"));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(copy.auth.signIn.wrongCredentials),
    );
  });

  it("routes to /auth/confirm on UserNotConfirmedException with the email", async () => {
    (cognito.signIn as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      Object.assign(new Error("x"), { name: "UserNotConfirmedException" }),
    );
    renderAt("/auth/sign-in?returnTo=%2Falerts", <SignInPage />);
    await userEvent.type(screen.getByLabelText(copy.auth.signIn.email), "a@e.com");
    await userEvent.type(screen.getByLabelText(copy.auth.signIn.password), "hunter22hunter");
    await userEvent.click(screen.getByTestId("auth-submit"));
    await waitFor(() => {
      const here = screen.getByTestId("here").textContent ?? "";
      expect(here.startsWith("/auth/confirm")).toBe(true);
      expect(here).toContain("email=a%40e.com");
      expect(here).toContain("returnTo=%2Falerts");
    });
  });

  it("disables submit in flight", async () => {
    let resolveSignIn: (v: unknown) => void = () => {};
    (cognito.signIn as ReturnType<typeof vi.fn>).mockImplementationOnce(
      () => new Promise((r) => { resolveSignIn = r; }),
    );
    renderAt("/auth/sign-in", <SignInPage />);
    await userEvent.type(screen.getByLabelText(copy.auth.signIn.email), "a@e.com");
    await userEvent.type(screen.getByLabelText(copy.auth.signIn.password), "hunter22hunter");
    const submit = screen.getByTestId("auth-submit") as HTMLButtonElement;
    await userEvent.click(submit);
    expect(submit.disabled).toBe(true);
    await act(async () => {
      resolveSignIn({
        idToken: "id", accessToken: "a", refreshToken: "r",
        email: "a@e.com", sub: "s", idExpiresAt: Date.now() + 3600_000,
      });
    });
  });
});

describe("SignUpPage", () => {
  it("client-side rejects an obviously invalid address", async () => {
    renderAt("/auth/sign-up", <SignUpPage />);
    await userEvent.type(screen.getByLabelText(copy.auth.signUp.email), "not-an-address");
    await userEvent.type(screen.getByLabelText(copy.auth.signUp.password), "p".repeat(8));
    await userEvent.type(screen.getByLabelText(copy.auth.signUp.confirmPassword), "p".repeat(8));
    await userEvent.click(screen.getByTestId("auth-submit"));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(copy.auth.signUp.invalidEmail),
    );
    expect(cognito.signUp).not.toHaveBeenCalled();
  });

  it("client-side rejects a password shorter than 8 characters", async () => {
    renderAt("/auth/sign-up", <SignUpPage />);
    expect(screen.getByLabelText(copy.auth.signUp.password).getAttribute("minlength")).toBe("8");
    expect(screen.getByLabelText(copy.auth.signUp.confirmPassword).getAttribute("minlength")).toBe("8");
    await userEvent.type(screen.getByLabelText(copy.auth.signUp.email), "a@e.com");
    await userEvent.type(screen.getByLabelText(copy.auth.signUp.password), "p".repeat(7));
    await userEvent.type(screen.getByLabelText(copy.auth.signUp.confirmPassword), "p".repeat(7));
    await userEvent.click(screen.getByTestId("auth-submit"));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(copy.auth.signUp.passwordTooShort),
    );
    expect(cognito.signUp).not.toHaveBeenCalled();
  });

  it("client-side rejects mismatched passwords", async () => {
    renderAt("/auth/sign-up", <SignUpPage />);
    await userEvent.type(screen.getByLabelText(copy.auth.signUp.email), "a@e.com");
    await userEvent.type(screen.getByLabelText(copy.auth.signUp.password), "p".repeat(8));
    await userEvent.type(screen.getByLabelText(copy.auth.signUp.confirmPassword), "q".repeat(8));
    await userEvent.click(screen.getByTestId("auth-submit"));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(copy.auth.signUp.passwordsDoNotMatch),
    );
    expect(cognito.signUp).not.toHaveBeenCalled();
  });

  it("navigates to /auth/confirm with the email on success", async () => {
    (cognito.signUp as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
    renderAt("/auth/sign-up?returnTo=%2Falerts", <SignUpPage />);
    await userEvent.type(screen.getByLabelText(copy.auth.signUp.email), "  A@E.com  ");
    await userEvent.type(screen.getByLabelText(copy.auth.signUp.password), "p".repeat(8));
    await userEvent.type(screen.getByLabelText(copy.auth.signUp.confirmPassword), "p".repeat(8));
    await userEvent.click(screen.getByTestId("auth-submit"));
    await waitFor(() => {
      const here = screen.getByTestId("here").textContent ?? "";
      expect(here.startsWith("/auth/confirm")).toBe(true);
      expect(here).toContain("email=a%40e.com");
      expect(here).toContain("returnTo=%2Falerts");
    });
  });
});

describe("SignUpPage alerts box", () => {
  function setSubscriptionsOpen(open: boolean) {
    act(() => store.setState({ snapshot: { schemaVersion: 1, subscriptionsOpen: open } as Snapshot }));
  }

  async function fillAndSubmit() {
    await userEvent.type(screen.getByLabelText(copy.auth.signUp.email), " A@E.com ");
    await userEvent.type(screen.getByLabelText(copy.auth.signUp.password), "p".repeat(8));
    await userEvent.type(screen.getByLabelText(copy.auth.signUp.confirmPassword), "p".repeat(8));
    await userEvent.click(screen.getByTestId("auth-submit"));
  }

  it("renders the box checked under the confirm-password field with its copy", () => {
    renderAt("/auth/sign-up", <SignUpPage />);
    expect(copy.auth.signUp.alerts).toBe("Email me when Santa is scheduled and when he lifts off");
    const box = screen.getByLabelText(copy.auth.signUp.alerts) as HTMLInputElement;
    expect(box.type).toBe("checkbox");
    expect(box.checked).toBe(true);
    const confirm = screen.getByLabelText(copy.auth.signUp.confirmPassword);
    expect(confirm.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("hides the box while subscriptions are closed and stores no intent", async () => {
    setSubscriptionsOpen(false);
    (cognito.signUp as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
    renderAt("/auth/sign-up", <SignUpPage />);
    expect(screen.queryByTestId("auth-sign-up-alerts")).toBeNull();
    await fillAndSubmit();
    await waitFor(() => expect(screen.getByTestId("here").textContent).toContain("/auth/confirm"));
    expect(readPendingSubscribe()).toBeNull();
  });

  it("stores the intent after a successful sign-up while checked", async () => {
    (cognito.signUp as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
    renderAt("/auth/sign-up", <SignUpPage />);
    await fillAndSubmit();
    await waitFor(() => expect(screen.getByTestId("here").textContent).toContain("/auth/confirm"));
    expect(readPendingSubscribe()).toBe("a@e.com");
    expect(window.localStorage.getItem(PENDING_SUBSCRIBE_KEY)).toBe("a@e.com");
  });

  it("stores no intent while unchecked", async () => {
    (cognito.signUp as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
    renderAt("/auth/sign-up", <SignUpPage />);
    await userEvent.click(screen.getByLabelText(copy.auth.signUp.alerts));
    expect((screen.getByLabelText(copy.auth.signUp.alerts) as HTMLInputElement).checked).toBe(false);
    await fillAndSubmit();
    await waitFor(() => expect(screen.getByTestId("here").textContent).toContain("/auth/confirm"));
    expect(readPendingSubscribe()).toBeNull();
  });

  it("stores no intent when the sign-up fails", async () => {
    (cognito.signUp as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      Object.assign(new Error("x"), { name: "UsernameExistsException" }),
    );
    renderAt("/auth/sign-up", <SignUpPage />);
    await fillAndSubmit();
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(readPendingSubscribe()).toBeNull();
  });

  it("stores no intent when the client checks fail", async () => {
    renderAt("/auth/sign-up", <SignUpPage />);
    await userEvent.type(screen.getByLabelText(copy.auth.signUp.email), "a@e.com");
    await userEvent.type(screen.getByLabelText(copy.auth.signUp.password), "short");
    await userEvent.type(screen.getByLabelText(copy.auth.signUp.confirmPassword), "short");
    await userEvent.click(screen.getByTestId("auth-submit"));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(cognito.signUp).not.toHaveBeenCalled();
    expect(readPendingSubscribe()).toBeNull();
  });
});

describe("ConfirmPage", () => {
  it("with a pending sign-up in memory, confirms and signs in directly, landing on returnTo", async () => {
    setPendingSignUp("a@e.com", "hunter22hunter");
    (cognito.confirm as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
    const exp = Date.now() + 3600_000;
    (cognito.signIn as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      idToken: "id", accessToken: "a", refreshToken: "r",
      email: "a@e.com", sub: "s", idExpiresAt: exp,
    });
    renderAt("/auth/confirm?email=a%40e.com&returnTo=%2Falerts", <ConfirmPage />);
    await userEvent.type(screen.getByLabelText(copy.auth.confirm.code), "123456");
    await userEvent.click(screen.getByTestId("auth-submit"));
    await waitFor(() => expect(screen.getByTestId("here").textContent).toBe("/alerts"));
    expect(cognito.signIn).toHaveBeenCalledWith("a@e.com", "hunter22hunter");
    expect(session.current()?.email).toBe("a@e.com");
    expect(completePendingSubscribe).toHaveBeenCalledTimes(1);
    expect(completePendingSubscribe).toHaveBeenCalledWith("a@e.com");
  });

  it("without a pending sign-up shows 'Your account is ready' with a Sign in button that keeps returnTo, and completes no intent", async () => {
    (cognito.confirm as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
    renderAt("/auth/confirm?email=a%40e.com&returnTo=%2Falerts", <ConfirmPage />);
    await userEvent.type(screen.getByLabelText(copy.auth.confirm.code), "123456");
    await userEvent.click(screen.getByTestId("auth-submit"));
    await waitFor(() =>
      expect(screen.getByText(copy.auth.confirm.confirmed)).toBeTruthy(),
    );
    expect(copy.auth.confirm.confirmed).toBe("Your account is ready");
    const link = screen.getByTestId("auth-submit") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toContain("/auth/sign-in");
    expect(link.getAttribute("href")).toContain("returnTo=%2Falerts");
    expect(completePendingSubscribe).not.toHaveBeenCalled();
  });

  it("names the code on CodeMismatchException", async () => {
    (cognito.confirm as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      Object.assign(new Error("x"), { name: "CodeMismatchException" }),
    );
    renderAt("/auth/confirm?email=a%40e.com", <ConfirmPage />);
    await userEvent.type(screen.getByLabelText(copy.auth.confirm.code), "000000");
    await userEvent.click(screen.getByTestId("auth-submit"));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(copy.auth.confirm.codeBad),
    );
  });
});

describe("ForgotPasswordPage", () => {
  it("navigates to /auth/reset with the same copy on success", async () => {
    (cognito.forgot as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
    renderAt("/auth/forgot", <ForgotPasswordPage />);
    await userEvent.type(screen.getByLabelText(copy.auth.forgot.email), "a@e.com");
    await userEvent.click(screen.getByTestId("auth-submit"));
    await waitFor(() =>
      expect(screen.getByTestId("here").textContent).toContain("/auth/reset"),
    );
  });

  it("navigates to /auth/reset with the same copy for unknown addresses (no enumeration)", async () => {
    (cognito.forgot as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      Object.assign(new Error("x"), { name: "UserNotFoundException" }),
    );
    renderAt("/auth/forgot", <ForgotPasswordPage />);
    await userEvent.type(screen.getByLabelText(copy.auth.forgot.email), "who@e.com");
    await userEvent.click(screen.getByTestId("auth-submit"));
    await waitFor(() =>
      expect(screen.getByTestId("here").textContent).toContain("/auth/reset"),
    );
  });

  it("shows 'Too many attempts' on LimitExceededException", async () => {
    (cognito.forgot as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      Object.assign(new Error("x"), { name: "LimitExceededException" }),
    );
    renderAt("/auth/forgot", <ForgotPasswordPage />);
    await userEvent.type(screen.getByLabelText(copy.auth.forgot.email), "a@e.com");
    await userEvent.click(screen.getByTestId("auth-submit"));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(copy.auth.errors.tooMany),
    );
  });
});

describe("ResetPasswordPage", () => {
  it("shows 'Password changed' and a Sign in button on success", async () => {
    (cognito.reset as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
    renderAt("/auth/reset?email=a%40e.com", <ResetPasswordPage />);
    await userEvent.type(screen.getByLabelText(copy.auth.reset.code), "123456");
    await userEvent.type(screen.getByLabelText(copy.auth.reset.password), "p".repeat(8));
    await userEvent.type(screen.getByLabelText(copy.auth.reset.confirmPassword), "p".repeat(8));
    await userEvent.click(screen.getByTestId("auth-submit"));
    await waitFor(() =>
      expect(screen.getByText(copy.auth.reset.changed)).toBeTruthy(),
    );
    const link = screen.getByTestId("auth-submit") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toContain("/auth/sign-in");
  });

  it("client-side rejects mismatched passwords", async () => {
    renderAt("/auth/reset?email=a%40e.com", <ResetPasswordPage />);
    await userEvent.type(screen.getByLabelText(copy.auth.reset.code), "123456");
    await userEvent.type(screen.getByLabelText(copy.auth.reset.password), "p".repeat(8));
    await userEvent.type(screen.getByLabelText(copy.auth.reset.confirmPassword), "q".repeat(8));
    await userEvent.click(screen.getByTestId("auth-submit"));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(copy.auth.signUp.passwordsDoNotMatch),
    );
    expect(cognito.reset).not.toHaveBeenCalled();
  });
});

describe("the 8 character minimum", () => {
  it("reads 'Password must be at least 8 characters' in both copies", () => {
    expect(copy.auth.signUp.passwordTooShort).toBe("Password must be at least 8 characters");
    expect(copy.auth.signUp.invalidPassword).toBe("Password must be at least 8 characters");
  });

  it("sign-up accepts exactly 8 characters", async () => {
    (cognito.signUp as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
    renderAt("/auth/sign-up", <SignUpPage />);
    await userEvent.type(screen.getByLabelText(copy.auth.signUp.email), "a@e.com");
    await userEvent.type(screen.getByLabelText(copy.auth.signUp.password), "p".repeat(8));
    await userEvent.type(screen.getByLabelText(copy.auth.signUp.confirmPassword), "p".repeat(8));
    await userEvent.click(screen.getByTestId("auth-submit"));
    await waitFor(() => expect(cognito.signUp).toHaveBeenCalledWith("a@e.com", "p".repeat(8)));
  });

  it("reset rejects 7 characters, accepts 8, and sets minlength 8", async () => {
    renderAt("/auth/reset?email=a%40e.com", <ResetPasswordPage />);
    expect(screen.getByLabelText(copy.auth.reset.password).getAttribute("minlength")).toBe("8");
    expect(screen.getByLabelText(copy.auth.reset.confirmPassword).getAttribute("minlength")).toBe("8");
    await userEvent.type(screen.getByLabelText(copy.auth.reset.code), "123456");
    await userEvent.type(screen.getByLabelText(copy.auth.reset.password), "p".repeat(7));
    await userEvent.type(screen.getByLabelText(copy.auth.reset.confirmPassword), "p".repeat(7));
    await userEvent.click(screen.getByTestId("auth-submit"));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(copy.auth.signUp.passwordTooShort),
    );
    expect(cognito.reset).not.toHaveBeenCalled();
    (cognito.reset as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
    await userEvent.type(screen.getByLabelText(copy.auth.reset.password), "p");
    await userEvent.type(screen.getByLabelText(copy.auth.reset.confirmPassword), "p");
    await userEvent.click(screen.getByTestId("auth-submit"));
    await waitFor(() => expect(cognito.reset).toHaveBeenCalledWith("a@e.com", "123456", "p".repeat(8)));
  });
});

describe("sign-ups closed (snapshot.signUpsOpen false)", () => {
  it("the sign-up route shows the closed line and a sign-in link in place of the form", () => {
    setSignUpsOpen(false);
    renderAt("/auth/sign-up?returnTo=%2Falerts", <SignUpPage />);
    expect(screen.getByTestId("auth-card")).toBeTruthy();
    expect(screen.getByTestId("auth-sign-ups-closed").textContent).toBe("Sign-ups are closed for now");
    const signIn = screen.getByTestId("auth-sign-ups-closed-sign-in");
    expect(signIn.getAttribute("href")).toBe("/auth/sign-in?returnTo=%2Falerts");
    expect(screen.queryByTestId("auth-submit")).toBeNull();
    expect(document.querySelector("form")).toBeNull();
    expect(screen.queryByLabelText(copy.auth.signUp.password)).toBeNull();
  });

  it("the sign-up form renders while signUpsOpen is true", () => {
    setSignUpsOpen(true);
    renderAt("/auth/sign-up", <SignUpPage />);
    expect(screen.queryByTestId("auth-sign-ups-closed")).toBeNull();
    expect(screen.getByTestId("auth-submit")).toBeTruthy();
  });

  it("sign-in and forgot-password render no sign-up link", () => {
    setSignUpsOpen(false);
    renderAt("/auth/sign-in", <SignInPage />);
    expect(linkHrefs().some((h) => h.startsWith("/auth/sign-up"))).toBe(false);
    expect(screen.getByTestId("auth-submit")).toBeTruthy();
    cleanup();
    renderAt("/auth/forgot", <ForgotPasswordPage />);
    expect(linkHrefs().some((h) => h.startsWith("/auth/sign-up"))).toBe(false);
    expect(screen.getByTestId("auth-submit")).toBeTruthy();
  });

  it("sign-in and forgot-password keep the sign-up link while sign-ups are open", () => {
    setSignUpsOpen(true);
    renderAt("/auth/sign-in", <SignInPage />);
    expect(linkHrefs().some((h) => h.startsWith("/auth/sign-up"))).toBe(true);
    cleanup();
    renderAt("/auth/forgot", <ForgotPasswordPage />);
    expect(linkHrefs().some((h) => h.startsWith("/auth/sign-up"))).toBe(true);
  });
});
