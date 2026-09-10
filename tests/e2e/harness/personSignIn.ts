// docs/site.md section 22.2. Signs in as the E2E person by driving the
// site's own sign-in control into the hosted Cognito UI. No MFA on this
// account. The Playwright Page argument is typed structurally here so the
// harness module has no compile-time dependency on @playwright/test.
import { e2eEnv } from "./env";

type LocatorLike = {
  first: () => LocatorLike;
  click: () => Promise<void>;
  fill: (value: string) => Promise<void>;
  isVisible: () => Promise<boolean>;
};

type PageLike = {
  locator: (selector: string) => LocatorLike;
  getByRole: (role: "button", options: { name: RegExp }) => LocatorLike;
  waitForURL: (url: string | RegExp) => Promise<void>;
};

export async function personSignIn(page: PageLike): Promise<void> {
  // The sign-in control sits inside the shell's menu on every page; a section
  // (alerts, cookies) may also offer its own button when signed out.
  const direct = page.locator('[data-testid="menu-sign-in"]').first();
  if (await direct.isVisible()) {
    await direct.click();
  } else {
    const inline = page.getByRole("button", { name: /^sign in$/i }).first();
    if (await inline.isVisible()) {
      await inline.click();
    } else {
      await page.getByRole("button", { name: /^menu$/i }).first().click();
      await page.getByRole("button", { name: /sign in/i }).first().click();
    }
  }
  // The classic hosted UI renders its form twice, one copy hidden per
  // breakpoint, with unlabelled inputs; go by field name on the visible copy.
  await page.locator('input[name="username"]:visible').first().fill(e2eEnv.PERSON_EMAIL);
  await page.locator('input[name="password"]:visible').first().fill(e2eEnv.PERSON_PASSWORD);
  await page.locator('input[type="submit" i]:visible, button[type="submit"]:visible').first().click();
  await page.waitForURL(new RegExp(`^${escape(e2eEnv.BASE_URL)}`));
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
