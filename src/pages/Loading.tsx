// docs/site.md section 7.1. Loading page rendered until the first live
// object and snapshot arrive, and the Suspense fallback for the lazy
// chunks. For the first 300 ms it is an empty <main id="main"> holding the
// card wrap's height, so a warm visit paints nothing; then the status card
// fades in with the snowflake turning, and after 15 s a second line says
// the site is still trying. No exit animation.

import { useEffect, useState } from "react";
import { SnowflakeIcon } from "../content/icons/generated/snowflake";
import { copy } from "../copy/copy";
import { StatusPage } from "./StatusPage";
import * as styles from "./StatusPage.module.css";

const HOLD_MS = 300;
const SLOW_MS = 15000;

export function Loading() {
  const [shown, setShown] = useState(false);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const hold = window.setTimeout(() => setShown(true), HOLD_MS);
    const late = window.setTimeout(() => setSlow(true), SLOW_MS);
    return () => {
      window.clearTimeout(hold);
      window.clearTimeout(late);
    };
  }, []);
  if (!shown) return <main id="main" className={styles.wrap} data-testid="loading-hold" />;
  return (
    <StatusPage
      icon={SnowflakeIcon}
      title={copy.loading.initial}
      line={slow ? copy.loading.slow : undefined}
      role="status"
      testId="loading"
      cardClassName={styles.fadeIn}
      iconClassName={styles.turn}
    />
  );
}
