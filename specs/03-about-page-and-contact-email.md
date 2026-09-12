# SPEC 03 — About page and contact email with Resend

> **Status:** Approved
> **Depends on:** SPEC 01, SPEC 02
> **Date:** 2026-09-10
> **Objective:** Port `references/templates/home-about/about.jsx` to `/about` and make its contact form actually deliver mail through Resend via a Server Action.

---

## 1 — Why this spec exists

SPEC 02 ported the landing page from the same reference folder and deliberately left the About page out, with the `Acerca de` nav link pointing at `/about` and landing on the themed 404. This spec closes that dead end.

The port is mostly mechanical: the stylesheet already carries every rule the page needs (`app/globals.css` lines 1090–1164, copied wholesale in SPEC 02), and `components/home/reveal-observer.tsx` already implements the exact `IntersectionObserver` hook `about.jsx` repeats.

What is **not** mechanical is the form. In the template `onSubmit` does nothing but flip a `useState` — there is no network call, no pending state, and no failure path. Wiring Resend introduces a real request that can be slow and can fail, so this spec adds the two states the template never defined (sending, failed) using only the visual vocabulary the template already established.

---

## 2 — Scope

**In:**

- New page at `/about`, matching `references/templates/home-about/about.jsx` block by block: about hero with kicker, title and mission paragraph; the three-highlight row; the pixel divider banner; the contact section with intro, tips and form.
- The three highlight pixel SVGs (`HEART`, `BROWSER`, `PLANT`), copied rect by rect, with their accent colours and their `transitionDelay` staggering.
- The 24-pixel divider banner with its `animationDelay` staggering.
- Contact form as a client component with the template's three fields (`NOMBRE`, `CORREO ELECTRÓNICO`, `MENSAJE`) and its empty-field `shake` behaviour, plus a **sending** state and a **failed** state.
- Real delivery through Resend: `resend` added as a dependency, a lazily built client in `lib/resend.ts`, and a Server Action in `app/about/actions.ts`.
- Server-side validation: required fields, email format, and maximum lengths.
- In-memory per-IP rate limit on the Server Action.
- Plain-text plus simple inline-HTML email body, built in `lib/emails/contact-message.ts`.
- Environment variables `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL`, plus a committed `.env.example`.
- Dry-run fallback when `RESEND_API_KEY` is absent outside production.
- About copy in a new typed `lib/about-content.ts`, same pattern as `lib/home-content.ts`.
- Page title for `/about`.

**Out of scope (for future specs):**

- Any acknowledgement email back to the visitor. One message goes to the team and that is all.
- Persisting messages anywhere — no database, no file, no `localStorage`. If the Resend call succeeds the message exists only in the destination mailbox.
- A verified sending domain and its DNS records. The default `onboarding@resend.dev` sender is what `.env.example` documents; swapping it is a deployment concern, not a code change.
- Captcha, honeypot, or any anti-spam beyond the in-memory IP limit.
- A durable, multi-instance rate limiter (Redis, Upstash, a database). Recorded under risks.
- Per-field inline validation messages. The template defines no such UI and none is invented.
- Touching the nav. `components/nav.tsx` already links to `/about` and already lights `Acerca de` on `pathname === "/about"`, so it needs no change — the link simply stops 404-ing.
- Any change to the landing page, the library, the player, or the fake session.

---

## 3 — Data model

No persistence is introduced. Three new modules: the page copy, the action's result shape, and the email body.

### `lib/about-content.ts`

```ts
export type HighlightIconKind = "HEART" | "BROWSER" | "PLANT";

export interface Highlight {
  icon: HighlightIconKind;
  text: string;
  color: "cyan" | "magenta" | "green"; // reuses AccentColor's vocabulary
}

export interface ContactTip {
  text: string;
  led: "" | "y" | "m"; // the modifier appended to .tip-led
}

export const ABOUT_MISSION: string;
export const HIGHLIGHTS: Highlight[]; // 3 entries
export const CONTACT_TIPS: ContactTip[]; // 3 entries
export const DIVIDER_PIXEL_COUNT = 24;
```

Values are copied verbatim from `about.jsx`, including the emoji in `HECHO CON ❤️ PARA JUGADORES`.

### `app/about/actions.ts` — the action's state

```ts
export type ContactState =
  | { status: "idle" }
  | { status: "sent"; name: string } // name drives the terminal's closing line
  | { status: "error"; message: string };

export async function sendContactMessage(
  prev: ContactState,
  formData: FormData,
): Promise<ContactState>;
```

