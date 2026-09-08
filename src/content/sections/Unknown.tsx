// docs/site.md section 7.2. Renders nothing; logs the kind once.

const logged = new Set<string>();

export type UnknownProps = { kind: string };

export function Unknown({ kind }: UnknownProps) {
  if (!logged.has(kind)) {
    logged.add(kind);
    console.warn(`content: unknown kind "${kind}"`);
  }
  return null;
}

export function _resetUnknownLog(): void {
  logged.clear();
}
