// docs/site.md sections 6.1 step 4 and 7.7, The subscription flag.
// `SubscriptionProvider` holds the flag of `subscriptionFlag.ts` and
// exposes `useSubscription()` with `{ flag, setFlag, clearFlag }`.
// `setFlag` and `clearFlag` write storage and the state together. The
// flag is cleared on sign-out (the auth state `signedOut`) and whenever
// the signed-in account is not the flag's `account`.
//
// The one read, `GET /me`, at most once per page load per
// account, in two cases: (a) the visitor signs in during this page load
// (a `session` change with the reason "signIn"), and (b) once the first
// live object has applied, while the visitor is signed in (a restored
// session included, with or without a flag). On the answer a non-null
// `subscription` rewrites the flag for the account (verified: active;
// unverified: pending), a null one clears any flag for the account, and a
// non-null `seenUpToId` raises the read marker of `seenMarker.ts` (never
// lowers it). Non-null `preferences` are applied to the theme and the
// tracker choices (src/account/preferences.ts); null ones with a local
// choice seed the account with one `PUT /me/preferences`. `SignInRequired`
// or any failure leaves the flag, the marker, and the choices as they were.
// Signed out: no call; route changes and store updates never call again.
// A flag written through `setFlag` (a row the API just returned) marks
// its account checked, so a sign-up or an adopted row never triggers a
// second read. A flag written outside the provider (`writeFlag` from the
// sign-up alerts intent, `pendingSubscribe.ts`) reaches the state through
// `onFlagChange`, and a read whose answer lands after a newer flag write
// leaves the flag as it is. The provider also runs the preferences sync
// (`startPreferencesSync`) for as long as it is mounted, saving changes
// while the visitor is signed in.

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
import { useAuth } from "../auth/AuthProvider";
import { getMe } from "../api/subscriptions";
import {
  applyServerPreferences,
  hasChoice,
  localPreferences,
  pushPreferences,
  serverPreferences,
  startPreferencesSync,
} from "../account/preferences";
import { session } from "../auth/session";
import { useStore } from "../store/useStore";
import { seenMarker } from "./seenMarker";
import {
  flagFromRow,
  onFlagChange,
  readFlag,
  removeFlag,
  writeFlag,
  type SubscriptionFlag,
} from "./subscriptionFlag";

export type SubscriptionValue = {
  flag: SubscriptionFlag | null;
  setFlag: (flag: SubscriptionFlag) => void;
  clearFlag: () => void;
};

const SubscriptionContext = createContext<SubscriptionValue | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { state: auth } = useAuth();
  const account = auth.status === "signedIn" ? auth.email : null;
  const signedOut = auth.status === "signedOut";
  const liveApplied = useStore((s) => s.live !== null);
  const [flag, setFlagState] = useState<SubscriptionFlag | null>(() => readFlag());
  // The accounts already read during this page load.
  const checkedRef = useRef(new Set<string>());
  // The signed-in account; an answer that lands after it changed is dropped.
  const accountRef = useRef<string | null>(account);
  // Counts flag writes, so a read can tell a flag written after it started.
  const writesRef = useRef(0);

  useEffect(
    () =>
      onFlagChange(() => {
        writesRef.current += 1;
        setFlagState(readFlag());
      }),
    [],
  );

  // A flag written during the session comes from a row the API just
  // returned, so that account counts as checked for this page load.
  const setFlag = useCallback((next: SubscriptionFlag) => {
    checkedRef.current.add(next.account);
    writeFlag(next);
    setFlagState(next);
  }, []);

  const clearFlag = useCallback(() => {
    removeFlag();
    setFlagState(null);
  }, []);

  useEffect(() => {
    accountRef.current = account;
  }, [account]);

  // Saves the theme and tracker choices while signed in.
  useEffect(() => startPreferencesSync(() => accountRef.current !== null), []);

  // Sign-out, or another account signed in, clears the flag.
  useEffect(() => {
    if (flag === null) return;
    if (signedOut || (account !== null && flag.account !== account)) clearFlag();
  }, [flag, account, signedOut, clearFlag]);

  // The one read for an account; an answer that lands after the
  // signed-in account changed is dropped.
  const readOnce = useCallback(
    (forAccount: string) => {
      if (checkedRef.current.has(forAccount)) return;
      checkedRef.current.add(forAccount);
      const writesAtStart = writesRef.current;
      void (async () => {
        try {
          const res = await getMe();
          if (accountRef.current !== forAccount) return;
          const prefs = serverPreferences(res);
          if (prefs !== null) applyServerPreferences(prefs);
          else if (hasChoice(localPreferences())) pushPreferences();
          const row = res.subscription ?? null;
          if (writesRef.current !== writesAtStart) {
            // A newer flag was written while the read was in flight.
          } else if (row !== null) setFlag(flagFromRow(forAccount, row));
          else if (readFlag()?.account === forAccount) clearFlag();
          const seenUpTo = toId(res.seenUpToId);
          if (seenUpTo !== null) seenMarker.raise(seenUpTo);
        } catch {
          // SignInRequired or a failure leaves the flag, the marker, and the choices as they were.
        }
      })();
    },
    [setFlag, clearFlag],
  );

  // (a) A sign-in during this page load.
  useEffect(
    () =>
      session.subscribe((reason) => {
        if (reason !== "signIn") return;
        const email = session.current()?.email;
        if (email !== undefined) readOnce(email);
      }),
    [readOnce],
  );

  // (b) Every signed-in page load, after the first live object: a restored
  // session reads once whether or not this browser holds a flag, so a
  // browser that never signed in through the form (a stored session) still
  // learns the subscription and the server's read marker.
  useEffect(() => {
    if (!liveApplied || account === null) return;
    readOnce(account);
  }, [liveApplied, account, readOnce]);

  const value = useMemo<SubscriptionValue>(
    () => ({ flag, setFlag, clearFlag }),
    [flag, setFlag, clearFlag],
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

// An int64 id sent as a number or a string, or null.
function toId(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

// Outside a provider the hook reads and writes storage directly.
export function useSubscription(): SubscriptionValue {
  return (
    useContext(SubscriptionContext) ?? {
      flag: readFlag(),
      setFlag: writeFlag,
      clearFlag: removeFlag,
    }
  );
}
