// docs/site.md section 7.4. Shared status pill primitive: ok, warn, err,
// dim. Rendered as a status pill with a modifier class so tests and the
// design studio can address one element type across the whole site.

import type { ReactNode } from "react";
import * as styles from "./StatusPill.module.css";

export type StatusPillTone = "ok" | "warn" | "err" | "dim";

const TONE_CLASS: Record<StatusPillTone, string> = {
  ok: styles.statusPillOk,
  warn: styles.statusPillWarn,
  err: styles.statusPillErr,
  dim: styles.statusPillDim,
};

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
      className={`${styles.statusPill} ${TONE_CLASS[tone]}`}
      data-testid={testId}
    >
      <span className={styles.statusPillDot} aria-hidden />
      {children}
    </span>
  );
}
