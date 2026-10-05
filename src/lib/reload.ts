// docs/site.md section 8.1. Reloads the page; the "map unavailable"
// panel's button calls it, and tests mock this module.

export function reloadPage(): void {
  window.location.reload();
}
