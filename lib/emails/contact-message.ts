export interface ContactMessage {
  name: string;
  email: string;
  msg: string;
}

export interface ContactEmail {
  subject: string;
  text: string;
  html: string;
}

/**
 * Escapes the five characters that can break out of HTML text or an attribute.
 * Every value in a contact message is written by an anonymous visitor, so none
 * of them may reach the HTML body unescaped.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escapes, then turns newlines into `<br>` so the message keeps its shape. */
function escapeParagraph(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, "<br>");
}

/**
 * Builds the message delivered to the team for one contact-form submission.
 *
 * Both bodies carry the same three fields; the HTML one is a plain inline-styled
 * block so it reads the same in any mail client, with no external stylesheet.
 */
export function buildContactEmail(m: ContactMessage): ContactEmail {
  const subject = `[Arcade Vault] Mensaje de ${m.name}`;

  const text = [
    "Nuevo mensaje desde el formulario de contacto de Arcade Vault.",
    "",
    `Nombre: ${m.name}`,
    `Correo: ${m.email}`,
    "",
    "Mensaje:",
    m.msg,
    "",
    "--",
    "Responde a este correo para contestar directamente al remitente.",
  ].join("\n");

  const html = `<div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:14px;line-height:1.6;color:#101014;">
  <p style="margin:0 0 16px;">Nuevo mensaje desde el formulario de contacto de <strong>Arcade Vault</strong>.</p>
  <table cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
    <tr>
      <td style="padding:2px 12px 2px 0;color:#6b6b76;">Nombre</td>
      <td style="padding:2px 0;"><strong>${escapeHtml(m.name)}</strong></td>
    </tr>
    <tr>
      <td style="padding:2px 12px 2px 0;color:#6b6b76;">Correo</td>
      <td style="padding:2px 0;"><a href="mailto:${escapeHtml(m.email)}">${escapeHtml(m.email)}</a></td>
    </tr>
  </table>
  <div style="border-left:3px solid #00b8c4;padding:8px 0 8px 14px;margin:0 0 20px;white-space:pre-wrap;">${escapeParagraph(m.msg)}</div>
  <p style="margin:0;font-size:12px;color:#6b6b76;">Responde a este correo para contestar directamente al remitente.</p>
</div>`;

  return { subject, text, html };
}
