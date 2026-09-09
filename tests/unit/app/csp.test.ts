// docs/site.md section 21.1. index.html carries a CSP meta and a
// preconnect using Vite's %VITE_*% replacement, so no environment value
// is written into the repository.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const INDEX_HTML = readFileSync(resolve(__dirname, "..", "..", "..", "index.html"), "utf8");

describe("index.html", () => {
  it("carries the CSP meta with %VITE_*% placeholders", () => {
    expect(INDEX_HTML).toMatch(/<meta http-equiv="Content-Security-Policy"/);
    expect(INDEX_HTML).toContain("default-src 'self'");
    expect(INDEX_HTML).toContain("%VITE_CDN_BASE_URL%");
    expect(INDEX_HTML).toContain("%VITE_API_BASE_URL%");
    expect(INDEX_HTML).toContain("%VITE_HUB_URL%");
    expect(INDEX_HTML).toContain("%VITE_COGNITO_AUTHORITY%");
    expect(INDEX_HTML).toContain("%VITE_COGNITO_DOMAIN%");
    expect(INDEX_HTML).toContain("https://maps.googleapis.com");
    expect(INDEX_HTML).toContain("https://www.googletagmanager.com");
    expect(INDEX_HTML).toContain("frame-src 'none'");
    expect(INDEX_HTML).toContain("object-src 'none'");
    expect(INDEX_HTML).toContain("base-uri 'self'");
  });

  it("carries the preconnect to the CDN base", () => {
    expect(INDEX_HTML).toMatch(/<link rel="preconnect" href="%VITE_CDN_BASE_URL%" crossorigin/);
  });

  it("does not hardcode any environment origin", () => {
    expect(INDEX_HTML).not.toMatch(/https:\/\/(?!maps|www\.googletagmanager|\*|maps\.gstatic|.*google-analytics)[a-z-]+\.(com|net|io|dev|app)/);
  });
});