`status: "idle"` is the initial state. The client never constructs an `error` state itself; the `shake` for empty fields stays local and does not touch `ContactState`.

The field limits the action enforces:

| Field     | `FormData` key | Required | Max length | Extra                        |
| --------- | -------------- | -------- | ---------- | ---------------------------- |
| `NOMBRE`  | `name`         | yes      | 80         | trimmed                      |
| `CORREO`  | `email`        | yes      | 160        | trimmed, must match an email |
| `MENSAJE` | `msg`          | yes      | 2000       | trimmed                      |

Any violation returns `{ status: "error", message }` with one Spanish sentence, never a field map.

### `lib/emails/contact-message.ts`

```ts
export interface ContactMessage {
  name: string;
  email: string;
  msg: string;
}

export function buildContactEmail(m: ContactMessage): {
  subject: string; // `[Arcade Vault] Mensaje de ${m.name}`
  text: string;
  html: string;
};
```

Both bodies carry the three fields. Every interpolated value is HTML-escaped before it reaches `html`.

---

## 4 — Implementation plan

Each step leaves the project building.

1. **Read the guides first.** As `CLAUDE.md` requires, before writing any Next.js code read `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md` (Server Actions and `useActionState`), `node_modules/next/dist/docs/01-app/02-guides/forms.md`, and `node_modules/next/dist/docs/01-app/02-guides/environment-variables.md`. This Next version has breaking changes from training data; do not write the action from memory.
2. **Dependency.** `npm install resend`. Confirm the installed major version and use its own API surface rather than a remembered one.
3. **Environment.** Create `.env.example` with `RESEND_API_KEY`, `CONTACT_TO_EMAIL` and `CONTACT_FROM_EMAIL`, each with a comment and a placeholder value. `.gitignore` already ignores `.env*`, so `.env.example` must be force-added (`git add -f .env.example`) for it to be committed. Create a local `.env.local` for development.
4. **Resend client.** Create `lib/resend.ts`: reads the three variables, exposes `getResend()` returning a lazily constructed client (never built at module scope, so an import cannot break the build), and a helper reporting whether the key is configured.
5. **Email body.** Create `lib/emails/contact-message.ts` with `buildContactEmail` and its HTML escaping.
6. **Rate limiter.** Create `lib/rate-limit.ts`: a module-level `Map<string, number[]>` of timestamps, a sliding window of 10 minutes, a maximum of 3 allowed calls per key, and pruning of expired entries on each call so the map cannot grow unboundedly.
7. **Server Action.** Create `app/about/actions.ts` with `"use server"` at the top and `sendContactMessage`. In order: read and trim the three `FormData` fields; validate as per the table; resolve the caller's IP from the request headers and consult the rate limiter; if `RESEND_API_KEY` is missing and `process.env.NODE_ENV !== "production"`, `console.warn` the dry run, log the composed message and return `{ status: "sent" }`; otherwise send through Resend with `from: CONTACT_FROM_EMAIL`, `to: CONTACT_TO_EMAIL` and `replyTo` set to the visitor's address, and map the SDK's error into `{ status: "error" }` — logging the real cause server-side and returning only a generic sentence to the client.
8. **About content.** Create `lib/about-content.ts` with the types and constants above.
9. **Highlight icons.** Create `components/about/highlight-icon.tsx` — the three pixel SVGs with `className="hl-icon"`, `fill="currentColor"` so the parent accent colours them, and the literal `#0a0a0f` fills the `BROWSER` icon uses for its three title-bar dots.
10. **Contact form.** Create `components/about/contact-form.tsx` as a client component driving the whole form with `useActionState(sendContactMessage, { status: "idle" })`:
    - **idle** — the three fields and `▶  ENVIAR MENSAJE`, plus the local empty-field check that adds `shake` for 400 ms and does not submit.
    - **sending** — while `pending`: the button is disabled and reads `▸ TRANSMITIENDO…`, and the three inputs are `readOnly`.
    - **sent** — the `terminal-success` block, verbatim from the template, with the closing line naming the sender in upper case, and `ENVIAR OTRO MENSAJE` resetting to idle with empty fields.
    - **error** — the same terminal markup with an added `failed` modifier class, `[FAIL]` lines in place of the last `[OK]`, the action's message, and a `REINTENTAR` button that returns to idle **with the typed values preserved**, so a network blip does not cost the visitor their message.
