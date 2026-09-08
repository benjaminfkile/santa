#!/usr/bin/env node
// Fetches contracts/ at CONTRACTS_SHA from the wmsfo-api repository and fails
// on any byte-level difference from the vendored copy. docs/site.md 21.3.

import { spawn } from "node:child_process";
import { readFile, readdir, mkdtemp, rm } from "node:fs/promises";
import { existsSync, createWriteStream } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, posix, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const CONTRACTS = join(ROOT, "contracts");
const SHA_FILE = join(ROOT, "CONTRACTS_SHA");
const REPO = process.env.WMSFO_API_REPO || "benjaminfkile/wmsfo-api";

async function readSha() {
  if (!existsSync(SHA_FILE)) throw new Error(`Missing ${SHA_FILE}`);
  const sha = (await readFile(SHA_FILE, "utf8")).trim();
  if (!/^[0-9a-f]{40}$/.test(sha)) {
    throw new Error(`CONTRACTS_SHA must be a 40-char hex commit SHA, got: ${sha}`);
  }
  return sha;
}

async function downloadTarball(sha, destTarGz) {
  const url = `https://codeload.github.com/${REPO}/tar.gz/${sha}`;
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const headers = { "User-Agent": "wmsfo-site-contracts-check" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { headers, redirect: "follow" });
  if (!res.ok) {
    throw new Error(`Failed to download tarball ${url}: ${res.status} ${res.statusText}`);
  }
  await pipeline(Readable.fromWeb(res.body), createWriteStream(destTarGz));
}

function extract(tarGz, destDir) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn("tar", ["xzf", tarGz, "-C", destDir], { stdio: ["ignore", "inherit", "inherit"] });
    child.on("close", (code) => {
      if (code === 0) resolvePromise();
      else rejectPromise(new Error(`tar exited with code ${code}`));
    });
    child.on("error", rejectPromise);
  });
}

async function walk(dir, prefix = "") {
  const out = new Map();
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    const rel = prefix ? posix.join(prefix, entry.name) : entry.name;
    if (entry.isDirectory()) {
      const sub = await walk(abs, rel);
      for (const [k, v] of sub) out.set(k, v);
    } else if (entry.isFile()) {
      out.set(rel, await readFile(abs));
    }
  }
  return out;
}

function toPosix(p) {
  return sep === "/" ? p : p.split(sep).join("/");
}

async function findExtractedContractsDir(extractRoot) {
  for (const entry of await readdir(extractRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const candidate = join(extractRoot, entry.name, "contracts");
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`No contracts/ directory found inside ${extractRoot}`);
}

async function main() {
  if (!existsSync(CONTRACTS)) throw new Error(`Missing contracts/ at ${CONTRACTS}`);
  const sha = await readSha();
  console.log(`Checking contracts/ against ${REPO}@${sha}`);
  const work = await mkdtemp(join(tmpdir(), "wmsfo-contracts-"));
  try {
    const tarball = join(work, "src.tar.gz");
    await downloadTarball(sha, tarball);
    await extract(tarball, work);
    const remoteDir = await findExtractedContractsDir(work);
    const remoteRaw = await walk(remoteDir);
    const localRaw = await walk(CONTRACTS);
    const remote = new Map();
    const local = new Map();
    for (const [k, v] of remoteRaw) remote.set(toPosix(k), v);
    for (const [k, v] of localRaw) local.set(toPosix(k), v);

    const problems = [];
    const seen = new Set();
    for (const [path, remoteBytes] of remote) {
      seen.add(path);
      const localBytes = local.get(path);
      if (!localBytes) {
        problems.push(`missing locally: contracts/${path}`);
        continue;
      }
      if (!localBytes.equals(remoteBytes)) {
        problems.push(
          `differs: contracts/${path} (local ${localBytes.length} B vs remote ${remoteBytes.length} B)`
        );
      }
    }
    for (const path of local.keys()) {
      if (!seen.has(path)) problems.push(`extra locally: contracts/${path}`);
    }
    if (problems.length > 0) {
      console.error(`contracts drift at ${sha}:`);
      for (const p of problems) console.error(`  - ${p}`);
      console.error(
        "The vendored contracts/ folder no longer matches the wmsfo-api commit named in CONTRACTS_SHA."
      );
      process.exit(1);
    }
    console.log(`OK: ${remote.size} files match ${sha}`);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err.stack || String(err));
  process.exit(1);
});
