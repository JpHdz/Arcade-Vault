"use client";

import { useActionState, useState, type FormEvent } from "react";
import { sendContactMessage, type ContactState } from "@/app/about/actions";

const EMPTY = { name: "", email: "", msg: "" };
const INITIAL: ContactState = { status: "idle" };

/** Matches the `shake` keyframes in globals.css. */
const SHAKE_MS = 400;

/**
 * The contact form from about.jsx, wired to a Server Action.
 *
 * The template only had two looks, the form and the success terminal; this adds
 * a pending look (button relabelled, fields read-only) and a failed terminal.
 * Field values live in local state rather than the DOM, because the terminal
 * replaces the fields and `REINTENTAR` has to bring them back as typed.
 */
export function ContactForm() {
  const [state, formAction, pending] = useActionState(sendContactMessage, INITIAL);
  const [form, setForm] = useState(EMPTY);
  const [shake, setShake] = useState(false);

  // useActionState has no way to reset its state from the client, so a result
  // is hidden by remembering which one was dismissed. Every action call returns
  // a fresh object, so the next result never compares equal to an old one.
  const [dismissed, setDismissed] = useState<ContactState>(INITIAL);
  const result = state === dismissed ? INITIAL : state;

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    if (!form.name.trim() || !form.email.trim() || !form.msg.trim()) {
      // Cancelling the submit event also stops React from calling the action.
      e.preventDefault();
      setShake(true);
      setTimeout(() => setShake(false), SHAKE_MS);
    }
  };

  const sendAnother = () => {
    setDismissed(state);
    setForm(EMPTY);
  };

  const retry = () => {
    setDismissed(state);
  };

  return (
    <form
      className={"contact-form" + (shake ? " shake" : "")}
      action={formAction}
      onSubmit={onSubmit}
    >
      {result.status === "idle" ? (
        <>
          <div className="field">
            <label htmlFor="contact-name">NOMBRE</label>
            <input
              id="contact-name"
              name="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="px_kai"
              readOnly={pending}
            />
          </div>
          <div className="field">
            <label htmlFor="contact-email">CORREO ELECTRÓNICO</label>
            <input
              id="contact-email"
              name="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="jugador@vault.gg"
              readOnly={pending}
            />
          </div>
          <div className="field">
            <label htmlFor="contact-msg">MENSAJE</label>
            <textarea
              id="contact-msg"
              name="msg"
              rows={5}
              value={form.msg}
              onChange={(e) => setForm({ ...form, msg: e.target.value })}
              placeholder="Cuéntanos qué tienes en mente…"
              readOnly={pending}
            />
          </div>
          <button
            className="btn xl press"
            type="submit"
            style={{ width: "100%" }}
            disabled={pending}
          >
            {pending ? "▸ TRANSMITIENDO…" : "▶  ENVIAR MENSAJE"}
          </button>
        </>
      ) : (
        <div
          className={
            "terminal-success" + (result.status === "error" ? " failed" : "")
          }
          role="status"
          aria-live="polite"
        >
          <div className="term-bar">
            <span className="dot r"></span>
            <span className="dot y"></span>
            <span className="dot g"></span>
            <span className="term-title">VAULT-OS // TERMINAL</span>
          </div>
          <div className="term-body">
            <div className="line">
              <span className="prompt">vault@arcade:~$</span>
              {" ./send_message --to=team"}
            </div>
            <div className="line dim">[OK] Conectando con servidor…</div>
            <div className="line dim">[OK] Validando contenido…</div>
            {result.status === "sent" ? (
              <>
                <div className="line dim">[OK] Transmitiendo paquete…</div>
                <div className="line success">
                  &gt; MENSAJE RECIBIDO. TE RESPONDEREMOS PRONTO. GRACIAS,{" "}
                  {result.name.toUpperCase()}.<span className="caret">_</span>
                </div>
                <div style={{ marginTop: 18 }}>
                  <button className="btn ghost" type="button" onClick={sendAnother}>
                    ENVIAR OTRO MENSAJE
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="line">[FAIL] Transmitiendo paquete…</div>
                <div className="line success">
                  &gt; {result.message.toUpperCase()}
                  <span className="caret">_</span>
                </div>
                <div style={{ marginTop: 18 }}>
                  <button className="btn ghost" type="button" onClick={retry}>
                    REINTENTAR
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </form>
  );
}