11. **Error terminal styling.** Append to `app/globals.css` a small `.terminal-success.failed` block recolouring the border, glow and `.line` / `.success` text from `--green` to the red the design system already uses, reusing the same variables as the rest of the sheet. This is the only addition to the stylesheet and it must not alter any existing rule.
12. **The page.** Create `app/about/page.tsx` as a server component: `<RevealObserver />`, the `about fade-in` wrapper, the hero, the highlight row, the divider banner (`reveal`, `aria-hidden`), and the contact section (`reveal`) with intro, tips and `<ContactForm />`. Give it `export const metadata: Metadata = { title: "Acerca de" }`.
13. **Verification.** `npm run lint` and `npm run build`, then the Playwright pass described in the acceptance criteria. Screenshots go to `.playwright-screenshots/`.

---

## 5 — Acceptance criteria

- [ ] `npm run build` completes with no errors and `npm run lint` reports no errors.
- [ ] `npm run build` succeeds with **no** `.env.local` present — nothing validates env vars at module scope.
- [ ] `/about` renders and the nav's `Acerca de` link no longer reaches the themed 404; the link shows its active state on `/about`.
- [ ] The hero shows the kicker `▸ ACERCA DE`, the title `ACERCA DE ARCADE VAULT` and the mission paragraph, its text matching `about.jsx` character for character.
- [ ] The three highlights render with their icons and accent colours (magenta, cyan, green) and `transitionDelay` values 0 ms, 80 ms, 160 ms.
- [ ] The divider banner renders exactly 24 `span` pixels with `animationDelay` stepping by 80 ms.
- [ ] The contact intro shows the kicker `▸ CONTACTO`, the title `CONTÁCTANOS`, the subtitle and the three tips with their green, yellow and magenta LEDs.
- [ ] Submitting with any of the three fields empty adds `shake` to the form for ~400 ms, calls no Server Action (verified by the network panel recording no request), and leaves the fields untouched.
- [ ] Submitting a valid form disables the button, shows `▸ TRANSMITIENDO…` and makes the inputs `readOnly` while the request is in flight.
- [ ] On success the `terminal-success` block replaces the form, the closing line names the sender in upper case, and `ENVIAR OTRO MENSAJE` returns to an empty form.
- [ ] With a real `RESEND_API_KEY`, submitting delivers one email to `CONTACT_TO_EMAIL` whose subject is `[Arcade Vault] Mensaje de <nombre>`, whose body carries the three fields, and whose `Reply-To` is the address typed in the form.
- [ ] With no `RESEND_API_KEY` in development, submitting logs the dry-run warning plus the message to the server console, sends no email, and still shows the success terminal.
- [ ] A submission carrying an invalid email, or a field over its maximum length, is rejected by the action with the red terminal, even when the client-side check is bypassed by calling the action directly.
- [ ] A forced failure (invalid API key) shows the red terminal with its `[FAIL]` line, and `REINTENTAR` brings back the form **with the typed values still in the fields**.
- [ ] The real Resend error is visible in the server log and the browser only ever receives the generic sentence — no API key, no stack, no SDK payload.
- [ ] A fourth submission from the same IP inside 10 minutes is rejected by the rate limiter with the red terminal and its own message, and sends no email.
- [ ] Scrolling to the divider and to the contact section adds `in` to each and they fade up; the class is not removed on scrolling back.
- [ ] A Playwright comparison of `/about` against the reference `about.jsx` served statically, with animations frozen, shows matching bounding boxes for the hero, the highlight row, the divider and the contact grid at 1440 px and at 800 px, in both the idle and the success states.
- [ ] The browser console reports no errors or hydration warnings on `/about`.
- [ ] The screens from SPEC 01 and the landing from SPEC 02 render unchanged after the stylesheet addition.
- [ ] `.env.example` is committed and lists the three variables; no real key appears anywhere in the tree.

---

## 6 — Decisions taken and discarded

