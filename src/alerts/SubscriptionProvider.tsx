// docs/site.md sections 6.1 step 4 and 7.7, The subscription flag.
// `SubscriptionProvider` holds the flag of `subscriptionFlag.ts` and
// exposes `useSubscription()` with `{ flag, setFlag, clearFlag }`.
// `setFlag` and `clearFlag` write storage and the state together. The
// flag is cleared on sign-out (the auth state `signedOut`) and whenever
// the signed-in account is not the flag's `account`.
//
// The one check per app load: once the first live object has applied,
// while the visitor is signed in and the flag's `account` is the signed-in
// email, the provider calls `GET /me/subscriptions` once for that account
// and rewrites the flag from the newest row that is not unsubscribed
// (verified: active; unverified: pending), clearing it when there is none.
// `SignInRequired` or any failure leaves the flag as it was. No flag, or
// signed out: no call. Route changes and store updates never call again;
// signing in to an account later in the session with a flag for it runs
// the same check once for that account.

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
import { listMySubscriptions } from "../api/subscriptions";
import { useStore } from "../store/useStore";
import {
  flagFromRow,
  newestOpenRow,
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
  // The accounts already checked during this page load.
  const checkedRef = useRef(new Set<string>());
  // The signed-in account; a check that lands after it changed is dropped.
  const accountRef = useRef<string | null>(account);

  const setFlag = useCallback((next: SubscriptionFlag) => {
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

  // Sign-out, or another account signed in, clears the flag.
  useEffect(() => {
    if (flag === null) return;
    if (signedOut || (account !== null && flag.account !== account)) clearFlag();
  }, [flag, account, signedOut, clearFlag]);

  useEffect(() => {
    if (!liveApplied || account === null || flag === null || flag.account !== account) return;
    if (checkedRef.current.has(account)) return;
    checkedRef.current.add(account);
    const forAccount = account;
    void (async () => {
      try {
        const res = await listMySubscriptions();
        if (accountRef.current !== forAccount) return;
        const row = newestOpenRow(res.items ?? []);
        if (row === null) clearFlag();
        else setFlag(flagFromRow(forAccount, row));
      } catch {
        // SignInRequired or a failure leaves the flag as it was.
      }
    })();
  }, [liveApplied, account, flag, setFlag, clearFlag]);

  const value = useMemo<SubscriptionValue>(
    () => ({ flag, setFlag, clearFlag }),
    [flag, setFlag, clearFlag],
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
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
