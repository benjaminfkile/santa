// docs/site.md section 22.2. Helpers reading data-testid attributes and,
// on preview builds, window.__wmsfo.getState(). The site exposes
// __wmsfo only when VITE_ENV !== "production" (see src/main.tsx).

import { e2eEnv } from "./env";

type PageLike = {
  evaluate: <T>(fn: string | ((...args: unknown[]) => T)) => Promise<T>;
  goto: (url: string, opts?: unknown) => Promise<unknown>;
  locator: (selector: string) => Locator;
  waitForFunction: (fn: string | ((...args: unknown[]) => unknown), arg?: unknown, opts?: { timeout?: number }) => Promise<unknown>;
};

type Locator = {
  first: () => Locator;
  count: () => Promise<number>;
  textContent: () => Promise<string | null>;
  getAttribute: (name: string) => Promise<string | null>;
};

export type SiteState = {
  live: { seq: number | null; eventStatusId: number | null; lat: number | null; lng: number | null; speedMps: number | null } | null;
  snapshot: { event: { latestMessage?: { body: string } | null } | null } | null;
  hub: string;
};

export async function goto(page: PageLike, path: string): Promise<void> {
  await page.goto(`${e2eEnv.BASE_URL}${path}`, { waitUntil: "domcontentloaded" });
}

export async function getState(page: PageLike): Promise<SiteState> {
  return page.evaluate(
    "(window.__wmsfo && window.__wmsfo.getState()) ?? { live: null, snapshot: null, hub: 'disconnected' }",
  ) as Promise<SiteState>;
}

export function byTestId(page: PageLike, id: string): Locator {
  return page.locator(`[data-testid="${id}"]`);
}

export async function waitForState(
  page: PageLike,
  predicate: (s: SiteState, arg?: unknown) => boolean,
  timeoutMs: number,
  arg?: unknown,
): Promise<void> {
  // The predicate is stringified and runs in the page, so it must not close
  // over spec variables; pass them through `arg` (JSON-inlined here).
  await page.waitForFunction(
    `((pred, a) => { const s = window.__wmsfo && window.__wmsfo.getState(); return pred(s, a); })(${predicate.toString()}, ${JSON.stringify(arg ?? null)})`,
    undefined,
    { timeout: timeoutMs },
  );
}

export async function readCspMeta(page: PageLike): Promise<string | null> {
  return page.evaluate(
    "document.querySelector('meta[http-equiv=\"Content-Security-Policy\"]')?.getAttribute('content') ?? null",
  ) as Promise<string | null>;
}

export async function fetchCdnSnapshot(url: string): Promise<{
  event: {
    flightHistory?: { points?: { lat: number; lng: number; recordedAt?: string | null }[] } | null;
    latestMessage?: { body: string } | null;
  } | null;
  content?: unknown;
}> {
  const res = await fetch(url, { credentials: "omit" });
  if (!res.ok) throw new Error(`snapshot fetch ${url} → ${res.status}`);
  return (await res.json()) as {
    event: {
      flightHistory?: { points?: { lat: number; lng: number; recordedAt?: string | null }[] } | null;
      latestMessage?: { body: string } | null;
    } | null;
    content?: unknown;
  };
}
