// docs/site.md section 11.3. AuthProvider reads session.current() at mount,
// subscribes to session changes (sign-in, refresh, sign-out, refresh
// failure), and exposes useAuth() with the state plus signIn(returnTo)
// (navigates to /auth/sign-in?returnTo=...) and signOut() (best-effort
// revoke, session.clear(), stay on the current page).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { session } from "./session";

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

function readState(): AuthState {
  const s = session.current();
  if (s === null) return { status: "signedOut" };
  return {
    status: "signedIn",
    email: s.email,
    expired: s.idExpiresAt - Date.now() <= 0,
  };
}

export type AuthProviderProps = {
  children: ReactNode;
  initialState?: AuthState;
};

export function AuthProvider({ children, initialState }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>(
    initialState ?? (session.hasStored() ? { status: "unknown" } : { status: "signedOut" }),
  );
  const navigate = useNavigate();

  useEffect(() => {
    // When a caller passes initialState (unit tests, storybook), respect it
    // and only reconcile with the session on subsequent changes. Without
    // an initialState the mount hydrates from storage.
    if (initialState === undefined) setState(readState());
    const off = session.subscribe(() => setState(readState()));
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = useCallback(
    async (returnTo: string) => {
      const target = `/auth/sign-in${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`;
      navigate(target);
    },
    [navigate],
  );

  const signOut = useCallback(async () => {
    const s = session.current();
    if (s !== null) {
      const mod = await import("./cognito");
      void mod.cognito.revoke(s.refreshToken);
    }
    session.clear();
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
