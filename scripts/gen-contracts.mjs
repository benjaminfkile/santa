#!/usr/bin/env node
// Regenerates the TypeScript types from the vendored contracts/ folder.
// docs/site.md section 2 (project structure) and section 21.3 (CI).

import { spawn } from "node:child_process";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "json-schema-to-typescript";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const CONTRACTS = join(ROOT, "contracts");
const SCHEMA_DIR = join(CONTRACTS, "schema");
const DEFAULT_OUT = join(ROOT, "src", "contracts", "generated");
const OPENAPI_BIN = join(ROOT, "node_modules", ".bin", "openapi-typescript");

export const BANNER =
  "/**\n" +
  " * AUTO-GENERATED FILE. Do not edit by hand.\n" +
  " * Run `npm run contracts:types` to regenerate from contracts/.\n" +
  " */";

export const JSTT_TARGETS = [
  { schema: "live-object.schema.json", name: "LiveObject", out: "live-object.ts" },
  { schema: "snapshot.schema.json", name: "Snapshot", out: "snapshot.ts" },
  { schema: "route.schema.json", name: "Route", out: "route.ts" },
  { schema: "content-document.schema.json", name: "ContentDocument", out: "content-document.ts" },
];

async function readSchemasById() {
  const map = new Map();
  const walk = async (dir) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) await walk(p);
      else if (entry.name.endsWith(".schema.json")) {
        const json = JSON.parse(await readFile(p, "utf8"));
        if (typeof json.$id === "string") map.set(json.$id, json);
      }
    }
  };
  await walk(SCHEMA_DIR);
  return map;
}

async function compileJsttInto(outDir) {
  const schemasById = await readSchemasById();
  const wmsfoResolver = {
    order: 1,
    canRead: /^https:\/\/wmsfo\.dev\/schema\//,
    read: (file) => {
      const known = schemasById.get(file.url);
      if (known) return JSON.stringify(known);
      throw new Error(`Unknown schema $id: ${file.url}`);
    },
  };
  const options = {
    bannerComment: BANNER,
    additionalProperties: false,
    strictIndexSignatures: true,
    style: { singleQuote: false },
    cwd: SCHEMA_DIR,
    $refOptions: { resolve: { wmsfo: wmsfoResolver } },
  };
  const results = new Map();
  for (const { schema, name, out } of JSTT_TARGETS) {
    const source = JSON.parse(await readFile(join(SCHEMA_DIR, schema), "utf8"));
    const ts = await compile(source, name, options);
    await writeFile(join(outDir, out), ts, "utf8");
    results.set(out, ts);
  }
  return results;
}

function runOpenapiTypescript(outFile) {
  return new Promise((resolvePromise, rejectPromise) => {
    const args = [join(CONTRACTS, "openapi.json"), "--output", outFile];
    const child = spawn(OPENAPI_BIN, args, { stdio: ["ignore", "pipe", "inherit"] });
    let out = "";
    child.stdout?.on("data", (c) => (out += c.toString()));
    child.on("close", (code) => {
      if (code === 0) resolvePromise(out);
      else rejectPromise(new Error(`openapi-typescript exited with code ${code}: ${out}`));
    });
    child.on("error", rejectPromise);
  });
}

async function ensureBanner(file) {
  const body = await readFile(file, "utf8");
  if (body.startsWith(BANNER)) return body;
  const next = BANNER + "\n" + body;
  await writeFile(file, next, "utf8");
  return next;
}

export async function generateContracts({ outDir = DEFAULT_OUT } = {}) {
  if (!existsSync(CONTRACTS)) throw new Error(`Missing contracts/ at ${CONTRACTS}`);
  await mkdir(outDir, { recursive: true });
  const openapiOut = join(outDir, "openapi.ts");
  await runOpenapiTypescript(openapiOut);
  await ensureBanner(openapiOut);
  await compileJsttInto(outDir);
}

const isMain = fileURLToPath(import.meta.url) === resolve(process.argv[1] || "");
if (isMain) {
  generateContracts().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
