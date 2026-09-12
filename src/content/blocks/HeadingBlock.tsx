// docs/site.md section 7.5. Heading block: h1/h2/h3 by level, icon before.

import type { IconRef } from "../../contracts";
import type { BlockComponent } from "../registry";
import { Inline } from "../inline/Inline";
import { Icon } from "../primitives/Icon";
import { useSnapshotEvent } from "./useSnapshotEvent";
import * as styles from "../sections/RichText/RichText.module.css";

type HeadingData = {
  level?: 1 | 2 | 3;
  text?: string;
  icon?: IconRef | null;
};

function readData(data: unknown): HeadingData {
  if (data === null || typeof data !== "object") return {};
  return data as HeadingData;
}

export const HeadingBlock: BlockComponent = ({ data, bundle }) => {
  const d = readData(data);
  const level = d.level ?? 2;
  const event = useSnapshotEvent();
  const Tag: "h1" | "h2" | "h3" = level === 1 ? "h1" : level === 3 ? "h3" : "h2";
  const levelClass =
    level === 1
      ? styles.blockHeadingH1
      : level === 3
      ? styles.blockHeadingH3
      : styles.blockHeadingH2;
  return (
    <Tag className={`${styles.blockHeading} ${levelClass}`}>
      {d.icon ? (
        <span className={styles.blockHeadingIcon} aria-hidden>
          <Icon icon={d.icon} bundle={bundle} decorative inline />
        </span>
      ) : null}
      <Inline text={d.text ?? ""} bundle={bundle} event={event} />
    </Tag>
  );
};
