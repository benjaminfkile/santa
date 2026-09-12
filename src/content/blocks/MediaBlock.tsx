// docs/site.md section 7.5. Media block: small 320 px, medium 640 px, or
// the frame width, with an optional <figcaption>.

import type { MediaRef } from "../../contracts";
import type { BlockComponent } from "../registry";
import { Media } from "../primitives/Media";
import { Inline } from "../inline/Inline";
import { useSnapshotEvent } from "./useSnapshotEvent";
import * as styles from "../sections/RichText/RichText.module.css";

type MediaBlockData = {
  media?: MediaRef;
  caption?: string | null;
  size?: "small" | "medium" | "full";
};

const FIXED_SIZES: Record<"small" | "medium", string> = {
  small: "320px",
  medium: "640px",
};

export const MediaBlock: BlockComponent = ({ data, bundle, frame }) => {
  const d = (data ?? {}) as MediaBlockData;
  const size = d.size ?? "full";
  const event = useSnapshotEvent();
  if (!d.media) return null;
  const sizeOverride = size === "full" ? undefined : FIXED_SIZES[size];
  const sizeClass =
    size === "small"
      ? styles.blockMediaSmall
      : size === "medium"
      ? styles.blockMediaMedium
      : styles.blockMediaFull;
  return (
    <figure className={`${styles.blockMedia} ${sizeClass}`}>
      <Media
        media={d.media}
        bundle={bundle}
        frame={frame ?? "narrow"}
        sizeOverride={sizeOverride}
      />
      {d.caption ? (
        <figcaption className={styles.blockMediaCaption}>
          <Inline text={d.caption} bundle={bundle} event={event} />
        </figcaption>
      ) : null}
    </figure>
  );
};
