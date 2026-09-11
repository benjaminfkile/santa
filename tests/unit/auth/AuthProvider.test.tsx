// docs/site.md section 11.3. AuthProvider attaches to the user manager as
// soon as it exists, whichever caller loads it. The case that matters is
// the callback page: no session is stored when the page boots, the
// provider starts signedOut, AuthCallback loads the manager and completes
// the sign-in, and the provider must land on signedIn without a reload.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";

type Handler = (...args: unknown[]) => void;

const fake = vi.hoisted(() => {
  const handlers: Record<string, Set<Handler>> = {};
  const on = (name: string) => (h: Handler) => {
    (handlers[name] ??= new Set()).add(h);
  };
  const off = (name: string) => (h: Handler) => {
    handlers[name]?.delete(h);
  };
  let user: { profile: { email: string }; expired: boolean } | null = null;
  return {
    handlers,
    setUser(u: typeof user) {
      user = u;
    },
    fire(name: string, ...args: unknown[]) {
      for (const h of handlers[name] ?? []) h(...args);
    },
    UserManager: class {
      events = {
        addUserLoaded: on("loaded"),
        removeUserLoaded: off("loaded"),
        addUserUnloaded: on("unloaded"),
        removeUserUnloaded: off("unloaded"),
        addUserSignedOut: on("signedOut"),
        removeUserSignedOut: off("signedOut"),
        addSilentRenewError: on("silentError"),
        removeSilentRenewError: off("silentError"),
      };
      getUser() {
        return Promise.resolve(user);
      }
    },
    WebStorageStateStore: class {
      constructor(_opts: unknown) {}
    },
  };
});

vi.mock("oidc-client-ts", () => ({
  UserManager: fake.UserManager,
  WebStorageStateStore: fake.WebStorageStateStore,
}));

import { AuthProvider, useAuth } from "../../../src/auth/AuthProvider";
import {
  getUserManager,
  _resetUserManagerForTests,
} from "../../../src/auth/userManager";

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
    _resetUserManagerForTests();
    window.localStorage.clear();
    for (const k of Object.keys(fake.handlers)) delete fake.handlers[k];
    fake.setUser(null);
  });
  afterEach(() => {
    cleanup();
  });

  it("starts signedOut with no stored session and does not load the manager", async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await act(async () => {});
    expect(screen.getByTestId("status")).toHaveTextContent("signedOut");
    expect(fake.handlers.loaded ?? new Set()).toHaveLength(0);
  });

  it("moves to signedIn when another caller loads the manager and a user loads", async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await act(async () => {});
    expect(screen.getByTestId("status")).toHaveTextContent("signedOut");

    // What AuthCallback does: load the manager, complete the redirect,
    // which stores the user and fires userLoaded.
    await act(async () => {
      await getUserManager();
    });
    expect(fake.handlers.loaded).toHaveLength(1);
    await act(async () => {
      fake.setUser({ profile: { email: "person@example" }, expired: false });
      fake.fire("loaded", { profile: { email: "person@example" }, expired: false });
    });
    expect(screen.getByTestId("status")).toHaveTextContent("signedIn:person@example");

    await act(async () => {
      fake.fire("signedOut");
    });
    expect(screen.getByTestId("status")).toHaveTextContent("signedOut");
  });

  it("hydrates from a stored session at boot", async () => {
    window.localStorage.setItem(
      "oidc.user:https://cognito.example/authority:clientid",
      "{}",
    );
    fake.setUser({ profile: { email: "stored@example" }, expired: false });
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(screen.getByTestId("status")).toHaveTextContent("unknown");
    await act(async () => {});
    await act(async () => {});
    expect(screen.getByTestId("status")).toHaveTextContent("signedIn:stored@example");
  });
});
