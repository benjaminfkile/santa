// docs/site.md section 13.2. /alerts/verify?token=wsv_...: POST on mount
// with a JSON body; reads token from the query string; validates the
// token shape client-side.

import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { verifySubscription } from "../../api/subscriptions";
import { ApiRequestError } from "../../api/errors";
import * as btn from "../../ui/Button.module.css";

const TOKEN_RE = /^wsv_[A-Za-z0-9_-]{43}$/;

type State =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success" }
  | { kind: "invalid" }
  | { kind: "network" };

export function VerifyPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const validToken = TOKEN_RE.test(token);
  const [state, setState] = useState<State>({ kind: "idle" });

  const run = useCallback(async () => {
    if (!validToken) return;
    setState({ kind: "submitting" });
    try {
      await verifySubscription(token);
      setState({ kind: "success" });
    } catch (e) {
      if (e instanceof ApiRequestError) {
        setState({ kind: "invalid" });
      } else {
        setState({ kind: "network" });
      }
    }
  }, [token, validToken]);

  useEffect(() => {
    void run();
  }, [run]);

  if (!validToken) {
    return (
      <main id="main">
        <h1>Alerts</h1>
        <p>This link is not valid.</p>
        <p><Link to="/">Home</Link></p>
      </main>
    );
  }
  if (state.kind === "success") {
    return (
      <main id="main">
        <h1>Alerts</h1>
        <p>Your alerts are confirmed.</p>
        <p><Link to="/">Home</Link></p>
      </main>
    );
  }
  if (state.kind === "invalid") {
    return (
      <main id="main">
        <h1>Alerts</h1>
        <p>This link has expired or is not valid.</p>
        <p><Link to="/">Home</Link></p>
      </main>
    );
  }
  if (state.kind === "network") {
    return (
      <main id="main">
        <h1>Alerts</h1>
        <p>Could not reach the server.</p>
        <button type="button" className={btn.btn} onClick={() => void run()}>Retry</button>
      </main>
    );
  }
  return (
    <main id="main">
      <h1>Alerts</h1>
      <p>Confirming your subscription…</p>
    </main>
  );
}
