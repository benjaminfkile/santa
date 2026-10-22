// docs/site.md section 13.2. /alerts/verify?token=wsv_...: POST on mount
// with a JSON body; reads token from the query string; validates the
// token shape client-side. On `200` a pending subscription flag becomes
// active: the token does not name its address, and the browser holds at
// most one flag, so the pending flag is the address the link confirms.

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { verifySubscription } from "../../api/subscriptions";
import { ApiRequestError } from "../../api/errors";
import { useSubscription } from "../../alerts/SubscriptionProvider";
import { BellIcon } from "../../content/icons/generated/bell";
import { QuestionIcon } from "../../content/icons/generated/question";
import { copy } from "../../copy/copy";
import { StatusPage } from "../StatusPage";

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
  const { flag, setFlag } = useSubscription();

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

  // After a `200` the pending flag, when there is one, becomes active.
  const confirmed = state.kind === "success";
  useEffect(() => {
    if (confirmed && flag !== null && flag.state === "pending") setFlag({ ...flag, state: "active" });
  }, [confirmed, flag, setFlag]);

  const c = copy.alertsVerify;
  const home = { to: "/", label: c.home };
  if (!validToken) {
    return <StatusPage icon={QuestionIcon} title={c.invalid} action={home} role="alert" testId="verify-invalid" />;
  }
  if (state.kind === "success") {
    return <StatusPage icon={BellIcon} title={c.success} line={c.successLine} action={home} testId="verify-success" />;
  }
  if (state.kind === "invalid") {
    return <StatusPage icon={QuestionIcon} title={c.expired} action={home} role="alert" testId="verify-expired" />;
  }
  if (state.kind === "network") {
    return (
      <StatusPage
        icon={QuestionIcon}
        title={c.network}
        action={{ onClick: () => void run(), label: c.retry }}
        role="alert"
        testId="verify-network"
      />
    );
  }
  return <StatusPage icon={BellIcon} title={c.confirming} role="status" testId="verify-pending" />;
}
