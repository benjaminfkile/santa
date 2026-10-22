// docs/site.md section 13.3. /alerts/unsubscribe?token=wsu_...: POST on
// mount; reads token from the query string; validates the token shape
// client-side. A `204` clears the subscription flag.

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { unsubscribe } from "../../api/subscriptions";
import { ApiRequestError } from "../../api/errors";
import { useSubscription } from "../../alerts/SubscriptionProvider";
import { EnvelopeIcon } from "../../content/icons/generated/envelope";
import { QuestionIcon } from "../../content/icons/generated/question";
import { copy } from "../../copy/copy";
import { StatusPage } from "../StatusPage";

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
  const { clearFlag } = useSubscription();

  const run = useCallback(async () => {
    if (!validToken) return;
    setState({ kind: "submitting" });
    try {
      await unsubscribe(token);
      clearFlag();
      setState({ kind: "success" });
    } catch (e) {
      if (e instanceof ApiRequestError) {
        setState({ kind: "invalid" });
      } else {
        setState({ kind: "network" });
      }
    }
  }, [token, validToken, clearFlag]);

  useEffect(() => {
    void run();
  }, [run]);

  const c = copy.alertsUnsubscribe;
  const home = { to: "/", label: c.home };
  if (!validToken) {
    return <StatusPage icon={QuestionIcon} title={c.invalid} action={home} role="alert" testId="unsubscribe-invalid" />;
  }
  if (state.kind === "success") {
    return <StatusPage icon={EnvelopeIcon} title={c.success} line={c.successLine} action={home} testId="unsubscribe-success" />;
  }
  if (state.kind === "invalid") {
    return <StatusPage icon={QuestionIcon} title={c.expired} action={home} role="alert" testId="unsubscribe-expired" />;
  }
  if (state.kind === "network") {
    return (
      <StatusPage
        icon={QuestionIcon}
        title={c.network}
        action={{ onClick: () => void run(), label: c.retry }}
        role="alert"
        testId="unsubscribe-network"
      />
    );
  }
  return <StatusPage icon={EnvelopeIcon} title={c.processing} role="status" testId="unsubscribe-pending" />;
}
