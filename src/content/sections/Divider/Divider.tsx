// docs/site.md section 7.4. Divider section: line, snowflakes, or lights.

import type { SectionComponent } from "../../registry";

type DividerData = { style?: "line" | "snowflakes" | "lights" };

export const Divider: SectionComponent = ({ data }) => {
  const d = (data ?? {}) as DividerData;
  const style = d.style ?? "line";
  return <div className={`divider divider--${style}`} role="separator" />;
};
