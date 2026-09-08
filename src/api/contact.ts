// docs/site.md sections 14 and 12. Contact form API wrapper.

import { api } from "./client";
import type { components } from "../contracts";

export type ContactResponse = components["schemas"]["ContactResponse"];

export type ContactBody = {
  name: string;
  email: string;
  message: string;
};

export function submitContact(body: ContactBody): Promise<ContactResponse> {
  return api<ContactResponse>("/contact", {
    method: "POST",
    auth: false,
    body,
  });
}
