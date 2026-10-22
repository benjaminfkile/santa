// docs/site.md section 11.5. The centred dialog surface the auth card and
// the status card render inside while the live takeover is on.

import { type ReactNode } from "react";
import * as styles from "./TakeoverSurface.module.css";

export type TakeoverSurfaceProps = {
  testId: string;
  children: ReactNode;
};

export function TakeoverSurface({ testId, children }: TakeoverSurfaceProps) {
  return (
    <div className={styles.takeoverWrap} data-testid={testId}>
      {children}
    </div>
  );
}
