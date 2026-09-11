# SPEC 02 — Home landing page and English route scheme

> **Status:** Approved
> **Depends on:** SPEC 01
> **Date:** 2026-09-09
> **Objective:** Port the `references/templates/home-about/home.jsx` landing page to `/home` and move every existing route to an English path, with `/` redirecting to `/home`.

---

## 1 — Why this spec exists

SPEC 01 delivered five screens with the library sitting at `/`. The new reference adds a proper landing page — hero with floating pixel silhouettes, feature grid, game rail, stats band, live-activity panels, pricing card with FAQ, and a final call to action — which is what a visitor should meet first.

That reshuffles the site: the landing takes the front door and the library moves aside. The user chose to rename every route to English while doing it, so the URL scheme stops being half Spanish and half English. Visible copy stays in Spanish throughout, exactly as in the templates.

The About page from the same reference folder is explicitly **not** part of this spec.

---

## 2 — Scope

**In:**

- New landing at `/home`, matching `references/templates/home-about/home.jsx` section by section: hero, `// 01` feature grid, `// 02` game rail, stats band, `// 03` live activity, `// 04` pricing, final CTA.
- Scroll-reveal behaviour: elements marked `.reveal` gain `.in` when they enter the viewport, via `IntersectionObserver` with `threshold: 0.12`, unobserved after firing.
- Decorative pixel SVGs: the eight floating silhouettes of the hero and the four feature icons (`GAMEPAD`, `FREE`, `TROPHY`, `ROCKET`), copied rect by rect.
- `/` redirects to `/home`.
- Every existing route renamed: `/` → `/games`, `/juegos/[id]` → `/games/[id]`, `/jugar/[id]` → `/play/[id]`, `/salon` → `/hall-of-fame`, `/auth` → `/sign-in`, with every internal link updated.
- Nav gains the two links from the new reference: `Inicio` (→ `/home`) and `Acerca de` (→ `/about`), and the logo now points at `/home`.
- `app/globals.css` is replaced by the full `references/templates/home-about/styles.css`, keeping the `@import "tailwindcss"` line and the `next/font` variable wiring.
- Home-only mock content lives in a new typed `lib/home-content.ts`.
- Page title for the landing.

**Out of scope (for future specs):**

- The About page (`references/templates/home-about/about.jsx`) and its contact terminal. The `Acerca de` link deliberately lands on the themed 404 until that spec exists.
- Making the live-activity panels real: the ticker rows and the top-player list stay hardcoded and are never read from `av_scores`.
- Any real pricing, payment or account tier behind the `$0` card.
- Redirects from the old Spanish URLs; they simply stop existing.
- Touching the simulated player, the fake session, or anything else SPEC 01 delivered beyond the path renames and link updates.

---

## 3 — Data model

No persistence. One new module holds the landing's own copy.

### `lib/home-content.ts`

```ts
export type AccentColor = "cyan" | "magenta" | "yellow" | "green";
export type FeatureIconKind = "GAMEPAD" | "FREE" | "TROPHY" | "ROCKET";

export interface Feature {
  icon: FeatureIconKind;
  title: string;
  description: string;
  color: AccentColor;
}

export interface TickerEntry {
  player: string;
  game: string; // display name, e.g. "Caída" — not a Game["id"]
  score: number;
  when: string; // "hace 2 min"
  color: AccentColor;
}

export interface TopPlayer {
  rank: number;
  player: string;
  score: number;
}

export interface HomeStat {
  value: string; // "12+", "MILES", "GLOBAL"
  unit: string;
  caption: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export const FEATURES: Feature[]; // 4 entries
export const TICKER: TickerEntry[]; // 7 entries
export const TOP_PLAYERS: TopPlayer[]; // 5 entries
export const HOME_STATS: HomeStat[]; // 3 entries
export const FAQ: FaqItem[]; // 3 entries
export const PRICING_PERKS: string[]; // 6 bullet lines
```

Values are copied verbatim from `home.jsx`, including the accent colours that drive `neon-*` classes and the `transitionDelay` ordering. The game rail reuses `GAMES` from `lib/games.ts` (`GAMES.slice(0, 6)`); no new game data is introduced.

---

## 4 — Implementation plan

Each step leaves the project building.

