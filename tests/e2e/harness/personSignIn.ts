// docs/site.md section 22.2. Signs in as the E2E person by opening the
// shell menu, clicking the menu-sign-in entry, filling the site's own
// /auth/sign-in page, and waiting for the signed-in menu entry. No hosted
// UI, no MFA on this account.

import { e2eEnv } from "./env";

type LocatorLike = {
  first: () => LocatorLike;
  click: (options?: { timeout?: number }) => Promise<void>;
  fill: (value: string) => Promise<void>;
  waitFor: (options?: { state?: "visible" | "attached"; timeout?: number }) => Promise<void>;
};

type PageLike = {
  locator: (selector: string) => LocatorLike;
  getByRole: (role: "button", options: { name: RegExp }) => LocatorLike;
};

export async function personSignIn(page: PageLike): Promise<void> {
  // Open the shell menu (Shell.tsx: aria-label="Menu"), then click the
  // sign-in entry (Shell.tsx: data-testid="menu-sign-in").
  await page.getByRole("button", { name: /^menu$/i }).first().click();
  const menuSignIn = page.locator('[data-testid="menu-sign-in"]').first();
  await menuSignIn.waitFor({ state: "visible", timeout: 10_000 });
  await menuSignIn.click();

  // The site's own /auth/sign-in page: email, password, submit.
  const email = page.locator('input[name="email"]').first();
  await email.waitFor({ state: "visible", timeout: 20_000 });
  await email.fill(e2eEnv.PERSON_EMAIL);
  await page.locator('input[name="password"]').first().fill(e2eEnv.PERSON_PASSWORD);
  await page.locator('[data-testid="auth-submit"]').first().click();

  // Wait for the signed-in menu entry (Sign out replaces Sign in).
  await page.getByRole("button", { name: /^menu$/i }).first().click();
  await page.locator('button:has-text("Sign out")').first().waitFor({
    state: "visible",
    timeout: 30_000,
  });
}
