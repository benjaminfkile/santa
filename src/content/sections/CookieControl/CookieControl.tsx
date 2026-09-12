// docs/site.md section 10. The cookie_control section: closedCopy outside
// status 3; signedOutCopy with a sign-in link when signed out; a button
// (the pill on the live screen) that opens the cookie dialog, centred in
// the viewport, where the visitor picks how many of each type to leave
// (up to the remaining allowance) and the site posts them one by one.

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import type { SectionComponent } from "../../registry";
import type { ContentBundle } from "../../../store/types";
import type { CookieType } from "../../../contracts";
import { useStore } from "../../../store/useStore";
import { useAuth } from "../../../auth/AuthProvider";
import { Inline } from "../../inline/Inline";
import { Icon } from "../../primitives/Icon";
import { getMyCookies, leaveCookies } from "../../../api/cookies";
import { ApiRequestError, SignInRequired, surfaceFor } from "../../../api/errors";
import { copy } from "../../../copy/copy";
import { CookieGlyph, MinusGlyph, PlusGlyph } from "../Map/glyphs";
import * as styles from "./CookieControl.module.css";
import * as btn from "../../../ui/Button.module.css";
import * as dlg from "../../../ui/Dialog.module.css";
import * as field from "../../../ui/Field.module.css";

export type CookieControlData = {
  heading?: string | null;
  copy?: string | null;
  signedOutCopy?: string | null;
  closedCopy?: string | null;
  compact?: boolean;
};

function readData(data: unknown): CookieControlData {
  if (data === null || typeof data !== "object") return {};
  const d = data as CookieControlData;
  return {
    heading: d.heading ?? null,
    copy: d.copy ?? null,
    signedOutCopy: d.signedOutCopy ?? null,
    closedCopy: d.closedCopy ?? null,
    compact: d.compact === true,
  };
}

export type CookieControlProps = {
  data: unknown;
  items: { id: number; data: unknown }[];
  bundle: ContentBundle;
};

export const CookieControl: SectionComponent = ({ data, bundle }: CookieControlProps) => {
  const d = readData(data);
  const eventStatusId = useStore((s) => s.live?.eventStatusId ?? null);
  const cookieTypes = useStore(
    (s) => (s.snapshot?.cookieTypes ?? []) as CookieType[],
  );
  const { state: auth, signIn } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const onSignIn = () => {
    void signIn(location.pathname + location.search);
  };

  const dialog = open ? (
    <CookieDialog
      bundle={bundle}
      cookieTypes={cookieTypes}
      onClose={() => setOpen(false)}
      onSignInRequired={onSignIn}
    />
  ) : null;

  // The live screen's pill: one button, the dialog on tap, nothing else.
  if (d.compact === true) {
    if (eventStatusId !== 3 || auth.status === "unknown") return null;
    if (auth.status !== "signedIn") {
      return (
        <button type="button" className={styles.cookiePill} onClick={onSignIn} data-testid="cookie-control-sign-in">
          <CookieGlyph />
          {copy.cookies.signInToLeave}
        </button>
      );
    }
    return (
      <>
        <button type="button" className={styles.cookiePill} onClick={() => setOpen(true)} data-testid="cookie-control-open">
          <CookieGlyph />
          {copy.cookies.leave}
        </button>
        {dialog}
      </>
    );
  }

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
      {dialog}
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

function CookieDialog({
  bundle,
  cookieTypes,
  onClose,
  onSignInRequired,
}: {
  bundle: ContentBundle;
  cookieTypes: CookieType[];
  onClose: () => void;
  onSignInRequired: () => void;
}) {
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
    void load();
  }, [load]);

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
    ref.current?.close();
    onClose();
  };

  const body = (() => {
    if (state.kind === "loading") {
      return (
        <>
          <p className={dlg.copy}>{copy.loading.initial}</p>
          <div className={dlg.actions}>
            <button type="button" className={btn.btnQuiet} onClick={close}>{copy.cookies.cancel}</button>
          </div>
        </>
      );
    }
    if (state.kind === "error") {
      return (
        <>
          <p role="alert" className={dlg.alert}>{state.message}</p>
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
        <ul className={styles.rows}>
          {types.map((t) => {
            const id = num(t.id);
            const count = state.counts[id] ?? 0;
            return (
              <li key={id} className={styles.row} data-testid="cookie-row">
                {renderTypeIcon(t.icon, bundle)}
                <span className={styles.rowName}>{t.name}</span>
                <span className={styles.stepper}>
                  <button
                    type="button"
                    className={styles.stepBtn}
                    aria-label={copy.cookies.fewer(t.name ?? "")}
                    disabled={count === 0 || state.submitting}
                    onClick={() => bump(id, -1)}
                    data-testid="cookie-minus"
                  >
                    <MinusGlyph size={16} />
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
                    <PlusGlyph size={16} />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
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
      className={dlg.dialog}
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
          {state.kind === "ready" ? (
            <span className={dlg.meta} data-testid="cookie-remaining">
              {copy.cookies.remaining(state.remaining, state.limit)}
            </span>
          ) : null}
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
