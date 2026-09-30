// docs/site.md section 7.7. The priority-plus collapse math for the header's
// inline nav: how many items, counted from the first, stay in the row when
// the rest go to the More bucket.

export type NavFit = {
  // The natural width of each item, in nav order.
  widths: number[];
  // The gap between neighbouring items, and between the last shown item and
  // the More button.
  gap: number;
  // The natural width of the More button.
  moreWidth: number;
  // The width the nav has to lay out in.
  available: number;
};

// A sub-pixel allowance so rounding in measured widths never collapses an
// item that fits.
const EPSILON = 0.5;

// The number of leading items that stay in the row. Every item stays when
// the whole row fits; otherwise items leave from the end until the row plus
// the More button fits, down to zero (only More shows).
export function visibleCount({ widths, gap, moreWidth, available }: NavFit): number {
  const n = widths.length;
  if (rowWidth(widths, n, gap) <= available + EPSILON) return n;
  for (let k = n - 1; k > 0; k--) {
    const row = rowWidth(widths, k, gap) + gap + moreWidth;
    if (row <= available + EPSILON) return k;
  }
  return 0;
}

// The width of the first `count` items laid out with `gap` between them.
function rowWidth(widths: number[], count: number, gap: number): number {
  if (count === 0) return 0;
  let sum = gap * (count - 1);
  for (let i = 0; i < count; i++) sum += widths[i];
  return sum;
}
