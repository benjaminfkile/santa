// docs/site.md section 8.6. Detects the Facebook and Instagram in-app
// browsers via user agent so the location prompt can warn about them.

export function inAppBrowser(ua?: string): boolean {
  const s =
    ua ??
    (typeof navigator !== "undefined" && typeof navigator.userAgent === "string"
      ? navigator.userAgent
      : "");
  return /FBAN|FBAV|Instagram/i.test(s);
}
