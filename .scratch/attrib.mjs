import { chromium } from "@playwright/test";
const browser = await chromium.launch();
for (const [name, width, height] of [["phone", 390, 844], ["desktop", 1280, 900]]) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
  await page.goto("https://wmsfo-dev.vercel.app/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[aria-label="Tracker menu"]', { timeout: 40000 });
  const ack = page.locator('[data-testid="route-disclaimer"] button');
  if (await ack.count()) await ack.click();
  await page.waitForTimeout(3000);
  console.log(`\n=== ${name} ${width}x${height} ===`);
  console.log(JSON.stringify(await page.evaluate(() => {
    const vh = window.innerHeight;
    const pick = (sel) => [...document.querySelectorAll(sel)].map((e) => {
      const r = e.getBoundingClientRect();
      return { cls: e.className?.toString?.().slice(0, 40), h: Math.round(r.height), top: Math.round(r.top), bottomGap: Math.round(vh - r.bottom) };
    });
    const stacks = ["map-bottom-left", "map-bottom-right"].map((id) => {
      const el = document.querySelector(`[data-testid="${id}"]`);
      if (!el) return { id, missing: true };
      const r = el.getBoundingClientRect();
      return { id, bottomGap: Math.round(vh - r.bottom), h: Math.round(r.height) };
    });
    return {
      viewportH: vh,
      googleLogo: pick(".gm-style > div > a > div > img, .gmnoprint img, a[href*='maps.google.com'] img"),
      attribution: pick(".gm-style-cc"),
      stacks,
    };
  }), null, 1));
  await page.close();
}
await browser.close();
