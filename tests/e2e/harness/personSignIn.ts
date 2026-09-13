// docs/site.md section 22.2. Signs in as the E2E person by clicking the
// visible menu-sign-in control (in the header actions on wide viewports,
// in the panel on narrow ones), filling the site's own /auth/sign-in page,
// and waiting for the visible menu-sign-out control. No hosted UI, no MFA
// on this account.

import { e2eEnv } from "./env";

type LocatorLike = {
  first: () => LocatorLike;
  locator: (selector: string) => LocatorLike;
  click: (options?: { timeout?: number }) => Promise<void>;
  fill: (value: string) => Promise<void>;
  waitFor: (options?: { state?: "visible" | "attached"; timeout?: number }) => Promise<void>;
};

type PageLike = {
  locator: (selector: string) => LocatorLike;
  getByTestId: (id: string) => LocatorLike;
};

export async function personSignIn(page: PageLike): Promise<void> {
  // The panel entry carries the same testid as the actions button, so pick
  // the visible one (Shell.tsx: data-testid="menu-sign-in" in the actions
  // area on wide viewports, in the drawer entry on narrow ones).
  const menuSignIn = page.getByTestId("menu-sign-in").locator("visible=true").first();
  await menuSignIn.waitFor({ state: "visible", timeout: 10_000 });
  await menuSignIn.click();

  // The site's own /auth/sign-in page: email, password, submit.
  const email = page.locator('input[name="email"]').first();
  await email.waitFor({ state: "visible", timeout: 20_000 });
  await email.fill(e2eEnv.PERSON_EMAIL);
  await page.locator('input[name="password"]').first().fill(e2eEnv.PERSON_PASSWORD);
  await page.locator('[data-testid="auth-submit"]').first().click();

  // Wait for the visible signed-in control (Shell.tsx: menu-sign-out in
  // the actions area on wide viewports).
  await page
    .getByTestId("menu-sign-out")
    .locator("visible=true")
    .first()
    .waitFor({ state: "visible", timeout: 30_000 });
}
