// docs/site.md section 11.3. AuthProvider reads session.current() at
// mount, subscribes to session changes, and moves between signedOut and
// signedIn without a reload.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider, useAuth } from "../../../src/auth/AuthProvider";
import { session, _resetSessionForTests } from "../../../src/auth/session";

function Probe() {
  const { state } = useAuth();
  return (
    <output data-testid="status">
      {state.status}
      {state.status === "signedIn" ? `:${state.email}` : ""}
    </output>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    _resetSessionForTests();
  });
  afterEach(() => {
    cleanup();
    _resetSessionForTests();
  });

  it("starts signedOut with no stored session", async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </MemoryRouter>,
    );
    await act(async () => {});
    expect(screen.getByTestId("status")).toHaveTextContent("signedOut");
  });

  it("moves to signedIn when session.set is called", async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </MemoryRouter>,
    );
    await act(async () => {});
    expect(screen.getByTestId("status")).toHaveTextContent("signedOut");

    await act(async () => {
      session.set({
        idToken: "id",
        accessToken: "a",
        refreshToken: "r",
        email: "person@example",
        sub: "s",
        idExpiresAt: Date.now() + 3600_000,
      });
    });
    expect(screen.getByTestId("status")).toHaveTextContent("signedIn:person@example");

    await act(async () => {
      session.clear();
    });
    expect(screen.getByTestId("status")).toHaveTextContent("signedOut");
  });

  it("hydrates from a stored session at boot", async () => {
    window.localStorage.setItem(
      "wmsfo.auth.session",
      JSON.stringify({
        idToken: "id",
        accessToken: "a",
        refreshToken: "r",
        email: "stored@example",
        sub: "s",
        idExpiresAt: Date.now() + 3600_000,
      }),
    );
    render(
      <MemoryRouter>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </MemoryRouter>,
    );
    await act(async () => {});
    expect(screen.getByTestId("status")).toHaveTextContent("signedIn:stored@example");
  });
});
