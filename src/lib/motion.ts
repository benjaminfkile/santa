// docs/site.md section 17. Motion helpers. The site ignores the
// prefers-reduced-motion preference by decision: every animation runs, and
// both helpers return false without reading any media query. This file is the
// one place to restore the preference.

export function prefersReducedMotion(): boolean {
  return false;
}

export function useReducedMotion(): boolean {
  return false;
}
