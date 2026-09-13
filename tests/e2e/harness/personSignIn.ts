// docs/site.md section 22.2. Signs in as the E2E person by clicking the
// visible menu-sign-in control (in the header actions on wide viewports;
// in the panel, opened through the Menu button, on narrow viewports and on
// the map page, where the shell renders only the menu button), filling the
// site's own /auth/sign-in page, and waiting for the signed-in control the
// same way. No hosted UI, no MFA on this account.

import { e2eEnv } from "./env";

type LocatorLike = {
  first: () => LocatorLike;
  locator: (selector: string) => LocatorLike;
  click: (options?: { timeout?: number }) => Promise<void>;
  fill: (value: string) => Promise<void>;
  waitFor: (options?: { state?: "visible" | "attached"; timeout?: number }) => Promise<void>;
  isVisible: () => Promise<boolean>;
};

type PageLike = {
  locator: (selector: string) => LocatorLike;
  getByTestId: (id: string) => LocatorLike;
};

// Where sign-in is offered depends on the page: the header action on wide
// viewports (menu-sign-in), the panel entry behind the Menu button on narrow
// ones, and the cookie control's own button on the live page, which renders
// no shell at all. Pick the first visible one.
async function firstVisible(page: PageLike, selectors: string[]): Promise<LocatorLike | null> {
  for (const selector of selectors) {
    const candidate = page.locator(selector).locator("visible=true").first();
    if (await candidate.isVisible()) return candidate;
  }
  return null;
}

async function waitForVisible(page: PageLike, selectors: string[], timeoutMs: number): Promise<LocatorLike> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const found = await firstVisible(page, selectors);
    if (found) return found;
    if (Date.now() > deadline) throw new Error(`none of ${selectors.join(", ")} became visible within ${timeoutMs} ms`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

const SIGN_IN = ['[data-testid="menu-sign-in"]', '[data-testid="cookie-control-sign-in"]'];
const SIGNED_IN = ['[data-testid="menu-sign-out"]', '[data-testid="cookie-control-open"]'];

export async function personSignIn(page: PageLike): Promise<void> {
  let signIn = await firstVisible(page, SIGN_IN);
  if (!signIn) {
    await page.locator('button[aria-label="Menu"]').first().click();
    signIn = await waitForVisible(page, SIGN_IN, 10_000);
  }
  await signIn.click();

  // The site's own /auth/sign-in page: email, password, submit.
  const email = page.locator('input[name="email"]').first();
  await email.waitFor({ state: "visible", timeout: 20_000 });
  await email.fill(e2eEnv.PERSON_EMAIL);
  await page.locator('input[name="password"]').first().fill(e2eEnv.PERSON_PASSWORD);
  await page.locator('[data-testid="auth-submit"]').first().click();

  // Back on the page that opened sign-in: the signed-in control is the
  // header's Sign out, the panel entry, or the cookie control's open button.
  const signedIn = await waitForVisible(page, SIGNED_IN, 30_000);
  if (!signedIn) throw new Error("signed-in control not found");
}
