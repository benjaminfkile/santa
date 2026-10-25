// docs/site.md section 11.3. AuthProvider subscribes to session changes
// (sign-in, refresh, restore, sign-out, refresh failure), reads the stored
// session back through session.restore() at mount, and exposes useAuth() with the state plus signIn(returnTo)
// (navigates to /auth/sign-in?returnTo=...) and signOut() (best-effort
// revoke, session.clear(), stay on the current page). A session the API
// ended with `403 blocked` sends the visitor to the sign-in card with
// returnTo the current page, where the blocked notice shows (site.md 19).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
  const location = useLocation();
  const here = useRef(location.pathname + location.search);
  useEffect(() => {
    here.current = location.pathname + location.search;
  }, [location.pathname, location.search]);

  useEffect(() => {
    // When a caller passes initialState (unit tests, storybook), respect it
    // and only reconcile with the session on subsequent changes. Without
    // an initialState the mount hydrates from storage.
    const off = session.subscribe((reason) => {
      setState(readState());
      // The auth pages show the notice themselves.
      if (reason === "clear" && session.notice() === "blocked" && !here.current.startsWith("/auth/")) {
        navigate(`/auth/sign-in?returnTo=${encodeURIComponent(here.current)}`);
      }
    });
    if (initialState === undefined) {
      session.restore();
      setState(readState());
    }
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

  const value = useMemo(() => ({ state, signIn, signOut }), [state, signIn, signOut]);

  return (
    <AuthContext.Provider value={value}>
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
