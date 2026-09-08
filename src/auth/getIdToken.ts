// docs/site.md section 11.4. Fetches the bearer token for every authed
// API call; imports the userManager chunk on demand and never caches
// the token itself.

import { getUserManager } from "./userManager";

export class SignInRequired extends Error {
  constructor() {
    super("sign_in_required");
    this.name = "SignInRequired";
  }
}

export async function getIdToken(): Promise<string> {
  const um = await getUserManager();
  let user = await um.getUser();
  if (user?.expired) {
    try {
      user = await um.signinSilent();
    } catch {
      user = null;
    }
  }
  if (!user?.id_token) throw new SignInRequired();
  return user.id_token;
}
