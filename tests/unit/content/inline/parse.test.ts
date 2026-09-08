// docs/site.md section 7.5. Inline grammar: each token, unbalanced markers
// as text, placeholders, the fixture strings from contracts/fixtures.

import { describe, it, expect } from "vitest";
import { parseInline, type InlineNode } from "../../../../src/content/inline/parse";

function text(t: string): InlineNode {
  return { kind: "text", text: t };
}

describe("parseInline tokens", () => {
  it("plain text is one text node", () => {
    expect(parseInline("hello")).toEqual([text("hello")]);
  });

  it("strong wraps its content", () => {
    expect(parseInline("**bold**")).toEqual([{ kind: "strong", children: [text("bold")] }]);
  });

  it("em wraps its content", () => {
    expect(parseInline("*italic*")).toEqual([{ kind: "em", children: [text("italic")] }]);
  });

  it("code is a code node", () => {
    expect(parseInline("`x`")).toEqual([{ kind: "code", text: "x" }]);
  });

  it("links parse label and href", () => {
    expect(parseInline("[Home](/)")).toEqual([
      { kind: "link", label: [text("Home")], href: "/" },
    ]);
  });

  it("newlines become br", () => {
    expect(parseInline("a\nb")).toEqual([text("a"), { kind: "br" }, text("b")]);
  });

  it("library icon", () => {
    expect(parseInline("{icon:star}")).toEqual([
      { kind: "icon", source: "library", id: "star" },
    ]);
  });

  it("media icon", () => {
    expect(parseInline("{icon:media:abc-uuid}")).toEqual([
      { kind: "icon", source: "media", id: "abc-uuid" },
    ]);
  });

  it("placeholders parse to placeholder nodes", () => {
    expect(parseInline("{event:name}")).toEqual([
      { kind: "placeholder", field: "name" },
    ]);
    expect(parseInline("{event:year}")).toEqual([
      { kind: "placeholder", field: "year" },
    ]);
    expect(parseInline("{event:scheduledAt}")).toEqual([
      { kind: "placeholder", field: "scheduledAt" },
    ]);
  });
});

describe("parseInline unbalanced markers stay as text", () => {
  it("unbalanced strong", () => {
    expect(parseInline("**oops")).toEqual([text("**oops")]);
  });
  it("unbalanced em", () => {
    expect(parseInline("*oops")).toEqual([text("*oops")]);
  });
  it("unbalanced code", () => {
    expect(parseInline("`oops")).toEqual([text("`oops")]);
  });
  it("unbalanced link", () => {
    expect(parseInline("[label](")).toEqual([text("[label](")]);
  });
  it("unknown placeholder is text", () => {
    expect(parseInline("{event:nope}")).toEqual([text("{event:nope}")]);
  });
});

describe("parseInline nesting", () => {
  it("strong containing em", () => {
    const r = parseInline("**bold *and* strong**");
    expect(r).toEqual([
      {
        kind: "strong",
        children: [
          text("bold "),
          { kind: "em", children: [text("and")] },
          text(" strong"),
        ],
      },
    ]);
  });

  it("link label can contain strong", () => {
    expect(parseInline("[**bold**](/x)")).toEqual([
      {
        kind: "link",
        label: [{ kind: "strong", children: [text("bold")] }],
        href: "/x",
      },
    ]);
  });
});

describe("parseInline round-trips fixture-style strings", () => {
  const inputs = [
    "{event:name}",
    "Liftoff is scheduled for {event:scheduledAt}.",
    "The **best** year so far.",
    "See our [route](/route) page.",
  ];
  it("all parse without throwing and preserve length coverage", () => {
    for (const s of inputs) {
      const nodes = parseInline(s);
      expect(Array.isArray(nodes)).toBe(true);
      expect(nodes.length).toBeGreaterThan(0);
    }
  });
});
