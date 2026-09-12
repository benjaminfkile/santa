// docs/site.md section 7.5. Quote block: <blockquote> with <cite>.

import type { BlockComponent } from "../registry";
import { Inline } from "../inline/Inline";
import { useSnapshotEvent } from "./useSnapshotEvent";
import * as styles from "../sections/RichText/RichText.module.css";

type QuoteData = { text?: string; attribution?: string | null };

export const QuoteBlock: BlockComponent = ({ data, bundle }) => {
  const d = (data ?? {}) as QuoteData;
  const event = useSnapshotEvent();
  return (
    <blockquote className={styles.blockQuote}>
      <p>
        <Inline text={d.text ?? ""} bundle={bundle} event={event} />
      </p>
      {d.attribution ? (
        <cite className={styles.blockQuoteCite}>
          <Inline text={d.attribution} bundle={bundle} event={event} />
        </cite>
      ) : null}
    </blockquote>
  );
};
