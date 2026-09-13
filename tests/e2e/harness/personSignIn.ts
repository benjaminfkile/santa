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

// The panel entry carries the same testid as the actions button, so pick the
// visible one; when neither is visible (the map page, narrow viewports) open
// the panel through the Menu button first.
async function visibleControl(page: PageLike, testId: string): Promise<LocatorLike> {
  const direct = page.getByTestId(testId).locator("visible=true").first();
  if (await direct.isVisible()) return direct;
  await page.locator('button[aria-label="Menu"]').first().click();
  const inPanel = page.getByTestId(testId).locator("visible=true").first();
  await inPanel.waitFor({ state: "visible", timeout: 10_000 });
  return inPanel;
}

export async function personSignIn(page: PageLike): Promise<void> {
  const menuSignIn = await visibleControl(page, "menu-sign-in");
  await menuSignIn.click();

  // The site's own /auth/sign-in page: email, password, submit.
  const email = page.locator('input[name="email"]').first();
  await email.waitFor({ state: "visible", timeout: 20_000 });
  await email.fill(e2eEnv.PERSON_EMAIL);
  await page.locator('input[name="password"]').first().fill(e2eEnv.PERSON_PASSWORD);
  await page.locator('[data-testid="auth-submit"]').first().click();

  // Back on the page that opened sign-in: wait for the signed-in control,
  // opening the panel when the shell shows no actions area there.
  await page.locator("main").first().waitFor({ state: "visible", timeout: 30_000 });
  const signedOut = await visibleControl(page, "menu-sign-out");
  await signedOut.waitFor({ state: "visible", timeout: 30_000 });
}
