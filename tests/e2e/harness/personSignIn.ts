// docs/site.md section 22.2. Signs in as the E2E person by driving the
// site's own sign-in link into the hosted Cognito UI. No MFA on this
// account. The Playwright Page argument is untyped here so the harness
// module has no compile-time dependency on @playwright/test.

import { e2eEnv } from "./env";

type PageLike = {
  click: (selector: string) => Promise<void>;
  fill: (selector: string, value: string) => Promise<void>;
  locator: (selector: string) => { first: () => { click: () => Promise<void> } };
  waitForURL: (url: string | RegExp) => Promise<void>;
};

export async function personSignIn(page: PageLike): Promise<void> {
  await page.click('[data-testid="menu-sign-in"], text=/Sign in/i');
  await page.fill('input[name="username"], input[type="email"]', e2eEnv.PERSON_EMAIL);
  await page.fill('input[name="password"], input[type="password"]', e2eEnv.PERSON_PASSWORD);
  await page.locator('button[type="submit"], input[type="submit"]').first().click();
  await page.waitForURL(new RegExp(`^${escape(e2eEnv.BASE_URL)}`));
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
