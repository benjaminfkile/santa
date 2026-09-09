// docs/site.md section 7.5. Paragraph block: <p> with inline text.

import type { BlockComponent } from "../registry";
import { Inline } from "../inline/Inline";
import { useSnapshotEvent } from "./useSnapshotEvent";

type ParagraphData = { text?: string };

export const ParagraphBlock: BlockComponent = ({ data, bundle }) => {
  const d = (data ?? {}) as ParagraphData;
  const event = useSnapshotEvent();
  return (
    <p className="block-paragraph">
      <Inline text={d.text ?? ""} bundle={bundle} event={event} />
    </p>
  );
};
