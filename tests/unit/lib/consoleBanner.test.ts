import { describe, expect, it } from "vitest";
import { buildBanner } from "../../../src/lib/consoleBanner";

describe("buildBanner", () => {
  it("has one style argument per %c segment", () => {
    const [format, ...styles] = buildBanner();
    expect(format.split("%c").length - 1).toBe(styles.length);
  });

  it("merges runs of one colour into a single segment", () => {
    const [format, ...styles] = buildBanner(["..RR"]);
    expect(styles.length).toBe(4); // two runs plus the two credit lines
    expect(format.startsWith("%c    %c    ")).toBe(true);
  });
});
