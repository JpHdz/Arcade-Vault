"use server";

import { headers } from "next/headers";
import { buildContactEmail, type ContactMessage } from "@/lib/emails/contact-message";
import { checkRateLimit } from "@/lib/rate-limit";
import { getContactFrom, getContactTo, getResend, isDryRun } from "@/lib/resend";

export type ContactState =
  | { status: "idle" }
  | { status: "sent"; name: string }
  | { status: "error"; message: string };

const MAX_NAME = 80;
const MAX_EMAIL = 160;
const MAX_MSG = 2000;

/** Deliberately loose: rejects obvious garbage, leaves real validation to the mailbox. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The only sentence a delivery failure ever sends to the browser. */
const SEND_FAILED = "No pudimos enviar tu mensaje. Inténtalo de nuevo en unos minutos.";

/** Reads one text field; anything else (missing, or a file) counts as empty. */
function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/** Returns the first rule the message breaks, as a sentence for the visitor. */
function validate(m: ContactMessage): string | null {
  if (!m.name || !m.email || !m.msg) {
    return "Completa los tres campos antes de enviar.";
  }
  if (m.name.length > MAX_NAME) {
    return `El nombre no puede pasar de ${MAX_NAME} caracteres.`;
  }
  if (m.email.length > MAX_EMAIL || !EMAIL_PATTERN.test(m.email)) {
    return "Ese correo electrónico no parece válido.";
  }
  if (m.msg.length > MAX_MSG) {
    return `El mensaje no puede pasar de ${MAX_MSG} caracteres.`;
  }
  return null;
}

/**
 * Best-effort caller address. These headers are only trustworthy when a proxy
 * in front of the app overwrites them; see the IP risk in SPEC 03.
 */
async function callerIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Handles one contact-form submission.
 *
 * Reachable by direct POST, not just through the form, so it trusts nothing the
 * client sent. Validation runs before the rate limiter, so a rejected form does
 * not spend one of the caller's three sends.
 */
export async function sendContactMessage(
  prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const message: ContactMessage = {
    name: field(formData, "name"),
    email: field(formData, "email"),
    msg: field(formData, "msg"),
  };

  const invalid = validate(message);
  if (invalid) {
    return { status: "error", message: invalid };
  }

  const limit = checkRateLimit(await callerIp());
  if (!limit.ok) {
    return {
      status: "error",
      message: "Demasiados mensajes seguidos. Espera unos minutos e inténtalo de nuevo.",
    };
  }

  const email = buildContactEmail(message);

  if (isDryRun()) {
    console.warn(
      "[contact] RESEND_API_KEY is not set — dry run, nothing was sent.",
    );
    console.info(`[contact] Subject: ${email.subject}\n${email.text}`);
    return { status: "sent", name: message.name };
  }

  const to = getContactTo();
  const from = getContactFrom();
  if (!to || !from) {
    console.error(
      "[contact] CONTACT_TO_EMAIL and CONTACT_FROM_EMAIL must both be set.",
    );
    return { status: "error", message: SEND_FAILED };
  }

  try {
    // The SDK reports API failures in `error` instead of throwing, so both
    // paths have to be handled: `catch` alone would let a rejection through.
    const { error } = await getResend().emails.send({
      from,
      to,
      replyTo: message.email,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
    if (error) {
      console.error(
        `[contact] Resend rejected the message: ${error.name} (${error.statusCode ?? "no status"}): ${error.message}`,
      );
      return { status: "error", message: SEND_FAILED };
    }
  } catch (cause) {
    console.error("[contact] Resend request failed:", cause);
    return { status: "error", message: SEND_FAILED };
  }

  return { status: "sent", name: message.name };
}
