// docs/site.md section 7.5. Divider block: line, snowflakes, or lights.

import type { BlockComponent } from "../registry";
import * as styles from "../sections/RichText/RichText.module.css";

type DividerBlockData = { style?: "line" | "snowflakes" | "lights" };

export const DividerBlock: BlockComponent = ({ data }) => {
  const d = (data ?? {}) as DividerBlockData;
  const style = d.style ?? "line";
  const styleClass =
    style === "snowflakes"
      ? styles.blockDividerSnowflakes
      : style === "lights"
      ? styles.blockDividerLights
      : "";
  return (
    <div className={`${styles.blockDivider} ${styleClass}`.trim()} role="separator" />
  );
};
