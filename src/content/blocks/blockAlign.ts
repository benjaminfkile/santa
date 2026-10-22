// docs/site.md section 7.5. A block's own `align`: "start" or "center" when
// the block sets one, undefined otherwise, so the block root carries
// `data-align` only when the block overrides the section's align.

export type BlockAlign = "start" | "center";

export function blockAlign(data: unknown): BlockAlign | undefined {
  if (data === null || typeof data !== "object") return undefined;
  const align = (data as { align?: unknown }).align;
  return align === "start" || align === "center" ? align : undefined;
}
