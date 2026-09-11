#!/usr/bin/env node
// docs/site.md section 7.7. Turns each contracts/icons/<id>.svg into a
// React component at src/content/icons/generated/<id>.tsx. Every icon has
// stroke="currentColor" so it takes the accent from CSS. Runs by prebuild
// and by tests/unit/content/icons/generator.test.ts (staleness check).

import { readFile, writeFile, readdir, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const ICONS_SRC = join(ROOT, "contracts", "icons");
const OUT_DIR = join(ROOT, "src", "content", "icons", "generated");

export const BANNER =
  "/**\n" +
  " * AUTO-GENERATED FILE. Do not edit by hand.\n" +
  " * Run `npm run icons:gen` to regenerate from contracts/icons/.\n" +
  " */";

function toPascalCase(id) {
  return id
    .split(/[-_]/)
    .filter(Boolean)
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join("");
}

function extractInner(svg) {
  const openStart = svg.indexOf("<svg");
  if (openStart === -1) throw new Error("no <svg> in source");
  const openEnd = svg.indexOf(">", openStart);
  if (openEnd === -1) throw new Error("unterminated <svg> tag");
  const closeStart = svg.lastIndexOf("</svg>");
  if (closeStart === -1) throw new Error("no </svg> in source");
  return svg.slice(openEnd + 1, closeStart).trim();
}

function svgToTsx(id, svg) {
  const inner = extractInner(svg);
  const converted = convertAttrs(inner);
  const Name = toPascalCase(id);
  return `${BANNER}
import type { SVGProps } from "react";

export function ${Name}Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      ${converted}
    </svg>
  );
}
`;
}

const ATTR_MAP = {
  "stroke-width": "strokeWidth",
  "stroke-linecap": "strokeLinecap",
  "stroke-linejoin": "strokeLinejoin",
  "stroke-miterlimit": "strokeMiterlimit",
  "stroke-dasharray": "strokeDasharray",
  "stroke-dashoffset": "strokeDashoffset",
  "fill-rule": "fillRule",
  "clip-rule": "clipRule",
  "xmlns:xlink": "xmlnsXlink",
  "xlink:href": "xlinkHref",
};

function convertAttrs(source) {
  return source.replace(/\s([a-z-]+)="([^"]*)"/g, (match, name, value) => {
    const jsName = ATTR_MAP[name] ?? (name.includes("-") ? name.replace(/-([a-z])/g, (_, c) => c.toUpperCase()) : name);
    return ` ${jsName}="${value}"`;
  });
}

export async function collectIconIds() {
  const entries = await readdir(ICONS_SRC, { withFileTypes: true });
  const ids = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(".svg")) continue;
    ids.push(entry.name.slice(0, -4));
  }
  ids.sort();
  return ids;
}

export async function computeIconOutputs() {
  const ids = await collectIconIds();
  const files = new Map();
  for (const id of ids) {
    const source = await readFile(join(ICONS_SRC, `${id}.svg`), "utf8");
    files.set(`${id}.tsx`, svgToTsx(id, source));
  }
  files.set("index.ts", buildIndex(ids));
  return files;
}

function buildIndex(ids) {
  const imports = ids
    .map((id) => `import { ${toPascalCase(id)}Icon } from "./${id}";`)
    .join("\n");
  const entries = ids.map((id) => `  "${id}": ${toPascalCase(id)}Icon,`).join("\n");
  return `${BANNER}
import type { ComponentType, SVGProps } from "react";
${imports}

export type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

export const LIBRARY_ICONS: Record<string, IconComponent> = {
${entries}
};

export const LIBRARY_ICON_IDS: readonly string[] = Object.freeze(Object.keys(LIBRARY_ICONS));
`;
}

export async function generateIcons() {
  if (!existsSync(ICONS_SRC)) throw new Error(`Missing ${ICONS_SRC}`);
  const outputs = await computeIconOutputs();
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });
  for (const [name, body] of outputs) {
    await writeFile(join(OUT_DIR, name), body, "utf8");
  }
}

const isMain = fileURLToPath(import.meta.url) === resolve(process.argv[1] || "");
if (isMain) {
  generateIcons().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
