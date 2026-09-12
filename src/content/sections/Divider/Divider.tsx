// docs/site.md section 7.4. Divider section: line, snowflakes, or lights.

import type { SectionComponent } from "../../registry";
import * as styles from "./Divider.module.css";

type DividerData = { style?: "line" | "snowflakes" | "lights" };

export const Divider: SectionComponent = ({ data }) => {
  const d = (data ?? {}) as DividerData;
  const style = d.style ?? "line";
  const variantClass =
    style === "snowflakes"
      ? styles.dividerSnowflakes
      : style === "lights"
      ? styles.dividerLights
      : "";
  return (
    <div
      className={`${styles.divider} ${variantClass}`.trim()}
      role="separator"
      data-divider-style={style}
    />
  );
};
