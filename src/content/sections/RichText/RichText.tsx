// docs/site.md section 7.4. Rich text section: renders each block through
// registry.blocks; an unknown block kind renders nothing. textSize "large"
// marks the root so paragraphs, list items, and quotes draw larger.
// Section 7.5: a block with its own `align` marks its own root with
// `data-align`, which RichText.module.css lets beat the section align.

import type { SectionComponent } from "../../registry";
import { registry } from "../../registry";
import * as styles from "./RichText.module.css";

type Block = { kind: string } & Record<string, unknown>;

type RichTextData = { blocks?: Block[]; textSize?: "normal" | "large" | null };

export const RichText: SectionComponent = ({ data, bundle, frame }) => {
  const d = (data ?? {}) as RichTextData;
  const blocks = Array.isArray(d.blocks) ? d.blocks : [];
  const large = d.textSize === "large";
  return (
    <div
      className={large ? `${styles.richText} ${styles.textLarge}` : styles.richText}
      data-text-size={large ? "large" : undefined}
    >
      {blocks.map((block, i) => {
        const Block = registry.blocks[block.kind];
        if (!Block) return null;
        return <Block key={i} data={block} bundle={bundle} frame={frame} />;
      })}
    </div>
  );
};
