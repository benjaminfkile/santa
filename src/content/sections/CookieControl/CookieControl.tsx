// docs/site.md section 10. The cookie_control section: closedCopy outside
// status 3; signedOutCopy with a sign-in link when signed out; a button
// opens a bottom sheet that fetches /me/cookies and posts /cookies.

import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import type { SectionComponent } from "../../registry";
import type { ContentBundle } from "../../../store/types";
import type { CookieType } from "../../../contracts";
import { useStore } from "../../../store/useStore";
import { useAuth } from "../../../auth/AuthProvider";
import { Inline } from "../../inline/Inline";
import { Icon } from "../../primitives/Icon";
import { getMyCookies, leaveCookie } from "../../../api/cookies";
import { ApiRequestError, SignInRequired, surfaceFor } from "../../../api/errors";
import "./CookieControl.module.css";

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

export const CookieControl: SectionComponent = ({ data, bundle }: CookieControlProps) => {
  const d = readData(data);
  const eventStatusId = useStore((s) => s.live?.eventStatusId ?? null);
  const cookieTypes = useStore(
    (s) => (s.snapshot?.cookieTypes ?? []) as CookieType[],
  );
  const { state: auth, signIn } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  if (eventStatusId !== 3) {
    return (
      <div className="cookie-control cookie-control--closed">
        {d.heading ? <h2>{d.heading}</h2> : null}
        <p><Inline text={d.closedCopy ?? ""} bundle={bundle} /></p>
      </div>
    );
  }

  if (auth.status === "unknown") {
    return (
      <div className="cookie-control cookie-control--pending" data-testid="cookie-control-pending" />
    );
  }

  if (auth.status !== "signedIn") {
    return (
      <div className="cookie-control cookie-control--signed-out">
        {d.heading ? <h2>{d.heading}</h2> : null}
        <p><Inline text={d.signedOutCopy ?? ""} bundle={bundle} /></p>
        <button
          type="button"
          onClick={() => {
            void signIn(location.pathname + location.search);
          }}
        >
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div className="cookie-control">
      {d.heading ? <h2>{d.heading}</h2> : null}
      {d.copy ? <p><Inline text={d.copy} bundle={bundle} /></p> : null}
      <button type="button" onClick={() => setOpen(true)} data-testid="cookie-control-open">
        Leave a cookie
      </button>
      {open ? (
        <CookieSheet
          bundle={bundle}
          cookieTypes={cookieTypes}
          onClose={() => setOpen(false)}
          onSignInRequired={() => {
            void signIn(location.pathname + location.search);
          }}
        />
      ) : null}
    </div>
  );
};

type SheetState =
  | { kind: "loading" }
  | {
      kind: "ready";
      remaining: number;
      limit: number;
      selectedTypeId: number | null;
      note: string;
      submitting: boolean;
      error: string | null;
      fieldError: string | null;
      cooldownUntil: number | null;
      confirmation: string | null;
      typesOverride: CookieType[] | null;
    }
  | { kind: "error"; message: string };

function CookieSheet({
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
  const [state, setState] = useState<SheetState>({ kind: "loading" });
  const [nowMs, setNowMs] = useState(() => Date.now());

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const res = await getMyCookies();
      const limit = num(res.limit);
      const remaining = num(res.remaining);
      setState({
        kind: "ready",
        limit,
        remaining,
        selectedTypeId: null,
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
        onSignInRequired();
        onClose();
        return;
      }
      setState({ kind: "error", message: s.message });
    }
  }, [onClose, onSignInRequired]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (state.kind !== "ready" || state.cooldownUntil === null) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [state]);

  const submit = useCallback(async () => {
    if (state.kind !== "ready") return;
    if (state.remaining <= 0) return;
    if (state.selectedTypeId === null) return;
    if (state.cooldownUntil !== null && state.cooldownUntil > Date.now()) return;
    setState({ ...state, submitting: true, error: null, fieldError: null, confirmation: null });
    try {
      const res = await leaveCookie({
        cookieTypeId: state.selectedTypeId,
        note: state.note.trim() === "" ? null : state.note.trim(),
      });
      setState((prev) =>
        prev.kind !== "ready"
          ? prev
          : {
              ...prev,
              submitting: false,
              remaining: num(res.remaining),
              note: "",
              selectedTypeId: null,
              confirmation: "Thanks for the cookie.",
            },
      );
    } catch (e) {
      handleSubmitError(e);
    }
  }, [state]);

  function handleSubmitError(e: unknown) {
    const s = surfaceFor(e);
    if (e instanceof ApiRequestError) {
      if (s.code === "cookie_limit_reached") {
        setState((prev) =>
          prev.kind !== "ready"
            ? prev
            : {
                ...prev,
                submitting: false,
                remaining: 0,
                error: "You have left all your cookies for this year",
              },
        );
        return;
      }
      if (s.code === "no_live_event") {
        onClose();
        return;
      }
      if (s.code === "not_found") {
        setState((prev) =>
          prev.kind !== "ready"
            ? prev
            : {
                ...prev,
                submitting: false,
                selectedTypeId: null,
                typesOverride: cookieTypes.slice(),
                error: "That cookie type is no longer active. Please pick another.",
              },
        );
        return;
      }
      if (s.code === "validation_failed") {
        setState((prev) =>
          prev.kind !== "ready"
            ? prev
            : {
                ...prev,
                submitting: false,
                fieldError: s.fieldErrors.note ?? "Please check your note.",
              },
        );
        return;
      }
      if (s.code === "rate_limited") {
        const secs = s.retryAfterSeconds ?? 30;
        setState((prev) =>
          prev.kind !== "ready"
            ? prev
            : {
                ...prev,
                submitting: false,
                cooldownUntil: Date.now() + secs * 1000,
                error: `Too many requests. Try again in ${secs}s.`,
              },
        );
        return;
      }
      if (e instanceof SignInRequired || s.code === "unauthenticated") {
        onSignInRequired();
        onClose();
        return;
      }
    }
    setState((prev) =>
      prev.kind !== "ready" ? prev : { ...prev, submitting: false, error: s.message },
    );
  }

  if (state.kind === "loading") {
    return (
      <div className="cookie-control__sheet" role="dialog" data-testid="cookie-sheet">
        <p>Loading…</p>
        <button type="button" onClick={onClose}>Cancel</button>
      </div>
    );
  }
  if (state.kind === "error") {
    return (
      <div className="cookie-control__sheet" role="dialog" data-testid="cookie-sheet">
        <p role="alert">{state.message}</p>
        <button type="button" onClick={() => void load()}>Retry</button>
        <button type="button" onClick={onClose}>Close</button>
      </div>
    );
  }

  const types = state.typesOverride ?? cookieTypes;
  const cooldownSecs =
    state.cooldownUntil !== null
      ? Math.max(0, Math.ceil((state.cooldownUntil - nowMs) / 1000))
      : 0;
  const disabled =
    state.submitting ||
    state.remaining <= 0 ||
    state.selectedTypeId === null ||
    cooldownSecs > 0;

  return (
    <div className="cookie-control__sheet" role="dialog" data-testid="cookie-sheet">
      <p data-testid="cookie-remaining">
        {state.remaining} of {state.limit} left
      </p>
      <ul className="cookie-control__types">
        {types.map((t) => (
          <li key={num(t.id)}>
            <label data-testid="cookie-type">
              <input
                type="radio"
                name="cookie-type"
                value={String(num(t.id))}
                checked={state.selectedTypeId === num(t.id)}
                onChange={() =>
                  setState((prev) =>
                    prev.kind !== "ready" ? prev : { ...prev, selectedTypeId: num(t.id) },
                  )
                }
              />
              {renderTypeIcon(t.icon, bundle)}
              <span>{t.name}</span>
            </label>
          </li>
        ))}
      </ul>
      <label>
        Note (optional)
        <textarea
          maxLength={140}
          value={state.note}
          onChange={(e) =>
            setState((prev) =>
              prev.kind !== "ready" ? prev : { ...prev, note: e.target.value },
            )
          }
          aria-describedby={state.fieldError !== null ? "cookie-note-error" : undefined}
          aria-invalid={state.fieldError !== null}
        />
        <span data-testid="cookie-note-counter">{state.note.length}/140</span>
      </label>
      {state.fieldError !== null ? (
        <p id="cookie-note-error" role="alert">{state.fieldError}</p>
      ) : null}
      {state.error !== null ? (
        <p role="alert" data-testid="cookie-error">{state.error}</p>
      ) : null}
      {state.confirmation !== null ? (
        <p data-testid="cookie-confirmation">{state.confirmation}</p>
      ) : null}
      <div>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={disabled}
          data-testid="cookie-submit"
        >
          {cooldownSecs > 0 ? `Wait ${cooldownSecs}s` : "Leave cookie"}
        </button>
        <button type="button" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

function renderTypeIcon(icon: unknown, bundle: ContentBundle) {
  if (icon === null || icon === undefined) return null;
  if (typeof icon !== "object") return null;
  const source = (icon as { source?: unknown }).source;
  const id = (icon as { id?: unknown }).id;
  if ((source !== "library" && source !== "media") || typeof id !== "string") return null;
  return <Icon icon={{ source, id }} bundle={bundle} alt="" decorative inline />;
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
