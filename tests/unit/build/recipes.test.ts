// docs/site.md section 7.3. One component recipe set: the button, icon
// button, and pill recipes live in src/ui, and every caller composes them.
// No CSS module outside src/ui declares a 40 px button of its own, and the
// header, the banner, the sponsor dialog, and the dialog chips compose the
// recipes by name.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve, sep } from "node:path";
import { describe, it, expect } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const srcRoot = resolve(repoRoot, "src");
const uiRoot = resolve(srcRoot, "ui");

function walk(dir: string, hits: string[]): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const info = statSync(full);
    if (info.isDirectory()) walk(full, hits);
    else if (info.isFile() && full.endsWith(".module.css")) hits.push(full);
  }
  return hits;
}

function read(path: string): string {
  return readFileSync(resolve(srcRoot, path), "utf8");
}

// The declarations of the first rule whose selector is exactly `selector`.
function rule(sheet: string, selector: string): string {
  const bare = sheet.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const chunk of bare.split("}")) {
    const open = chunk.lastIndexOf("{");
    if (open !== -1 && chunk.slice(0, open).trim() === selector) return chunk.slice(open + 1);
  }
  throw new Error(`rule not found: ${selector}`);
}

const BUTTON = '"../ui/Button.module.css"';
const ICON_BUTTON = '"../ui/IconButton.module.css"';

describe("the component recipe set", () => {
  it("no CSS module outside src/ui declares a 40 px button of its own", () => {
    const modules = walk(srcRoot, []);
    expect(modules.length).toBeGreaterThan(10);
    const offenders = modules
      .filter((file) => !file.startsWith(uiRoot + sep))
      .filter((file) => /min-height:\s*40px/.test(readFileSync(file, "utf8")))
      .map((file) => relative(repoRoot, file));
    expect(offenders).toEqual([]);
  });

  it("the button and icon button recipes are round fills without borders", () => {
    const button = read("ui/Button.module.css");
    const btn = rule(button, ".btn");
    expect(btn).toMatch(/border-radius: var\(--radius-control\);/);
    expect(btn).toMatch(/border: 0;/);
    expect(btn).toMatch(/background: var\(--accent-soft\);/);
    expect(rule(button, ".btnFill")).toMatch(/background: var\(--accent\);/);
    expect(rule(button, ".btnQuiet")).toMatch(/background: var\(--panel-2\);/);
    expect(button).toMatch(/:global\(:root\[data-theme="light"\]\) \.btnFill:hover:not\(:disabled\) \{ filter: brightness\(0\.94\); \}/);
    expect(button).toMatch(/:global\(:root\[data-theme="dark"\]\) \.btnFill:hover:not\(:disabled\) \{ filter: brightness\(1\.12\); \}/);
    const ibtn = rule(read("ui/IconButton.module.css"), ".ibtn");
    expect(ibtn).toMatch(/border-radius: var\(--radius-control\);/);
    expect(ibtn).toMatch(/border: 0;/);
    expect(ibtn).toMatch(/background: var\(--panel-2\);/);
  });

  it("the pill recipe is sans on a 14 percent tint of its own colour", () => {
    const pill = rule(read("ui/Pill.module.css"), ".pill");
    expect(pill).toMatch(/font-family: var\(--font-sans\);/);
    expect(pill).toMatch(/text-transform: none;/);
    expect(pill).toMatch(/background: color-mix\(in srgb, currentColor 14%, transparent\);/);
    expect(pill).toMatch(/border: 0;/);
  });

  it("the header and the banner compose the recipes", () => {
    const shell = read("app/Shell.module.css");
    expect(rule(shell, ".signIn")).toContain(`composes: btn from ${BUTTON}`);
    expect(rule(shell, ".headerLink")).toContain(`composes: btn from ${BUTTON}`);
    expect(rule(shell, ".menuButton,\n.themeToggle")).toContain(`composes: ibtn from ${ICON_BUTTON}`);
    expect(rule(shell, ".bannerAction")).toContain('composes: pill pillAccent from "../ui/Pill.module.css"');
  });

  it("the sponsor dialog composes the secondary and the quiet buttons", () => {
    const sheet = read("content/sections/SponsorCarousel/SponsorCarousel.module.css");
    expect(rule(sheet, ".sponsorDialogLink")).toContain('composes: btn from "../../../ui/Button.module.css"');
    expect(rule(sheet, ".sponsorDialogClose")).toContain('composes: btnQuiet from "../../../ui/Button.module.css"');
  });

  it("the dialog chips and the status pill compose the pill recipe", () => {
    const alerts = read("alerts/Alerts.module.css");
    expect(rule(alerts, ".kind")).toContain('composes: pill from "../ui/Pill.module.css"');
    expect(rule(alerts, ".fresh")).toContain('composes: pill pillErr from "../ui/Pill.module.css"');
    const messages = read("content/sections/Map/MessagesDialog.module.css");
    expect(rule(messages, ".fresh")).toContain('composes: pill pillErr from "../../../ui/Pill.module.css"');
    const status = read("content/primitives/StatusPill.module.css");
    expect(rule(status, ".statusPill")).toContain('composes: pill from "../../ui/Pill.module.css"');
  });
});
