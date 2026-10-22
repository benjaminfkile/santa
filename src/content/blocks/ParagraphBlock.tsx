// docs/site.md section 7.5. Paragraph block: <p> with inline text.

import type { BlockComponent } from "../registry";
import { Inline } from "../inline/Inline";
import { useSnapshotEvent } from "./useSnapshotEvent";
import { blockAlign } from "./blockAlign";
import * as styles from "../sections/RichText/RichText.module.css";

type ParagraphData = { text?: string };

export const ParagraphBlock: BlockComponent = ({ data, bundle }) => {
  const d = (data ?? {}) as ParagraphData;
  const event = useSnapshotEvent();
  return (
    <p className={styles.blockParagraph} data-align={blockAlign(data)}>
      <Inline text={d.text ?? ""} bundle={bundle} event={event} />
    </p>
  );
};
