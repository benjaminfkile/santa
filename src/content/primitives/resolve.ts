// docs/site.md section 7.3. resolveMedia and resolveIcon are the only
// functions that reach into the bundle's media and icons maps.

import type { ContentBundle } from "../../store/types";
import type { IconRef } from "../../contracts";

type MediaEntry = NonNullable<NonNullable<ContentBundle["media"]>[string]>;

const loggedIcons = new Set<string>();
const loggedMedia = new Set<string>();

export function resolveMedia(bundle: ContentBundle, id: string): MediaEntry | null {
  const entry = bundle.media?.[id];
  if (!entry) {
    if (!loggedMedia.has(id)) {
      loggedMedia.add(id);
      console.warn(`content: missing media id "${id}"`);
    }
    return null;
  }
  return entry;
}

export function resolveIcon(bundle: ContentBundle, ref: IconRef): string | null {
  if (ref.source === "library") {
    const url = bundle.icons?.[ref.id];
    if (!url) {
      if (!loggedIcons.has(`library:${ref.id}`)) {
        loggedIcons.add(`library:${ref.id}`);
        console.warn(`content: missing library icon "${ref.id}"`);
      }
      return null;
    }
    return url;
  }
  const entry = bundle.media?.[ref.id];
  if (!entry) {
    if (!loggedIcons.has(`media:${ref.id}`)) {
      loggedIcons.add(`media:${ref.id}`);
      console.warn(`content: missing media icon "${ref.id}"`);
    }
    return null;
  }
  return entry.url ?? null;
}

export function _resetResolveLogs(): void {
  loggedIcons.clear();
  loggedMedia.clear();
}