1. **Stylesheet.** Replace the body of `app/globals.css` with `references/templates/home-about/styles.css`. That file is a strict superset of the current one — 794 lines added, none removed — so the two edits that must survive are the leading `@import "tailwindcss";` and the `--pixel` / `--mono` variables pointing at `var(--font-press-start)`, `var(--font-jetbrains-mono)` and `var(--font-courier-prime)` instead of raw font names. Verify afterwards that the existing screens still render with their pixel fonts.
2. **Route renames.** Move the directories: `app/juegos/[id]` → `app/games/[id]`, `app/jugar/[id]` → `app/play/[id]`, `app/salon` → `app/hall-of-fame`, `app/auth` → `app/sign-in`, and the current `app/page.tsx` (the library) → `app/games/page.tsx`. Update `PageProps<"…">` route literals to match. Run `npm run build` so `.next/types/routes.d.ts` regenerates before typechecking.
3. **Link sweep.** Update every internal link to the new paths: `components/nav.tsx`, `components/game-card.tsx` (→ `/games/[id]`), `app/games/[id]/page.tsx` (→ `/play/[id]` and `/games`), `app/play/[id]/page.tsx` (SALIR → `/games/[id]`, VOLVER AL VAULT → `/games`), `components/auth-form.tsx` (→ `/games`), `components/hall-of-fame.tsx` and `app/hall-of-fame/page.tsx` (→ `/games`), and `app/not-found.tsx` (→ `/games`). Grep for the old segments to be sure none survives.
4. **Root redirect.** Delete `app/page.tsx` and add a `redirects()` entry to `next.config.ts` sending `/` to `/home` as a non-permanent redirect.
5. **Home content.** Create `lib/home-content.ts` with the types and the six exported constants above.
6. **Reveal observer.** Create `components/home/reveal-observer.tsx`, a client component that renders nothing and, on mount, observes every `.reveal` in the document with `IntersectionObserver`, adds `in` on intersection, unobserves the element, and disconnects on unmount — the `useReveal` hook of the template.
7. **Decorative SVGs.** Create `components/home/floating-silhouettes.tsx` (the eight `.silo` SVGs, `aria-hidden`) and `components/home/feature-icon.tsx` (the four pixel icons, `fill="currentColor"` so the parent accent colours them).
8. **Landing page.** Create `app/home/page.tsx` as a server component assembling the seven blocks in order, mounting `<RevealObserver />`, and using `Link` for every call to action: EXPLORAR JUEGOS and INSERTAR MONEDA → `/games`, CREAR CUENTA and EMPEZAR GRATIS → `/sign-in`, VER SALÓN → `/hall-of-fame`, VER TODOS LOS JUEGOS → `/games`, and each mini card → `/games/[id]`. Give it a `metadata` title.
9. **Nav.** Add `Inicio` (→ `/home`) and `Acerca de` (→ `/about`) to both the desktop links and the mobile panel, point the logo at `/home`, and update the active-state helper: Inicio is active on `/home`, Biblioteca on `/games` and its children `/games/[id]` and `/play/[id]`.
10. **Verification.** Run `npm run lint` and `npm run build`, then compare `/home` against the reference with Playwright as described below.

Before touching any route file, consult the guides under `node_modules/next/dist/docs/` as `CLAUDE.md` requires — in particular `01-app/03-api-reference/05-config/redirects.md` for the `/` redirect and the page-props typing for the renamed dynamic segments.

---

## 5 — Acceptance criteria

