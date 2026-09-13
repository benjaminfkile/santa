// docs/site.md section 11.2. The centred form card shared by every auth
// page. Composes the frost recipe and renders the site name above; the
// body is the caller's fields; a line of cross-links sits below.
//
// docs/site.md 11.5: during the live takeover the same card renders inside
// a centred dialog surface over the map; the outer wrap is fixed and holds
// the dialog backdrop.

import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../../store/useStore";
import { selectBundle, selectTakeover } from "../../content/selectPage";
import * as styles from "./AuthCard.module.css";

export type AuthLink = { to: string; label: string };

export type AuthCardProps = {
  title: string;
  children: ReactNode;
  links: AuthLink[];
};

export function AuthCard({ title, children, links }: AuthCardProps) {
  const bundle = useStore(selectBundle);
  const takeover = useStore(selectTakeover);
  const siteName = bundle?.content?.settings.siteName ?? "";
  const inner = (
    <section
      className={styles.card}
      role={takeover ? "dialog" : undefined}
      aria-modal={takeover ? true : undefined}
      aria-labelledby="auth-title"
      data-testid="auth-card"
    >
      {siteName !== "" ? <p className={styles.brand}>{siteName}</p> : null}
      <h1 id="auth-title" className={styles.title}>{title}</h1>
      {children}
      {links.length > 0 ? (
        <ul className={styles.links} data-testid="auth-links">
          {links.map((l, i) => (
            <li key={i}>
              <Link to={l.to}>{l.label}</Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
  if (takeover) {
    return (
      <div className={styles.takeoverWrap} data-testid="auth-takeover">
        {inner}
      </div>
    );
  }
  return (
    <main id="main" className={styles.wrap}>
      {inner}
    </main>
  );
}
