// docs/site.md section 13.3. /alerts/unsubscribe?token=wsu_...: POST on
// mount; reads token from the query string; validates the token shape
// client-side.

import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { unsubscribe } from "../../api/subscriptions";
import { ApiRequestError } from "../../api/errors";

const TOKEN_RE = /^wsu_[A-Za-z0-9_-]{43}$/;

type State =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success" }
  | { kind: "invalid" }
  | { kind: "network" };

export function UnsubscribePage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const validToken = TOKEN_RE.test(token);
  const [state, setState] = useState<State>({ kind: "idle" });

  const run = useCallback(async () => {
    if (!validToken) return;
    setState({ kind: "submitting" });
    try {
      await unsubscribe(token);
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
        <p>You are unsubscribed.</p>
        <p><Link to="/">Home</Link></p>
      </main>
    );
  }
  if (state.kind === "invalid") {
    return (
      <main id="main">
        <h1>Alerts</h1>
        <p>This link is not valid.</p>
        <p><Link to="/">Home</Link></p>
      </main>
    );
  }
  if (state.kind === "network") {
    return (
      <main id="main">
        <h1>Alerts</h1>
        <p>Could not reach the server.</p>
        <button type="button" onClick={() => void run()}>Retry</button>
      </main>
    );
  }
  return (
    <main id="main">
      <h1>Alerts</h1>
      <p>Processing…</p>
    </main>
  );
}
