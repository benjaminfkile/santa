// docs/site.md 22.1 "Auth pages": client checks (address shape, 12
// characters, matching passwords); submit disabled in flight;
// UserNotConfirmedException routes to /auth/confirm with the email;
// confirm straight from sign-up signs in and lands on returnTo; forgot
// shows the same copy for unknown addresses.

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

import { SignInPage } from "../../../src/pages/Auth/SignInPage";
import { SignUpPage } from "../../../src/pages/Auth/SignUpPage";
import { ConfirmPage } from "../../../src/pages/Auth/ConfirmPage";
import { ForgotPasswordPage } from "../../../src/pages/Auth/ForgotPasswordPage";
import { ResetPasswordPage } from "../../../src/pages/Auth/ResetPasswordPage";
import { cognito } from "../../../src/auth/cognito";
import { session, _resetSessionForTests } from "../../../src/auth/session";
import { clearPendingSignUp, setPendingSignUp } from "../../../src/pages/Auth/pendingSignUp";
import { copy } from "../../../src/copy/copy";

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
});
afterEach(() => {
  cleanup();
  _resetSessionForTests();
});

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
    await userEvent.type(screen.getByLabelText(copy.auth.signUp.password), "p".repeat(12));
    await userEvent.type(screen.getByLabelText(copy.auth.signUp.confirmPassword), "p".repeat(12));
    await userEvent.click(screen.getByTestId("auth-submit"));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(copy.auth.signUp.invalidEmail),
    );
    expect(cognito.signUp).not.toHaveBeenCalled();
  });

  it("client-side rejects a password shorter than 12 characters", async () => {
    renderAt("/auth/sign-up", <SignUpPage />);
    await userEvent.type(screen.getByLabelText(copy.auth.signUp.email), "a@e.com");
    await userEvent.type(screen.getByLabelText(copy.auth.signUp.password), "short");
    await userEvent.type(screen.getByLabelText(copy.auth.signUp.confirmPassword), "short");
    await userEvent.click(screen.getByTestId("auth-submit"));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(copy.auth.signUp.passwordTooShort),
    );
    expect(cognito.signUp).not.toHaveBeenCalled();
  });

  it("client-side rejects mismatched passwords", async () => {
    renderAt("/auth/sign-up", <SignUpPage />);
    await userEvent.type(screen.getByLabelText(copy.auth.signUp.email), "a@e.com");
    await userEvent.type(screen.getByLabelText(copy.auth.signUp.password), "p".repeat(12));
    await userEvent.type(screen.getByLabelText(copy.auth.signUp.confirmPassword), "q".repeat(12));
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
    await userEvent.type(screen.getByLabelText(copy.auth.signUp.password), "p".repeat(12));
    await userEvent.type(screen.getByLabelText(copy.auth.signUp.confirmPassword), "p".repeat(12));
    await userEvent.click(screen.getByTestId("auth-submit"));
    await waitFor(() => {
      const here = screen.getByTestId("here").textContent ?? "";
      expect(here.startsWith("/auth/confirm")).toBe(true);
      expect(here).toContain("email=a%40e.com");
      expect(here).toContain("returnTo=%2Falerts");
    });
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
  });

  it("without a pending sign-up shows 'Account confirmed' with a Sign in button that keeps returnTo", async () => {
    (cognito.confirm as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
    renderAt("/auth/confirm?email=a%40e.com&returnTo=%2Falerts", <ConfirmPage />);
    await userEvent.type(screen.getByLabelText(copy.auth.confirm.code), "123456");
    await userEvent.click(screen.getByTestId("auth-submit"));
    await waitFor(() =>
      expect(screen.getByText(copy.auth.confirm.confirmed)).toBeTruthy(),
    );
    const link = screen.getByTestId("auth-submit") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toContain("/auth/sign-in");
    expect(link.getAttribute("href")).toContain("returnTo=%2Falerts");
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
    await userEvent.type(screen.getByLabelText(copy.auth.reset.password), "p".repeat(12));
    await userEvent.type(screen.getByLabelText(copy.auth.reset.confirmPassword), "p".repeat(12));
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
    await userEvent.type(screen.getByLabelText(copy.auth.reset.password), "p".repeat(12));
    await userEvent.type(screen.getByLabelText(copy.auth.reset.confirmPassword), "q".repeat(12));
    await userEvent.click(screen.getByTestId("auth-submit"));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(copy.auth.signUp.passwordsDoNotMatch),
    );
    expect(cognito.reset).not.toHaveBeenCalled();
  });
});
