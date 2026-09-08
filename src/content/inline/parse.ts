// docs/site.md section 7.5. Parses the inline grammar into a token list.
// Mirrors the API's parser: **, *, backtick, [label](href), {icon:<id>},
// {icon:media:<uuid>}, {event:name}, {event:year}, {event:scheduledAt}, and
// newlines. Everything else is text. Unbalanced markers stay as text.

export type InlineNode =
  | { kind: "text"; text: string }
  | { kind: "br" }
  | { kind: "strong"; children: InlineNode[] }
  | { kind: "em"; children: InlineNode[] }
  | { kind: "code"; text: string }
  | { kind: "link"; label: InlineNode[]; href: string }
  | { kind: "icon"; source: "library" | "media"; id: string }
  | { kind: "placeholder"; field: "name" | "year" | "scheduledAt" };

const PLACEHOLDER_FIELDS: ReadonlySet<string> = new Set(["name", "year", "scheduledAt"]);

type Env = { input: string; i: number };

export function parseInline(input: string): InlineNode[] {
  return parseSpan({ input, i: 0 }, null);
}

function parseSpan(env: Env, closer: string | null): InlineNode[] {
  const out: InlineNode[] = [];
  let buf = "";
  const flush = () => {
    if (buf !== "") {
      out.push({ kind: "text", text: buf });
      buf = "";
    }
  };

  while (env.i < env.input.length) {
    if (closer !== null && env.input.startsWith(closer, env.i)) {
      flush();
      return out;
    }
    const ch = env.input[env.i];

    if (ch === "\n") {
      flush();
      out.push({ kind: "br" });
      env.i += 1;
      continue;
    }

    if (env.input.startsWith("**", env.i)) {
      const node = tryParseWrapped(env, "**", "strong");
      if (node !== null) {
        flush();
        out.push(node);
      } else {
        buf += "**";
        env.i += 2;
      }
      continue;
    }

    if (ch === "*") {
      const node = tryParseWrapped(env, "*", "em");
      if (node !== null) {
        flush();
        out.push(node);
      } else {
        buf += "*";
        env.i += 1;
      }
      continue;
    }

    if (ch === "`") {
      const node = tryParseCode(env);
      if (node !== null) {
        flush();
        out.push(node);
      } else {
        buf += "`";
        env.i += 1;
      }
      continue;
    }

    if (ch === "[") {
      const node = tryParseLink(env);
      if (node !== null) {
        flush();
        out.push(node);
      } else {
        buf += "[";
        env.i += 1;
      }
      continue;
    }

    if (ch === "{") {
      const node = tryParseBrace(env);
      if (node !== null) {
        flush();
        out.push(node);
      } else {
        buf += "{";
        env.i += 1;
      }
      continue;
    }

    buf += ch;
    env.i += 1;
  }

  flush();
  return out;
}

function tryParseWrapped(env: Env, marker: string, kind: "strong" | "em"): InlineNode | null {
  const start = env.i;
  env.i += marker.length;
  const child = parseSpan(env, marker);
  if (env.i >= env.input.length || !env.input.startsWith(marker, env.i)) {
    env.i = start;
    return null;
  }
  env.i += marker.length;
  if (child.length === 0) {
    env.i = start;
    return null;
  }
  return { kind, children: child };
}

function tryParseCode(env: Env): InlineNode | null {
  const start = env.i + 1;
  const end = env.input.indexOf("`", start);
  if (end === -1 || end === start) return null;
  const text = env.input.slice(start, end);
  env.i = end + 1;
  return { kind: "code", text };
}

function tryParseLink(env: Env): InlineNode | null {
  const start = env.i;
  const labelStart = start + 1;
  const labelEnd = env.input.indexOf("]", labelStart);
  if (labelEnd === -1) return null;
  if (env.input[labelEnd + 1] !== "(") return null;
  const hrefStart = labelEnd + 2;
  const hrefEnd = env.input.indexOf(")", hrefStart);
  if (hrefEnd === -1) return null;
  const labelText = env.input.slice(labelStart, labelEnd);
  const href = env.input.slice(hrefStart, hrefEnd);
  const label = parseInline(labelText);
  env.i = hrefEnd + 1;
  return { kind: "link", label, href };
}

function tryParseBrace(env: Env): InlineNode | null {
  const start = env.i;
  const end = env.input.indexOf("}", start + 1);
  if (end === -1) return null;
  const body = env.input.slice(start + 1, end);
  if (body.startsWith("icon:media:")) {
    const id = body.slice("icon:media:".length);
    if (id === "") return null;
    env.i = end + 1;
    return { kind: "icon", source: "media", id };
  }
  if (body.startsWith("icon:")) {
    const id = body.slice("icon:".length);
    if (id === "") return null;
    env.i = end + 1;
    return { kind: "icon", source: "library", id };
  }
  if (body.startsWith("event:")) {
    const field = body.slice("event:".length);
    if (!PLACEHOLDER_FIELDS.has(field)) return null;
    env.i = end + 1;
    return {
      kind: "placeholder",
      field: field as "name" | "year" | "scheduledAt",
    };
  }
  return null;
}
