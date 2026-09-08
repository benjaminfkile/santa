import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { generateContracts } from "../../scripts/gen-contracts.mjs";

const ROOT = resolve(__dirname, "..", "..");
const CHECKED_IN = join(ROOT, "src", "contracts", "generated");

async function readDir(dir: string) {
  const files = new Map<string, string>();
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    files.set(entry.name, await readFile(join(dir, entry.name), "utf8"));
  }
  return files;
}

describe("contracts:types", () => {
  it("regenerating produces no diff against src/contracts/generated", async () => {
    const workDir = await mkdtemp(join(tmpdir(), "wmsfo-gen-"));
    try {
      await generateContracts({ outDir: workDir });
      const fresh = await readDir(workDir);
      const disk = await readDir(CHECKED_IN);
      expect([...fresh.keys()].sort()).toEqual([...disk.keys()].sort());
      for (const [name, freshBody] of fresh) {
        expect(freshBody, `${name} differs from checked-in copy`).toBe(disk.get(name));
      }
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }, 30_000);
});
