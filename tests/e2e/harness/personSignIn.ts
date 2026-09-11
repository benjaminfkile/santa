// docs/site.md section 22.2. Signs in as the E2E person by opening the
// shell menu (aria-label "Menu") and clicking the menu-sign-in button,
// then completing the hosted Cognito UI. No MFA on this account. The
// Playwright Page argument is typed structurally here so the harness
// module has no compile-time dependency on @playwright/test.
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
  waitForURL: (url: string | RegExp, options?: { timeout?: number }) => Promise<void>;
};

export async function personSignIn(page: PageLike): Promise<void> {
  // Open the shell menu (Shell.tsx: aria-label="Menu"), then click the
  // sign-in entry (Shell.tsx: data-testid="menu-sign-in").
  await page.getByRole("button", { name: /^menu$/i }).first().click();
  const signIn = page.locator('[data-testid="menu-sign-in"]').first();
  await signIn.waitFor({ state: "visible", timeout: 10_000 });
  await signIn.click();

  // The pool domain runs Cognito managed login: one form per step with
  // inputs named username and password and a single submit button. No MFA
  // on the E2E person, so the submit lands back on the site.
  const username = page.locator('input[name="username"]:visible').first();
  await username.waitFor({ state: "visible", timeout: 30_000 });
  await username.fill(e2eEnv.PERSON_EMAIL);
  await page.locator('input[name="password"]:visible').first().fill(e2eEnv.PERSON_PASSWORD);
  await page
    .locator('input[type="submit" i]:visible, button[type="submit"]:visible')
    .first()
    .click();
  await page.waitForURL(new RegExp(`^${escape(e2eEnv.BASE_URL)}`), { timeout: 60_000 });
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
