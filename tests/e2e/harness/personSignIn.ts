// docs/site.md section 22.2. Signs in as the E2E person by clicking the
// visible menu-sign-in control (in the header actions on wide viewports;
// in the panel, opened through the Menu button, on narrow viewports), or on
// the live screen, which renders no shell, the cookie dialog's Sign in
// behind the leave-a-cookie glyph; then fills the site's own /auth/sign-in
// form and waits for the signed-in state. No hosted UI, no MFA on this
// account.

import { e2eEnv } from "./env";

type LocatorLike = {
  first: () => LocatorLike;
  locator: (selector: string) => LocatorLike;
  click: (options?: { timeout?: number }) => Promise<void>;
  fill: (value: string) => Promise<void>;
  waitFor: (options?: { state?: "visible" | "attached" | "hidden"; timeout?: number }) => Promise<void>;
  isVisible: () => Promise<boolean>;
};

type PageLike = {
  locator: (selector: string) => LocatorLike;
  getByTestId: (id: string) => LocatorLike;
};

// Where sign-in is offered depends on the page: the header action on wide
// viewports (menu-sign-in), the panel entry behind the Menu button on narrow
// ones. Pick the first visible one.
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

const SIGN_IN = ['[data-testid="menu-sign-in"]'];
const SIGNED_IN = ['[data-testid="menu-sign-out"]'];
const LEAVE_GLYPH = '[data-testid="cookie-tally-leave"]';
const DIALOG_SIGN_IN = '[data-testid="cookie-dialog-sign-in"]';

export async function personSignIn(page: PageLike): Promise<void> {
  const leave = await firstVisible(page, [LEAVE_GLYPH]);
  const onLiveScreen = leave !== null;
  if (leave) {
    await leave.click();
    const dialogSignIn = await waitForVisible(page, [DIALOG_SIGN_IN], 10_000);
    await dialogSignIn.click();
  } else {
    let signIn = await firstVisible(page, SIGN_IN);
    if (!signIn) {
      await page.locator('button[aria-label="Menu"]').first().click();
      signIn = await waitForVisible(page, SIGN_IN, 10_000);
    }
    await signIn.click();
  }

  // The site's own /auth/sign-in page: email, password, submit.
  const email = page.locator('input[name="email"]').first();
  await email.waitFor({ state: "visible", timeout: 20_000 });
  await email.fill(e2eEnv.PERSON_EMAIL);
  await page.locator('input[name="password"]').first().fill(e2eEnv.PERSON_PASSWORD);
  await page.locator('[data-testid="auth-submit"]').first().click();

  // Back on the tracker: the auth dialog closes and the glyph shows again.
  if (onLiveScreen) {
    await email.waitFor({ state: "hidden", timeout: 30_000 });
    await waitForVisible(page, [LEAVE_GLYPH], 30_000);
    return;
  }

  // Back on the page that opened sign-in: the signed-in control is the
  // header's Sign out or the panel entry.
  const signedIn = await waitForVisible(page, SIGNED_IN, 30_000);
  if (!signedIn) throw new Error("signed-in control not found");
}
