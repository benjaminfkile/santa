// docs/site.md section 7.3. Renders links: router links for site paths,
// <a> for absolute URLs and mailto.

import { Link as RouterLink } from "react-router-dom";
import type { ReactNode } from "react";
import type { Link } from "../../contracts";
import type { ContentBundle } from "../../store/types";
import { Icon } from "./Icon";

function isInternal(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//");
}

export type LinkViewProps = {
  href: string;
  bundle: ContentBundle;
  newTab?: boolean;
  className?: string;
  children: ReactNode;
};

export function LinkView({ href, bundle: _bundle, newTab = false, className, children }: LinkViewProps) {
  void _bundle;
  if (isInternal(href)) {
    return (
      <RouterLink to={href} className={className}>
        {children}
      </RouterLink>
    );
  }
  const rel = "noopener noreferrer";
  return (
    <a
      href={href}
      className={className}
      rel={rel}
      target={newTab ? "_blank" : undefined}
    >
      {children}
    </a>
  );
}

export type ContentLinkProps = {
  link: Link;
  bundle: ContentBundle;
  className?: string;
};

export function ContentLink({ link, bundle, className }: ContentLinkProps) {
  return (
    <LinkView href={link.href} bundle={bundle} newTab={link.newTab} className={className}>
      {link.icon !== null ? (
        <Icon icon={link.icon} bundle={bundle} alt="" decorative inline />
      ) : null}
      <span>{link.label}</span>
    </LinkView>
  );
}
