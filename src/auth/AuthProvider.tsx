// docs/site.md section 11.3. AuthProvider subscribes to userManager
// events and exposes `useAuth()` with the current auth state plus the
// sign-in / sign-out actions.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User, UserManager } from "oidc-client-ts";
import { getUserManager, hasStoredSession, onUserManagerReady } from "./userManager";
import { signIn as signInAction, signOut as signOutAction } from "./signOut";

export type AuthState =
  | { status: "unknown" }
  | { status: "signedOut" }
  | { status: "signedIn"; email: string; expired: boolean };

export type AuthValue = {
  state: AuthState;
  signIn: (returnTo: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

function fromUser(user: User | null | undefined): AuthState {
  if (user === null || user === undefined) return { status: "signedOut" };
  const email =
    (user.profile as { email?: unknown } | undefined)?.email;
  return {
    status: "signedIn",
    email: typeof email === "string" ? email : "",
    expired: user.expired ?? false,
  };
}

export type AuthProviderProps = {
  children: ReactNode;
  initialState?: AuthState;
};

export function AuthProvider({ children, initialState }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>(
    initialState ?? (hasStoredSession() ? { status: "unknown" } : { status: "signedOut" }),
  );

  // Attach to the user manager as soon as it exists, whoever loads it:
  // this provider (when a session is stored at boot) or AuthCallback
  // (when a sign-in is completing). The subscriptions are what move the
  // state to signedIn without a reload.
  useEffect(() => {
    let alive = true;
    const unsubs: Array<() => void> = [];
    const attach = (um: UserManager) => {
      if (!alive) return;
      void um.getUser().then((user) => {
        if (alive) setState(fromUser(user));
      });
      const onLoaded = (user: User) => setState(fromUser(user));
      const onUnloaded = () => setState({ status: "signedOut" });
      const onSignedOut = () => setState({ status: "signedOut" });
      const onSilentError = () => {
        void um.getUser().then((u) => {
          if (!alive) return;
          if (u === null || u === undefined) {
            setState({ status: "signedOut" });
            return;
          }
          const base = fromUser(u);
          setState(base.status === "signedIn" ? { ...base, expired: true } : base);
        });
      };
      um.events.addUserLoaded(onLoaded);
      um.events.addUserUnloaded(onUnloaded);
      um.events.addUserSignedOut(onSignedOut);
      um.events.addSilentRenewError(onSilentError);
      unsubs.push(
        () => um.events.removeUserLoaded(onLoaded),
        () => um.events.removeUserUnloaded(onUnloaded),
        () => um.events.removeUserSignedOut(onSignedOut),
        () => um.events.removeSilentRenewError(onSilentError),
      );
    };
    const stop = onUserManagerReady(attach);
    if (hasStoredSession()) void getUserManager();
    return () => {
      alive = false;
      stop();
      for (const fn of unsubs) fn();
    };
  }, []);

  const signIn = useCallback(async (returnTo: string) => {
    await signInAction(returnTo);
  }, []);
  const signOut = useCallback(async () => {
    await signOutAction();
  }, []);

  return (
    <AuthContext.Provider value={{ state, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (value === null) {
    return {
      state: { status: "signedOut" },
      signIn: async () => {},
      signOut: async () => {},
    };
  }
  return value;
}
