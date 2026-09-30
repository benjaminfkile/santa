// docs/site.md section 7.3. The credit line under a media entry drawn as
// a visible picture (media sections and rich text media blocks): the
// entry's `credit` as one small muted line that wraps when long. A null,
// absent, or blank credit, or an unresolvable id, renders nothing. The
// line belongs to the entry, not to a branch, so the dark and small
// screen versions draw above the same line.

import type { MediaRef } from "../../contracts";
import type { ContentBundle } from "../../store/types";
import * as styles from "./MediaCredit.module.css";

export function MediaCredit({
  media,
  bundle,
  className,
}: {
  media: MediaRef;
  bundle: ContentBundle;
  className?: string;
}) {
  const credit = bundle.media?.[media.mediaId]?.credit;
  if (typeof credit !== "string" || credit.trim() === "") return null;
  return (
    <p
      className={className ? `${styles.mediaCredit} ${className}` : styles.mediaCredit}
      data-testid="media-credit"
    >
      {credit}
    </p>
  );
}