- [ ] `npm run build` completes with no errors and `npm run lint` reports no errors.
- [ ] `/` responds with a redirect to `/home`.
- [ ] `/home` renders, in order: hero, feature grid, game rail, stats band, activity grid, pricing, final CTA.
- [ ] The hero shows the eyebrow `▸ INSERTA UNA MONEDA_`, the three-line title (`EL ARCADE` / `CLÁSICO ESTÁ` / `DE VUELTA`), the two-line subtitle, both CTAs and the `DESLIZA ▼` indicator.
- [ ] The eight floating silhouettes and the four feature icons are present as inline SVG.
- [ ] The feature grid shows the four cards with their accent colours; the rail shows exactly 6 mini cards, each linking to its `/games/[id]`.
- [ ] The ticker shows 7 rows and the top list 5 rows, with the bar widths 100 %, 84 %, 68 %, 52 %, 36 %.
- [ ] The pricing card shows `$0 / SIEMPRE`, the 6 perks, the `FREE PLAY` stamp and 3 FAQ entries.
- [ ] Scrolling to a `.reveal` section adds the `in` class to it and it fades up; the class is not removed on scrolling back.
- [ ] Every CTA navigates where step 8 says, verified by clicking.
- [ ] `/games`, `/games/[id]`, `/play/[id]`, `/hall-of-fame` and `/sign-in` all render exactly what they rendered before the rename.
- [ ] The old paths `/juegos/caida`, `/jugar/caida`, `/salon` and `/auth` return the themed 404.
- [ ] `Acerca de` in the nav returns the themed 404 (deliberate until the About spec).
- [ ] Nav shows five links on desktop, the logo goes to `/home`, and Biblioteca stays lit on `/games`, `/games/[id]` and `/play/[id]`.
- [ ] A Playwright comparison of `/home` against the reference `home.jsx` served statically, with animations frozen, shows matching bounding boxes for hero, section heads, feature grid, rail, stats, activity grid, pricing card and final CTA at 1440 px and at 800 px.
- [ ] The browser console reports no errors or hydration warnings on `/home`.
- [ ] The screens from SPEC 01 still render with the Press Start 2P and JetBrains Mono faces after the stylesheet swap.

---

## 6 — Decisions taken and discarded

| Decision         | Taken                                                                        | Discarded                                              | Why                                                                                                                                                                                                       |
| ---------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Landing path     | `/home`, with `/` redirecting to it                                          | Landing directly at `/`                                | The user asked for an explicit `/home`; the redirect keeps the bare domain working.                                                                                                                       |
| Root redirect    | `redirects()` in `next.config.ts`                                            | An `app/page.tsx` calling `redirect()`                 | Handled before rendering, so no page component and no React render just to bounce. Non-permanent, because a landing at `/` is a plausible future change and a 308 would be cached by browsers.            |
| Route language   | Every route in English (`/games`, `/play/[id]`, `/hall-of-fame`, `/sign-in`) | Renaming only `/games` and leaving the rest in Spanish | Half-and-half URLs age badly, and the repo's global instruction is that code is written in English. Visible copy stays Spanish.                                                                           |
| Old Spanish URLs | Dropped, they 404                                                            | Redirects from `/juegos/[id]` and friends              | Nothing is published yet, so there are no external links to preserve.                                                                                                                                     |
| `Acerca de` link | Present, pointing at `/about`                                                | Omitting it, or rendering it disabled                  | Keeps the nav identical to the reference. It lands on the themed 404, which is an understandable dead end for a page that is coming, and a disabled state would invent a look the template never defines. |
| Stylesheet       | Copy `styles.css` whole                                                      | Copying only the ~315 lines the landing uses           | The About spec will need the rest anyway, and a wholesale copy keeps the file diffable against the reference. It does bring in ~470 lines of unused `GAMEPAD` / `Theme variants` rules.                   |
| Home copy        | `lib/home-content.ts`                                                        | Arrays inline in the components, as in the template    | Same shape as `lib/games.ts`; keeps the section components readable and the copy editable in one place.                                                                                                   |
| Scroll reveal    | Faithful port of the `IntersectionObserver` hook                             | A CSS-only or always-visible variant                   | The user asked for an exact match. The trade-off is recorded under risks.                                                                                                                                 |

---

## 7 — Identified risks

- **`.reveal` hides content without JavaScript.** The rule is `opacity: 0` until `.in` is added by the observer, so with scripting off every section below the hero is blank. This is the reference's behaviour and is being reproduced on purpose; if it ever matters, the fix is a `@media (scripting: none)` override, not a change to the observer.
- **Losing the font wiring in the stylesheet swap.** `app/globals.css` differs from the reference in exactly two places — the Tailwind import and the `--pixel` / `--mono` variables. Pasting the reference over it without re-applying those silently drops the pixel font across the whole site.
- **A missed link after the renames.** Five paths change at once and the links live in eight files. Any leftover `/juegos`, `/jugar`, `/salon` or `/auth` becomes a 404 that typechecking will not catch unless the route literal is typed; grep for the old segments before declaring the step done.
- **Stale generated route types.** As seen in SPEC 01, `.next/types/routes.d.ts` only regenerates on `next build`, so `tsc --noEmit` will report bogus errors on the renamed segments until a build has run.
- **Hydration and the observer.** `RevealObserver` queries the document on mount; if a section were rendered after it runs, that section would never reveal. Keeping the observer mounted alongside static markup in the same server-rendered page avoids this.
