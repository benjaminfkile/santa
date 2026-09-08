// docs/site.md section 11.2. Sign out flow: clear the local user, then
// redirect to the Cognito hosted-UI logout with a registered logout URI.

import { env } from "../config/env";
import { getUserManager } from "./userManager";

export async function signIn(returnTo: string): Promise<void> {
  const um = await getUserManager();
  await um.signinRedirect({ state: { returnTo } });
}

export async function signOut(): Promise<void> {
  const um = await getUserManager();
  await um.removeUser();
  const logoutUri = encodeURIComponent(`${window.location.origin}/`);
  window.location.assign(
    `${env.COGNITO_DOMAIN}/logout?client_id=${env.COGNITO_CLIENT_ID}&logout_uri=${logoutUri}`,
  );
}
