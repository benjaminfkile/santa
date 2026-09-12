// docs/site.md section 7.5. List block: bullet, numbered, or icon-marked.

import type { IconRef } from "../../contracts";
import type { BlockComponent } from "../registry";
import { Inline } from "../inline/Inline";
import { Icon } from "../primitives/Icon";
import { useSnapshotEvent } from "./useSnapshotEvent";
import * as styles from "../sections/RichText/RichText.module.css";

type ListData = {
  style?: "bullet" | "number" | "icon";
  icon?: IconRef | null;
  items?: string[];
};

export const ListBlock: BlockComponent = ({ data, bundle }) => {
  const d = (data ?? {}) as ListData;
  const style = d.style ?? "bullet";
  const items = Array.isArray(d.items) ? d.items : [];
  const event = useSnapshotEvent();
  const Tag: "ol" | "ul" = style === "number" ? "ol" : "ul";
  const styleClass = style === "icon" ? styles.blockListIcon : "";
  return (
    <Tag className={`${styles.blockList} ${styleClass}`.trim()}>
      {items.map((text, i) => (
        <li key={i} className={styles.blockListItem}>
          {style === "icon" && d.icon ? (
            <span className={styles.blockListIconMark} aria-hidden>
              <Icon icon={d.icon} bundle={bundle} decorative inline />
            </span>
          ) : null}
          <Inline text={text} bundle={bundle} event={event} />
        </li>
      ))}
    </Tag>
  );
};
