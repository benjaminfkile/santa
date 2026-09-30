// docs/site.md section 8.9. The "Get directions" link target for a point:
// Apple Maps on an Apple touch device (an iPhone, iPad, or iPod user agent,
// or a Macintosh one with touch points, which is how iPadOS reports
// itself), Google Maps directions everywhere else. The coordinates are
// written as given, latitude first.

export type DirectionsPlatform = { userAgent: string; maxTouchPoints: number };

function currentPlatform(): DirectionsPlatform {
  if (typeof navigator === "undefined") return { userAgent: "", maxTouchPoints: 0 };
  return {
    userAgent: typeof navigator.userAgent === "string" ? navigator.userAgent : "",
    maxTouchPoints: typeof navigator.maxTouchPoints === "number" ? navigator.maxTouchPoints : 0,
  };
}

export function isAppleTouch(platform: DirectionsPlatform = currentPlatform()): boolean {
  const { userAgent, maxTouchPoints } = platform;
  if (/iPhone|iPad|iPod/.test(userAgent)) return true;
  return /Macintosh/.test(userAgent) && maxTouchPoints > 1;
}

export function directionsHref(
  lat: number,
  lng: number,
  platform: DirectionsPlatform = currentPlatform(),
): string {
  const point = `${lat},${lng}`;
  return isAppleTouch(platform)
    ? `https://maps.apple.com/?daddr=${point}`
    : `https://www.google.com/maps/dir/?api=1&destination=${point}`;
}
