// docs/site.md section 10. The cookie_control section: closedCopy outside
// status 3; signedOutCopy with a sign-in link when signed out; a button
// that opens the cookie dialog, centred in the viewport, where the visitor
// picks how many of each type to leave (up to the remaining allowance) and
// the site posts them in one request. The dialog is on the narrow width of
// the shared recipe, with a close X in its head and its picker in the
// recipe's scroll region. The dialog is exported for the live
// screen, which opens it from its own glyph; signed out it offers Sign in.

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import type { SectionComponent } from "../../registry";
import type { ContentBundle } from "../../../store/types";
import type { CookieType } from "../../../contracts";
import type { ReactNode } from "react";
import { useStore } from "../../../store/useStore";
import { formatCount } from "../../../lib/number";
import { useAuth } from "../../../auth/AuthProvider";
import { Inline } from "../../inline/Inline";
import { Icon } from "../../primitives/Icon";
import { getMyCookies, leaveCookies } from "../../../api/cookies";
import { ApiRequestError, SignInRequired, surfaceFor } from "../../../api/errors";
import { copy } from "../../../copy/copy";
import { CloseGlyph, MinusGlyph, PlusGlyph } from "../Map/glyphs";
import * as styles from "./CookieControl.module.css";
import * as btn from "../../../ui/Button.module.css";
import * as dlg from "../../../ui/Dialog.module.css";
import * as ibtn from "../../../ui/IconButton.module.css";
import * as field from "../../../ui/Field.module.css";

export type CookieControlData = {
  heading?: string | null;
  copy?: string | null;
  signedOutCopy?: string | null;
  closedCopy?: string | null;
};

function readData(data: unknown): CookieControlData {
  if (data === null || typeof data !== "object") return {};
  const d = data as CookieControlData;
  return {
    heading: d.heading ?? null,
    copy: d.copy ?? null,
    signedOutCopy: d.signedOutCopy ?? null,
    closedCopy: d.closedCopy ?? null,
  };
}

export type CookieControlProps = {
  data: unknown;
  items: { id: number; data: unknown }[];
  bundle: ContentBundle;
};

// Sends the visitor to sign in with `returnTo` the current path and search.
function useSignInHere(): () => void {
  const { signIn } = useAuth();
  const location = useLocation();
  return useCallback(() => {
    void signIn(location.pathname + location.search);
  }, [signIn, location.pathname, location.search]);
}

export const CookieControl: SectionComponent = ({ data, bundle }: CookieControlProps) => {
  const d = readData(data);
  const eventStatusId = useStore((s) => s.live?.eventStatusId ?? null);
  const { state: auth } = useAuth();
  const onSignIn = useSignInHere();
  const [open, setOpen] = useState(false);

  if (eventStatusId !== 3) {
    return (
      <div className={`${styles.cookieControl} ${styles.cookieControlClosed}`}>
        {d.heading ? <h2>{d.heading}</h2> : null}
        <p><Inline text={d.closedCopy ?? ""} bundle={bundle} /></p>
      </div>
    );
  }

  if (auth.status === "unknown") {
    return (
      <div className={`${styles.cookieControl} ${styles.cookieControlPending}`} data-testid="cookie-control-pending" />
    );
  }

  if (auth.status !== "signedIn") {
    return (
      <div className={`${styles.cookieControl} ${styles.cookieControlSignedOut}`}>
        {d.heading ? <h2>{d.heading}</h2> : null}
        <p><Inline text={d.signedOutCopy ?? ""} bundle={bundle} /></p>
        <button type="button" className={`${btn.btn} ${styles.cookieControlOpen}`} onClick={onSignIn}>
          {copy.signIn.button}
        </button>
      </div>
    );
  }

  return (
    <div className={styles.cookieControl}>
      {d.heading ? <h2>{d.heading}</h2> : null}
      {d.copy ? <p><Inline text={d.copy} bundle={bundle} /></p> : null}
      <button type="button" className={`${btn.btnFill} ${styles.cookieControlOpen}`} onClick={() => setOpen(true)} data-testid="cookie-control-open">
        {copy.cookies.leave}
      </button>
      {open ? <CookieDialog bundle={bundle} onClose={() => setOpen(false)} /> : null}
    </div>
  );
};

type DialogState =
  | { kind: "loading" }
  | {
      kind: "ready";
      remaining: number;
      limit: number;
      counts: Record<number, number>;
      note: string;
      submitting: boolean;
      error: string | null;
      fieldError: string | null;
      cooldownUntil: number | null;
      confirmation: string | null;
      typesOverride: CookieType[] | null;
    }
  | { kind: "error"; message: string };

type Ready = Extract<DialogState, { kind: "ready" }>;

