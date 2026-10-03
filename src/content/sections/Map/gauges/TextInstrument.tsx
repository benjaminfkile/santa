// docs/site.md section 7.6. One dock slot as plain text: the value in the
// mono pill font, the unit under it, the label under that.

import * as styles from "./TextInstrument.module.css";

export type TextInstrumentProps = {
  value: string;
  unit: string;
  label: string;
  testId: string;
};

export function TextInstrument({ value, unit, label, testId }: TextInstrumentProps) {
  return (
    <div className={styles.instrument} data-testid={testId}>
      <span className={styles.value} data-testid={`${testId}-value`}>{value}</span>
      <span className={styles.unit}>{unit}</span>
      <span className={styles.label}>{label}</span>
    </div>
  );
}
