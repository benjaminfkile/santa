// docs/site.md section 11.4. Bearer for API calls. Re-read before every
// call; never cached by the API client. Refreshes inside the last minute;
// fails closed on refresh failure.

export { getIdToken, SignInRequired } from "./session";