// The cookie dialog. Signed in it loads `GET /me/cookies` and shows the
// picker; signed out it shows the sign-in copy with Sign in and Close and
// calls nothing; while auth is unknown it shows its loading state.
// The cookie list: one row per type, the icon, the name with the running
// tally under it, and whatever the caller puts at the end of the row. The
// signed-in dialog passes its stepper; the signed-out one passes nothing,
// so a visitor who cannot leave cookies yet still sees what there is to
// leave and how many of each Santa has.
function CookieRows({
  types,
  tally,
  bundle,
  trailing,
}: {
  types: CookieType[];
  tally: Record<string, number> | null;
  bundle: ContentBundle;
  trailing?: (type: CookieType, id: number) => ReactNode;
}) {
  return (
    <ul className={styles.rows}>
      {types.map((t) => {
        const id = num(t.id);
        return (
          <li key={id} className={styles.row} data-testid="cookie-row">
            {renderTypeIcon(t.icon, bundle)}
            <span className={styles.rowText}>
              <span className={styles.rowName}>{t.name}</span>
              <span className={styles.rowTally} data-testid="cookie-row-tally">
                {formatCount(tally?.[String(id)] ?? 0)}
                <span className={styles.visuallyHidden}> left so far</span>
              </span>
            </span>
            {trailing ? trailing(t, id) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function CookieDialog({
  bundle,
  onClose,
}: {
  bundle: ContentBundle;
  onClose: () => void;
}) {
  const cookieTypes = useStore(
    (s) => (s.snapshot?.cookieTypes ?? []) as CookieType[],
  );
  // The live tally, so each row says how many of that cookie Santa has
  // been left so far, beside the visitor's own picks.
  const tally = useStore((s) => s.live?.cookieTally ?? null);
  const { state: auth } = useAuth();
  const signedIn = auth.status === "signedIn";
  const onSignInRequired = useSignInHere();
  const ref = useRef<HTMLDialogElement | null>(null);
  const [state, setState] = useState<DialogState>({ kind: "loading" });
  const [nowMs, setNowMs] = useState(() => Date.now());
  // The parent passes fresh arrow functions on every render; the loader
  // reads them through a ref so a store update never refetches /me/cookies.
  const callbacksRef = useRef({ onClose, onSignInRequired });
  useEffect(() => {
    callbacksRef.current = { onClose, onSignInRequired };
  }, [onClose, onSignInRequired]);

  useEffect(() => {
    const el = ref.current;
    if (el === null) return;
    if (typeof el.showModal === "function" && !el.open) {
      try {
        el.showModal();
      } catch {
        // ignore; some jsdom builds do not implement showModal.
      }
    }
  }, []);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const res = await getMyCookies();
      setState({
        kind: "ready",
        limit: num(res.limit),
        remaining: num(res.remaining),
        counts: {},
        note: "",
        submitting: false,
        error: null,
        fieldError: null,
        cooldownUntil: null,
        confirmation: null,
        typesOverride: null,
      });
    } catch (e) {
      const s = surfaceFor(e);
      if (s.code === "unauthenticated") {
        callbacksRef.current.onSignInRequired();
        callbacksRef.current.onClose();
        return;
      }
      setState({ kind: "error", message: s.message });
    }
  }, []);

  useEffect(() => {
    if (signedIn) void load();
  }, [load, signedIn]);

  useEffect(() => {
    if (state.kind !== "ready" || state.cooldownUntil === null) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [state]);

  const setReady = useCallback((updater: (s: Ready) => Ready) => {
    setState((prev) => (prev.kind !== "ready" ? prev : updater(prev)));
  }, []);

  const total = state.kind === "ready" ? Object.values(state.counts).reduce((a, b) => a + b, 0) : 0;

  const bump = (typeId: number, delta: number) => {
    setReady((s) => {
      const cur = s.counts[typeId] ?? 0;
      const sum = Object.values(s.counts).reduce((a, b) => a + b, 0);
      const next = Math.max(0, Math.min(cur + delta, cur + Math.max(0, s.remaining - sum)));
      const counts = { ...s.counts, [typeId]: next };
      if (next === 0) delete counts[typeId];
      return { ...s, counts, error: null, confirmation: null };
    });
  };

  // Handle a refused pick (docs/site.md 10). The request is all or nothing,
  // so the picks stay as they were unless the refusal says otherwise.
  function handleError(e: unknown): void {
    const s = surfaceFor(e);
    if (e instanceof ApiRequestError) {
      const details = (e.body?.details ?? null) as { remaining?: unknown; cookieTypeIds?: unknown } | null;
      if (s.code === "cookie_limit_reached") {
        const remaining = typeof details?.remaining === "number" ? Math.max(0, details.remaining) : 0;
        setReady((p) => ({
          ...p,
          submitting: false,
          remaining,
          counts: {},
          error: remaining === 0 ? copy.cookies.limitReached : copy.cookies.onlyLeft(remaining),
        }));
        return;
      }
      if (s.code === "no_live_event") {
        callbacksRef.current.onClose();
        return;
      }
      if (s.code === "not_found") {
        const gone = new Set(Array.isArray(details?.cookieTypeIds) ? details.cookieTypeIds.map(Number) : []);
        setReady((p) => {
          const counts: Record<number, number> = {};
          for (const [id, count] of Object.entries(p.counts)) {
            if (gone.size === 0 || gone.has(Number(id))) continue;
            counts[Number(id)] = count;
          }
          return { ...p, submitting: false, counts, typesOverride: cookieTypes.slice(), error: copy.cookies.typeGone };
        });
        return;
      }
      if (s.code === "validation_failed") {
        setReady((p) => ({ ...p, submitting: false, fieldError: s.fieldErrors.note ?? copy.cookies.noteInvalid }));
        return;
      }
      if (s.code === "rate_limited") {
        const secs = s.retryAfterSeconds ?? 30;
        setReady((p) => ({ ...p, submitting: false, cooldownUntil: Date.now() + secs * 1000, error: copy.cookies.tooMany(secs) }));
        return;
      }
    }
    if (e instanceof SignInRequired || s.code === "unauthenticated") {
      callbacksRef.current.onSignInRequired();
      callbacksRef.current.onClose();
      return;
    }
    setReady((p) => ({ ...p, submitting: false, error: s.message }));
  }

  const submit = useCallback(async () => {
    if (state.kind !== "ready") return;
    if (state.submitting || state.remaining <= 0) return;
    if (state.cooldownUntil !== null && state.cooldownUntil > Date.now()) return;
    const items = Object.entries(state.counts)
      .map(([id, count]) => ({ cookieTypeId: Number(id), count }))
      .filter((it) => it.count > 0);
    const total = items.reduce((a, it) => a + it.count, 0);
    if (total === 0) return;
    const note = state.note.trim() === "" ? null : state.note.trim();
    setReady((p) => ({ ...p, submitting: true, error: null, fieldError: null, confirmation: null }));
    try {
      const res = await leaveCookies({ items, note });
      const left = num(res.left) > 0 ? num(res.left) : total;
      setReady((p) => ({
        ...p,
        submitting: false,
        remaining: num(res.remaining),
        note: "",
        counts: {},
        confirmation: copy.cookies.thanks(left),
      }));
    } catch (e) {
      handleError(e);
    }
  }, [state, setReady]);

  const close = () => {
    const el = ref.current;
    if (el !== null && typeof el.close === "function") el.close();
    onClose();
  };

  const signInFromDialog = () => {
    onSignInRequired();
    close();
  };

  const body = (() => {
    if (auth.status !== "unknown" && !signedIn) {
      // The same list as the signed-in dialog, so a visitor who is not
      // signed in still sees the cookies and how many of each Santa has;
      // the steppers are what they are missing, and the notice above the
      // list and the Sign in action say why.
      return (
        <>
          <div className={dlg.scroll} data-testid="cookie-dialog-scroll">
            <p className={styles.signInNotice} data-testid="cookie-dialog-signed-out">
              {copy.cookies.signInToLeave}
            </p>
            <CookieRows types={cookieTypes} tally={tally} bundle={bundle} />
          </div>
          <div className={dlg.actions}>
            <button type="button" className={btn.btnQuiet} onClick={close}>{copy.cookies.close}</button>
            <button type="button" className={btn.btnFill} onClick={signInFromDialog} data-testid="cookie-dialog-sign-in">
              {copy.signIn.button}
            </button>
          </div>
        </>
      );
    }
    if (!signedIn || state.kind === "loading") {
      return (
        <>
          <div className={dlg.scroll}>
            <p className={dlg.copy}>{copy.loading.initial}</p>
          </div>
          <div className={dlg.actions}>
            <button type="button" className={btn.btnQuiet} onClick={close}>{copy.cookies.cancel}</button>
          </div>
        </>
      );
    }
    if (state.kind === "error") {
      return (
        <>
          <div className={dlg.scroll}>
            <p role="alert" className={dlg.alert}>{state.message}</p>
          </div>
          <div className={dlg.actions}>
            <button type="button" className={btn.btnQuiet} onClick={close}>{copy.cookies.close}</button>
            <button type="button" className={btn.btn} onClick={() => void load()}>{copy.map.retry}</button>
          </div>
        </>
      );
    }
    const types = state.typesOverride ?? cookieTypes;
    const cooldownSecs =
      state.cooldownUntil !== null ? Math.max(0, Math.ceil((state.cooldownUntil - nowMs) / 1000)) : 0;
    const canAdd = total < state.remaining && !state.submitting;
    const disabled = state.submitting || state.remaining <= 0 || total === 0 || cooldownSecs > 0;
    return (
      <>
        <div className={dlg.scroll} data-testid="cookie-dialog-scroll">
          <CookieRows
            types={types}
            tally={tally}
            bundle={bundle}
            trailing={(t, id) => {
              const count = state.counts[id] ?? 0;
              return (
                <span className={styles.stepper}>
                  <button
                    type="button"
                    className={styles.stepBtn}
                    aria-label={copy.cookies.fewer(t.name ?? "")}
                    disabled={count === 0 || state.submitting}
                    onClick={() => bump(id, -1)}
                    data-testid="cookie-minus"
                  >
                    <MinusGlyph size={20} strokeWidth={2.5} />
                  </button>
                  <span className={`${styles.count}${count > 0 ? " " + styles.countOn : ""}`} aria-live="polite" data-testid="cookie-count">
                    {count}
                  </span>
                  <button
                    type="button"
                    className={styles.stepBtn}
                    aria-label={copy.cookies.more(t.name ?? "")}
                    disabled={!canAdd}
                    onClick={() => bump(id, 1)}
                    data-testid="cookie-type"
                  >
                    <PlusGlyph size={20} strokeWidth={2.5} />
                  </button>
                </span>
              );
            }}
          />
          <label className={field.field}>
            <span className={field.label}>{copy.cookies.noteLabel}</span>
            <textarea
              className={field.input}
              maxLength={140}
              value={state.note}
              disabled={state.submitting}
              onChange={(e) => setReady((p) => ({ ...p, note: e.target.value, fieldError: null }))}
              aria-describedby={state.fieldError !== null ? "cookie-note-error" : undefined}
              aria-invalid={state.fieldError !== null}
            />
            <span className={field.counter} data-testid="cookie-note-counter">{state.note.length}/140</span>
          </label>
          {state.fieldError !== null ? (
            <p id="cookie-note-error" role="alert" className={field.error}>{state.fieldError}</p>
          ) : null}
          {state.error !== null ? (
            <p role="alert" className={dlg.alert} data-testid="cookie-error">{state.error}</p>
          ) : null}
          {state.confirmation !== null ? (
            <p className={dlg.notice} role="status" data-testid="cookie-confirmation">{state.confirmation}</p>
          ) : null}
        </div>
        <div className={dlg.actions}>
          <button type="button" className={btn.btnQuiet} onClick={close} disabled={state.submitting}>
            {copy.cookies.close}
          </button>
          <button
            type="button"
            className={btn.btnFill}
            onClick={() => void submit()}
            disabled={disabled}
            data-testid="cookie-submit"
          >
            {cooldownSecs > 0 ? copy.cookies.wait(cooldownSecs) : copy.cookies.submit(total)}
          </button>
        </div>
      </>
    );
  })();

  return (
    <dialog
      ref={ref}
      className={`${dlg.dialog} ${dlg.dialogNarrow}`}
      aria-labelledby="cookie-dialog-title"
      data-testid="cookie-sheet"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget && !(state.kind === "ready" && state.submitting)) close();
      }}
    >
      <div className={dlg.body}>
        <div className={dlg.head}>
          <h2 id="cookie-dialog-title" className={dlg.title}>{copy.cookies.title}</h2>
          {signedIn && state.kind === "ready" ? (
            <span className={dlg.meta} data-testid="cookie-remaining">
              {copy.cookies.left(state.limit - state.remaining, state.limit)}
            </span>
          ) : null}
          <button
            type="button"
            className={`${ibtn.ibtn} ${dlg.closeX}`}
            aria-label={copy.cookies.close}
            onClick={close}
            disabled={state.kind === "ready" && state.submitting}
            data-testid="cookie-dialog-close-x"
          >
            <CloseGlyph size={18} />
          </button>
        </div>
        {body}
      </div>
    </dialog>
  );
}

function renderTypeIcon(icon: unknown, bundle: ContentBundle) {
  const placeholder = <span className={`${styles.rowIcon} ${styles.rowIconPlaceholder}`} aria-hidden />;
  if (icon === null || icon === undefined || typeof icon !== "object") return placeholder;
  const source = (icon as { source?: unknown }).source;
  const id = (icon as { id?: unknown }).id;
  if ((source !== "library" && source !== "media") || typeof id !== "string") return placeholder;
  return (
    <span className={styles.rowIcon} aria-hidden>
      <Icon icon={{ source, id }} bundle={bundle} alt="" decorative size={20} />
    </span>
  );
}

function num(v: number | string | null | undefined): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export default CookieControl;
