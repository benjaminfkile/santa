// docs/site.md section 7.4. Shared status pill primitive: ok, warn, err,
// dim. Rendered as `.status-pill` with a modifier class so tests and the
// design studio can address one element type across the whole site.

import type { ReactNode } from "react";
import "./StatusPill.module.css";

export type StatusPillTone = "ok" | "warn" | "err" | "dim";

export function StatusPill({
  tone,
  children,
  testId,
}: {
  tone: StatusPillTone;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <span
      className={`status-pill status-pill--${tone}`}
      data-testid={testId}
    >
      <span className="status-pill__dot" aria-hidden />
      {children}
    </span>
  );
}
