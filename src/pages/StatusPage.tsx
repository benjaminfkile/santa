// docs/site.md sections 4, 7.1, 7.8, 13.2, 13.3, and 19. The status card
// shared by NotFound, Loading, the alerts verify and unsubscribe states,
// the preview states, and the reload prompt: the frost recipe centred in
// <main id="main">, the site name when a bundle is held, a 72 px library
// icon, the title, one line, and an optional link or button.
//
// docs/site.md 11.5: during the live takeover the card renders inside the
// shared centred dialog surface so the tracker stays underneath.

import { useId, type ComponentType, type ReactNode, type SVGProps } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../store/useStore";
import { selectBundle, selectTakeover } from "../content/selectPage";
import { TakeoverSurface } from "../ui/TakeoverSurface";
import * as btn from "../ui/Button.module.css";
import * as styles from "./StatusPage.module.css";

export type StatusAction =
  | { to: string; label: string }
  | { onClick: () => void; label: string };

export type StatusPageProps = {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  line?: string;
  action?: StatusAction;
  role?: "status" | "alert";
  testId?: string;
  children?: ReactNode;
  // Extra classes for the card and the icon (the loading fade and turn).
  cardClassName?: string;
  iconClassName?: string;
};

export function StatusPage({
  icon: Icon,
  title,
  line,
  action,
  role,
  testId,
  children,
  cardClassName,
  iconClassName,
}: StatusPageProps) {
  const bundle = useStore(selectBundle);
  const takeover = useStore(selectTakeover);
  const titleId = useId();
  const siteName = bundle?.content?.settings.siteName ?? "";
  const inner = (
    <section
      className={cardClassName ? `${styles.card} ${cardClassName}` : styles.card}
      role={takeover ? "dialog" : undefined}
      aria-modal={takeover ? true : undefined}
      aria-labelledby={titleId}
      data-testid={testId}
    >
      {siteName !== "" ? <p className={styles.brand}>{siteName}</p> : null}
      <Icon
        className={iconClassName ? `${styles.icon} ${iconClassName}` : styles.icon}
        width={72}
        height={72}
        aria-hidden
      />
      <div
        className={styles.text}
        role={role}
        aria-live={role === "status" ? "polite" : undefined}
      >
        <h1 id={titleId} className={styles.title}>{title}</h1>
        {line !== undefined ? <p className={styles.line}>{line}</p> : null}
      </div>
      {action !== undefined ? (
        "to" in action ? (
          <Link to={action.to} className={btn.btnFill}>{action.label}</Link>
        ) : (
          <button type="button" className={btn.btnFill} onClick={action.onClick}>
            {action.label}
          </button>
        )
      ) : null}
      {children}
    </section>
  );
  if (takeover) return <TakeoverSurface testId="status-takeover">{inner}</TakeoverSurface>;
  return (
    <main id="main" className={styles.wrap}>
      {inner}
    </main>
  );
}
