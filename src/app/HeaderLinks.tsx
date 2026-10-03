// docs/site.md section 7.7. The header links: one anchor per
// `settings.headerLinks` entry, in order, first in the header's actions
// row at every width. Each is a 44 px button on the theme toggle recipe
// with the accent border, drawing the link's icon at 22 px (a library icon
// inline, a media icon through <img>); a link without an icon, or with one
// that resolves to nothing, draws the label's first letter in a circle.
// From 761 px up the label shows beside the icon inside the same button (a
// pill); below that the button holds the icon alone. A `newTab` link opens
// in a new tab with `rel="noopener"`.

import type { Link } from "../contracts";
import type { ContentBundle } from "../store/types";
import { Icon, iconResolves } from "../content/primitives/Icon";
import * as styles from "./Shell.module.css";

// The icon size inside the button; matches `.headerLinkIcon` in
// Shell.module.css.
const HEADER_LINK_ICON_PX = 22;

export type HeaderLinksProps = {
  links: readonly Link[] | null | undefined;
  bundle: ContentBundle | null;
};

export function HeaderLinks({ links, bundle }: HeaderLinksProps) {
  if (!links || links.length === 0) return null;
  return (
    <>
      {links.map((link, i) => (
        <a
          key={`${i}:${link.href}`}
          href={link.href}
          className={`${styles.themeToggle} ${styles.headerLink}`}
          aria-label={link.label}
          title={link.label}
          rel={link.newTab ? "noopener" : undefined}
          target={link.newTab ? "_blank" : undefined}
          data-testid="header-link"
        >
          <span className={styles.headerLinkIcon} aria-hidden>
            {link.icon !== null && bundle !== null && iconResolves(link.icon, bundle) ? (
              <Icon
                icon={{ source: link.icon.source, id: link.icon.id }}
                bundle={bundle}
                alt=""
                decorative
                size={HEADER_LINK_ICON_PX}
              />
            ) : (
              <span className={styles.headerLinkLetter} data-testid="header-link-letter">
                {firstLetter(link.label)}
              </span>
            )}
          </span>
          <span className={styles.headerLinkLabel} aria-hidden data-testid="header-link-label">
            {link.label}
          </span>
        </a>
      ))}
    </>
  );
}

function firstLetter(label: string): string {
  return (Array.from(label.trim())[0] ?? "").toUpperCase();
}
