// docs/site.md section 7.5. Divider block: line, snowflakes, or lights.

import type { BlockComponent } from "../registry";

type DividerBlockData = { style?: "line" | "snowflakes" | "lights" };

export const DividerBlock: BlockComponent = ({ data }) => {
  const d = (data ?? {}) as DividerBlockData;
  const style = d.style ?? "line";
  return <div className={`block-divider block-divider--${style}`} role="separator" />;
};
