import { Resend } from "resend";

/**
 * Resend wiring for the contact form.
 *
 * The client is built on first use, never at module scope: `new Resend()`
 * throws when no API key is available, so constructing it eagerly would make
 * importing this module fail — and with it `next build` — on any clone without
 * a `.env.local`. See specs/.env.example for the variables involved.
 */

let client: Resend | null = null;

/** True when `RESEND_API_KEY` is set to something non-empty. */
export function hasResendKey(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

/**
 * Whether a send may be faked. Outside production a missing key means the
 * caller logs the message instead of sending it; in production it is an error.
 */
export function isDryRun(): boolean {
  return !hasResendKey() && process.env.NODE_ENV !== "production";
}

/**
 * The shared Resend client, constructed on first call.
 *
 * @throws If `RESEND_API_KEY` is missing. Guard with {@link hasResendKey}.
 */
export function getResend(): Resend {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "RESEND_API_KEY is not set. Copy specs/.env.example to .env.local.",
    );
  }
  client ??= new Resend(key);
  return client;
}

/** Mailbox the contact form delivers to. */
export function getContactTo(): string | undefined {
  return process.env.CONTACT_TO_EMAIL?.trim() || undefined;
}

/** Sender the contact form delivers as, in `"Name <address>"` form. */
export function getContactFrom(): string | undefined {
  return process.env.CONTACT_FROM_EMAIL?.trim() || undefined;
}
