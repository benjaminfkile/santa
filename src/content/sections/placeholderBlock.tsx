// docs/site.md section 7.5 (S3). Placeholder block components. Real
// block components are added in S4.

import type { BlockComponent } from "../registry";

export function placeholderBlock(kind: string): BlockComponent {
  function Block() {
    return (
      <div data-placeholder-block={kind} className={`placeholder-block placeholder-block--${kind}`}>
        <span>{kind}</span>
      </div>
    );
  }
  Block.displayName = `PlaceholderBlock(${kind})`;
  return Block;
}
