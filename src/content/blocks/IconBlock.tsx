// docs/site.md section 7.5. Icon block: one icon at sm 24, md 48, lg 96,
// xl 160 px, aligned.

import type { IconRef } from "../../contracts";
import type { BlockComponent } from "../registry";
import { Icon } from "../primitives/Icon";
import * as styles from "../sections/RichText/RichText.module.css";

type IconBlockData = {
  icon?: IconRef;
  size?: "sm" | "md" | "lg" | "xl";
  align?: "start" | "center";
};

const ICON_SIZES: Record<"sm" | "md" | "lg" | "xl", number> = {
  sm: 24,
  md: 48,
  lg: 96,
  xl: 160,
};

export const IconBlock: BlockComponent = ({ data, bundle }) => {
  const d = (data ?? {}) as IconBlockData;
  if (!d.icon) return null;
  const size = d.size ?? "md";
  const align = d.align ?? "start";
  const alignClass = align === "center" ? styles.blockIconCenter : styles.blockIconStart;
  return (
    <div className={`${styles.blockIcon} ${alignClass}`}>
      <Icon icon={d.icon} bundle={bundle} decorative size={ICON_SIZES[size]} />
    </div>
  );
};
