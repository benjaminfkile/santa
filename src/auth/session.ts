// docs/site.md sections 11.1 and 11.3. Session store: holds the Tokens
// returned by cognito.signIn / cognito.refresh in localStorage, exposes a
// synchronous read for the boot check, notifies subscribers on every
// change (sign-in, refresh, clear).
//
// The cognito wrapper is imported dynamically so that AuthProvider and the
// API client can read the session, subscribe, and call getIdToken without
// pulling amazon-cognito-identity-js into the main chunk. It only lands
// when the site actually needs to refresh or sign in.

import { storageGet, storageRemove, storageSet } from "../lib/storage";

const STORAGE_KEY = "wmsfo.auth.session";

export type Tokens = {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  email: string;
  sub: string;
  idExpiresAt: number;
};

export type SessionListener = () => void;

let cached: Tokens | null | undefined;
const listeners = new Set<SessionListener>();

function readFromStorage(): Tokens | null {
  const raw = storageGet(STORAGE_KEY);
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Tokens>;
    if (
      typeof parsed.idToken === "string" &&
      typeof parsed.accessToken === "string" &&
      typeof parsed.refreshToken === "string" &&
      typeof parsed.email === "string" &&
      typeof parsed.sub === "string" &&
      typeof parsed.idExpiresAt === "number"
    ) {
      return parsed as Tokens;
    }
    return null;
  } catch {
    return null;
  }
}

function fire(): void {
  for (const l of listeners) l();
}

export const session = {
  current(): Tokens | null {
    if (cached === undefined) cached = readFromStorage();
    return cached;
  },
  set(tokens: Tokens): void {
    cached = tokens;
    storageSet(STORAGE_KEY, JSON.stringify(tokens));
    fire();
  },
  clear(): void {
    cached = null;
    storageRemove(STORAGE_KEY);
    fire();
  },
  subscribe(l: SessionListener): () => void {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  hasStored(): boolean {
    return storageGet(STORAGE_KEY) !== null;
  },
};

export class SignInRequired extends Error {
  constructor() {
    super("sign_in_required");
    this.name = "SignInRequired";
  }
}

// docs/site.md 11.4. Read before every API call; never cached by the API
// client. Refreshes when the ID token is inside its last minute; on refresh
// failure clears the session and throws SignInRequired.
export async function getIdToken(): Promise<string> {
  const s = session.current();
  if (s === null) throw new SignInRequired();
  if (s.idExpiresAt - Date.now() < 60_000) {
    try {
      const { cognito } = await import("./cognito");
      const next = await cognito.refresh(s.email, s.refreshToken);
      session.set(next);
    } catch {
      session.clear();
      throw new SignInRequired();
    }
  }
  const after = session.current();
  if (after === null) throw new SignInRequired();
  return after.idToken;
}

// Force a refresh on demand (used by the API client to retry a 401 once).
export async function refreshNow(): Promise<string> {
  const s = session.current();
  if (s === null) throw new SignInRequired();
  try {
    const { cognito } = await import("./cognito");
    const next = await cognito.refresh(s.email, s.refreshToken);
    session.set(next);
    return next.idToken;
  } catch {
    session.clear();
    throw new SignInRequired();
  }
}

export function _resetSessionForTests(): void {
  cached = undefined;
  listeners.clear();
  storageRemove(STORAGE_KEY);
}