| Decision         | Taken                                                                                  | Discarded                                              | Why                                                                                                                                                                                                                |
| ---------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Send mechanism   | Server Action in `app/about/actions.ts` consumed with `useActionState`                 | A `POST` route handler at `app/api/contact/route.ts`   | No public endpoint, the API key never leaves the server, and no hand-written `fetch` or JSON serialisation. Nothing else needs to post a contact message, so a reusable endpoint would buy nothing.                |
| Failure UI       | The same terminal block with a `failed` modifier, in red, with `[FAIL]` lines          | A red line above the button; or always showing success | The template defines no error state at all, so one must be added; reusing the terminal keeps it inside the established vocabulary instead of inventing a component. Always-succeed would lie and lose the message. |
| Retry behaviour  | `REINTENTAR` preserves the typed values                                                | Resetting to an empty form like `ENVIAR OTRO MENSAJE`  | A failure is usually not the visitor's fault, and making them retype a 2000-character message would be the worst moment to clear the form.                                                                         |
| Validation split | Template's empty-field `shake` on the client, strict validation on the server          | Only the template's check; or a shared Zod schema      | The server can never trust the client, and a Server Action is directly callable. Zod would add a dependency and demand per-field error UI the template does not define.                                            |
| Pending state    | Button disabled, relabelled `▸ TRANSMITIENDO…`, inputs `readOnly`                      | Only disabling the button; or a progressive terminal   | The network wait is real and needs a signal; double submits are what the disabled button prevents. A progressive terminal animation would be invented behaviour with no reference to match.                        |
| Addresses        | `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL` in env, `replyTo` = visitor | Destination hardcoded in `lib/`                        | Keeps a personal mailbox out of a public repo and lets each deployment pick its own. `replyTo` makes replying possible despite the fixed sender.                                                                   |
| Missing API key  | Dry run outside production: log and report success; error in production                | Always error; or fail the build at import time         | Anyone can clone and work on the page without a Resend account, and CI can build. Production still refuses to pretend. The trade-off is recorded under risks.                                                      |
| Email body       | `text` plus a simple inline-HTML string in `lib/emails/contact-message.ts`             | Plain text only; a React Email template                | HTML makes the message readable at a glance for a body that is three labelled fields; React Email would add dependencies for an email nobody but the team reads.                                                   |
| Anti-spam        | In-memory sliding-window limit, 3 per IP per 10 minutes                                | Nothing; a honeypot; honeypot plus limit               | A publicly callable action can be looped and Resend's quota is finite. The limiter is the piece that actually stops a loop; the honeypot only stops naive bots and adds a hidden field to test.                    |
| Acknowledgement  | None                                                                                   | A confirmation email back to the visitor               | The form already promises a 24-48h reply, a second send doubles the quota, and sending to an unverified address invites using the domain to mail third parties.                                                    |
| Resend client    | `lib/resend.ts`, lazily constructed                                                    | `new Resend(...)` inline in the action                 | Same module pattern as `lib/games.ts` and `lib/home-content.ts`, and lazy construction is what keeps a missing key from breaking `next build`.                                                                     |
| Reveal observer  | Reuse `components/home/reveal-observer.tsx`                                            | A copy under `components/about/`                       | It is already an exact port of the hook `about.jsx` repeats verbatim; its `components/home/` path is a naming wart worth less than a second copy to keep in sync.                                                  |
| Nav              | Untouched                                                                              | Adding the active state for `/about`                   | SPEC 02 already shipped both the link and `cls(pathname === "/about")`. Nothing is missing.                                                                                                                        |

---

## 7 — Identified risks

- **The rate limiter dies with the process and does not span instances.** A module-level `Map` resets on every restart, and on a serverless or multi-instance deployment each instance counts separately, so the effective limit is 3 × instances. It stops casual abuse and nothing more; a real limit needs shared storage, which is explicitly out of scope.
- **IP resolution is only as trustworthy as the proxy.** The caller's address comes from request headers, which a client can forge unless a trusted proxy overwrites them. Behind Vercel or a correctly configured reverse proxy this is fine; served directly, the limiter is bypassable by spoofing a header.
- **The dry run can mask a real misconfiguration.** A deployment whose `NODE_ENV` is not `production` and whose key is missing will show visitors the success terminal while silently sending nothing. The `console.warn` is the only signal; the production check is what keeps it from happening where it matters.
- **`onboarding@resend.dev` is a testing sender.** Without a verified domain, delivery is limited and messages are likelier to be filtered as spam. Fine for development; a deployment that expects to actually receive mail needs its own verified domain, which this spec does not set up.
- **HTML injection into the email body.** The three fields are attacker-controlled and land in an HTML email. Every interpolated value must be escaped in `buildContactEmail`; forgetting it turns the contact form into a way to mail arbitrary markup to the team's inbox.
- **`.env.example` is caught by `.gitignore`.** The `.env*` pattern ignores it, so a plain `git add` silently skips the file and the repo ships without documentation for the three variables. It needs `git add -f`.
- **Leaking the Resend error to the client.** The SDK's error can carry request details; returning it straight into `ContactState` would surface it in the browser. Only the generic sentence crosses the boundary.
- **A modifier class that bleeds into the success terminal.** The `.failed` rules are appended to a 1200-line stylesheet where `.terminal-success` already exists; scoping them loosely would recolour the success state too. Check both states visually after the CSS step.
