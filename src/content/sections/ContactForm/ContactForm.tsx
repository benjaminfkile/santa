// docs/site.md section 14. Contact form: name 1..100, email 3..254 and a
// valid address shape, message 1..2000; whitespace trimmed before checks.
// Renders successText on 201; field errors from details.fields on 400;
// disables submit for retryAfterSeconds on 429; keeps text on network.

import { useCallback, useEffect, useState } from "react";
import type { SectionComponent } from "../../registry";
import { useStore } from "../../../store/useStore";
import { Inline } from "../../inline/Inline";
import { submitContact } from "../../../api/contact";
import { ApiRequestError, surfaceFor } from "../../../api/errors";
import type { ContentDocument } from "../../../contracts";
import "./ContactForm.module.css";

export type ContactFormData = {
  heading?: string | null;
  copy?: string | null;
  successText?: string | null;
};

function readData(data: unknown): ContactFormData {
  if (data === null || typeof data !== "object") return {};
  const d = data as ContactFormData;
  return {
    heading: d.heading ?? null,
    copy: d.copy ?? null,
    successText: d.successText ?? null,
  };
}

const NAME_MIN = 1;
const NAME_MAX = 100;
const EMAIL_MIN = 3;
const EMAIL_MAX = 254;
const MESSAGE_MIN = 1;
const MESSAGE_MAX = 2000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateContactForm(input: { name: string; email: string; message: string }): {
  ok: boolean;
  values: { name: string; email: string; message: string };
} {
  const name = input.name.trim();
  const email = input.email.trim();
  const message = input.message.trim();
  const okName = name.length >= NAME_MIN && name.length <= NAME_MAX;
  const okEmail =
    email.length >= EMAIL_MIN && email.length <= EMAIL_MAX && EMAIL_RE.test(email);
  const okMessage = message.length >= MESSAGE_MIN && message.length <= MESSAGE_MAX;
  return { ok: okName && okEmail && okMessage, values: { name, email, message } };
}

type FormState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success" }
  | { kind: "error"; message: string; fieldErrors: Record<string, string> }
  | { kind: "cooldown"; until: number };

export const ContactForm: SectionComponent = ({ data, bundle }) => {
  const d = readData(data);
  const contactEmail = useStore((s) => {
    const content = s.snapshot?.content as ContentDocument | undefined;
    return content?.settings?.contactEmail ?? null;
  });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<FormState>({ kind: "idle" });
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (state.kind !== "cooldown") return;
    const id = window.setInterval(() => setNowMs(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [state]);

  const cooldownSecs =
    state.kind === "cooldown" ? Math.max(0, Math.ceil((state.until - nowMs) / 1000)) : 0;

  const validation = validateContactForm({ name, email, message });
  const canSubmit =
    validation.ok && state.kind !== "submitting" && cooldownSecs === 0;

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!validation.ok) return;
      setState({ kind: "submitting" });
      try {
        await submitContact(validation.values);
        setName("");
        setEmail("");
        setMessage("");
        setState({ kind: "success" });
      } catch (err) {
        const s = surfaceFor(err);
        if (err instanceof ApiRequestError) {
          if (s.code === "validation_failed") {
            setState({
              kind: "error",
              message: "Please check the highlighted fields.",
              fieldErrors: s.fieldErrors,
            });
            return;
          }
          if (s.code === "rate_limited") {
            const secs = s.retryAfterSeconds ?? 60;
            setState({ kind: "cooldown", until: Date.now() + secs * 1000 });
            return;
          }
        }
        setState({ kind: "error", message: s.message, fieldErrors: {} });
      }
    },
    [validation],
  );

  const fieldErrors = state.kind === "error" ? state.fieldErrors : {};
  const isSuccess = state.kind === "success";

  return (
    <div className="contact-form">
      {d.heading ? <h2>{d.heading}</h2> : null}
      {d.copy ? <p><Inline text={d.copy} bundle={bundle} /></p> : null}
      {isSuccess ? (
        <p data-testid="contact-success">
          <Inline text={d.successText ?? "Thanks."} bundle={bundle} />
        </p>
      ) : null}
      <form onSubmit={onSubmit} noValidate>
        <div>
          <label htmlFor="contact-name">Name</label>
          <input
            id="contact-name"
            data-testid="contact-name"
            type="text"
            value={name}
            maxLength={NAME_MAX}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={fieldErrors.name !== undefined}
            aria-describedby={fieldErrors.name !== undefined ? "contact-name-error" : undefined}
          />
        </div>
        {fieldErrors.name !== undefined ? (
          <p id="contact-name-error" role="alert">{fieldErrors.name}</p>
        ) : null}
        <div>
          <label htmlFor="contact-email">Email</label>
          <input
            id="contact-email"
            data-testid="contact-email"
            type="email"
            value={email}
            maxLength={EMAIL_MAX}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={fieldErrors.email !== undefined}
            aria-describedby={fieldErrors.email !== undefined ? "contact-email-error" : undefined}
          />
        </div>
        {fieldErrors.email !== undefined ? (
          <p id="contact-email-error" role="alert">{fieldErrors.email}</p>
        ) : null}
        <div>
          <label htmlFor="contact-message">Message</label>
          <textarea
            id="contact-message"
            data-testid="contact-message"
            value={message}
            maxLength={MESSAGE_MAX}
            onChange={(e) => setMessage(e.target.value)}
            aria-invalid={fieldErrors.message !== undefined}
            aria-describedby={fieldErrors.message !== undefined ? "contact-message-error" : undefined}
          />
          <span data-testid="contact-message-counter">
            {message.length}/{MESSAGE_MAX}
          </span>
        </div>
        {fieldErrors.message !== undefined ? (
          <p id="contact-message-error" role="alert">{fieldErrors.message}</p>
        ) : null}
        {state.kind === "error" ? (
          <p role="alert" data-testid="contact-error">{state.message}</p>
        ) : null}
        {state.kind === "cooldown" ? (
          <p role="alert" data-testid="contact-cooldown">
            Please try again in {cooldownSecs}s.
          </p>
        ) : null}
        <button type="submit" disabled={!canSubmit} data-testid="contact-submit">
          {state.kind === "submitting" ? "Sending…" : "Send"}
        </button>
      </form>
      {contactEmail !== null && contactEmail !== "" ? (
        <p>
          <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
        </p>
      ) : null}
    </div>
  );
};

export default ContactForm;
