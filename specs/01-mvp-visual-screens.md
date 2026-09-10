# SPEC 01 — MVP: visual screens of Arcade Vault

> **Status:** Implemented
> **Depends on:** —
> **Date:** 2026-09-09
> **Objective:** Port the five screens of the `references/templates/` prototype to the Next.js App Router as a purely visual MVP, with no playable game.

---

## 1 — Why this spec exists

The visual prototype already exists as plain React 18 + Babel-standalone under `references/templates/` (`biblioteca`, `detalle`, `reproductor`, `auth`, `salon`, plus `nav` and mock data). Its theme has already been ported: `app/globals.css` holds the ~950 lines of arcade CSS with the font variables rewired to `next/font`, and `app/layout.tsx` already loads Press Start 2P / JetBrains Mono / Courier Prime and paints `.av-bg` and `.av-noise`.

What is missing is everything else: the prototype's hash-based router, its `window.*` globals and its untyped JSX have no equivalent in the project. This spec covers that translation and nothing more — no game engine, no backend.

---

## 2 — Scope

**In:**

- Five screens as real App Router routes: `/` (Library), `/juegos/[id]` (Game detail), `/jugar/[id]` (Player), `/auth` (Sign in / Sign up), `/salon` (Hall of Fame).
- Shared `Nav` in the root layout, with desktop links, mobile hamburger + side panel, static credits counter and session-aware button.
- Shared footer in the root layout (`© 2026 ARCADE VAULT · HECHO CON PIXELES Y NEÓN · v2.6.0`).
- Mock data ported to TypeScript in `lib/games.ts`: the 8 games, the category list and the deterministic `seededScores` generator.
- Fake session persisted in `localStorage` (`av_user`) through a client context, plus fake saved scores (`av_scores`).
- Simulated gameplay on the player screen: auto-incrementing score, lives, level, pause, END button and the game-over modal with score saving.
- Themed `app/not-found.tsx`, reached via `notFound()` when a game id does not exist.
- All existing CSS classes from `app/globals.css` are consumed as-is; Tailwind is only used for incidental layout tweaks.
- All visible copy stays in Spanish, exactly as in the prototype.

**Out of scope (for future specs):**

- Any real game logic or canvas rendering — every game remains a simulation.
- Real authentication, real Google/GitHub OAuth (the social buttons stay inert) and any backend or database.
- Real leaderboards: scores saved to `localStorage` are not read back into the Hall of Fame, which keeps showing `seededScores` output.
- A working credits/coins system — `CRÉDITOS · 03` is a static label.
- Account/profile screen, server-side search, pagination, i18n and automated tests.
- Removing `references/templates/` — it stays as the visual reference.

---

## 3 — Data model

No persistence layer beyond the browser. Two new modules define everything.

### `lib/games.ts`

```ts
export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type GameColor = "cyan" | "magenta" | "yellow" | "green";

export interface Game {
  id: string; // "bloque-buster"
  title: string; // "BLOQUE BUSTER"
  short: string; // one-line pitch for the card
  long: string; // paragraph for the detail screen
  cat: GameCategory;
  cover: string; // CSS class of the cover gradient, e.g. "cover-bricks"
  color: GameColor; // button accent on the card
  best: number;
  plays: string; // already formatted, e.g. "12.4K"
}

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string; // "dd/mm/2026"
}

export const GAMES: Game[]; // the 8 games from data.jsx, verbatim
export const CATS: readonly string[]; // ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"]
export function getGame(id: string): Game | undefined;
export function seededScores(seed: number, count?: number): ScoreRow[];
```

`seededScores` keeps the prototype's LCG (`s = (s * 9301 + 49297) % 233280`) untouched: it is deterministic, so server and client produce identical rows and there is no hydration mismatch. Seeds stay the same as the prototype (`id.length * 17 + 3` for the detail leaderboard, `id.length * 23 + 7` for the Hall of Fame).

### `lib/session.tsx` — fake session

```ts
export interface VaultUser {
  name: string;
} // uppercase, max 10 chars

export interface SavedScore {
  game: string; // Game["id"]
  score: number;
  name: string;
  at: number; // Date.now()
}
```

A `SessionProvider` client component exposes `{ user, signIn, signOut, saveScore }`. Keys: `av_user` (a `VaultUser` or absent) and `av_scores` (an array of `SavedScore`). Reads happen in an effect after mount so the server-rendered markup and the first client render match; before hydration completes the nav renders the signed-out state. Malformed JSON is swallowed and treated as "no data", exactly as the prototype does.

---

## 4 — Implementation plan

Each step leaves the project building and navigable.

1. **Data layer.** Create `lib/games.ts` with the types, the 8 games, `CATS`, `getGame` and `seededScores`, copied from `references/templates/data.jsx`. Nothing consumes it yet.
2. **Session layer.** Create `lib/session.tsx` with `SessionProvider` and a `useSession` hook over `localStorage`. Wrap `{children}` in `app/layout.tsx` with it.
3. **Shell.** Create `components/nav.tsx` (client: mobile panel state, `usePathname` for the active link, `useSession` for the auth button) and `components/site-footer.tsx`. Mount both in `app/layout.tsx` around `{children}` inside `#root`. The nav's Library link stays active on `/juegos/*` and `/jugar/*`, mirroring the prototype's `isActive`.
4. **Library — `/`.** Replace the `create-next-app` content of `app/page.tsx` with the hero + filters + grid. `app/page.tsx` is a server component; the search box, category chips and filtered grid live in a client `components/library-grid.tsx` that receives `GAMES` as a prop. `components/game-card.tsx` keeps the mouse-tilt effect and links to `/juegos/[id]`. Includes the "NO HAY RESULTADOS" empty state.
5. **Detail — `/juegos/[id]`.** Server component: resolves the game with `getGame`, calls `notFound()` when missing, renders the cover, tags, stats strip, actions (JUGAR AHORA → `/jugar/[id]`, VOLVER AL VAULT → `/`) and a `components/leaderboard.tsx` fed by `seededScores(id.length * 17 + 3, 10)`.
6. **Not found.** Add `app/not-found.tsx` with the arcade look (pixel `GAME OVER · 404`, short line, button back to `/`).
7. **Hall of Fame — `/salon`.** Server page with the header; a client `components/hall-of-fame.tsx` owns the selected-game tab state, the gold/silver/bronze podium, the full table and the "TU MEJOR MARCA" rows shown only when `useSession` reports a user.
8. **Auth — `/auth`.** Client page: tab switch between `INICIAR SESIÓN` and `CREAR CUENTA` (the e-mail field only appears in sign-up), inert social buttons, and a submit that calls `signIn({ name })` — defaulting to `PLAYER1`, uppercased and truncated to 10 chars — then routes to `/`. `JUGAR COMO INVITADO` calls `signOut()` and routes to `/`.
9. **Player — `/jugar/[id]`.** Server page resolving the game (or `notFound()`), rendering a client `components/game-player.tsx`: HUD (player, score, lives, level), the CRT frame with the animated arena, pause overlay, `FIN` button, and the game-over modal with the editable name field that calls `saveScore` and then shows `▸ PUNTUACIÓN GUARDADA_`. The score interval runs every 220 ms and is cleared on pause, game over and unmount.
10. **Metadata and cleanup.** Give each route a `metadata` title (`Biblioteca`, the game title, `Salón de la Fama`, `Acceso`). Remove the leftover `create-next-app` assets that are no longer referenced. Run `npm run lint` and `npm run build`.

Before writing any route file, consult the guides under `node_modules/next/dist/docs/` as `CLAUDE.md` requires — in particular the dynamic-route `params` signature and page prop typing for this Next version, which differ from older releases.

---

## 5 — Acceptance criteria

- [ ] `npm run build` completes with no errors and `npm run lint` reports no errors.
- [ ] `/` shows the hero, the search field, the 5 category chips and the 8 game cards.
- [ ] Typing in the search field filters cards by title; selecting a chip filters by category; both combined show "NO HAY RESULTADOS" when nothing matches.
- [ ] Clicking a card or its JUGAR button navigates to `/juegos/<id>`.
- [ ] `/juegos/bloque-buster` shows cover, tags, long description, stats strip and a 10-row leaderboard; the rows are identical on reload and the console shows no hydration warning.
- [ ] `/juegos/no-existe` and `/jugar/no-existe` render the themed 404, not a blank screen.
- [ ] `/jugar/caida` increments the score automatically; PAUSA freezes it and shows the overlay; REANUDAR resumes; FIN opens the modal with the final score.
- [ ] In the modal, GUARDAR PUNTUACIÓN replaces the input with the saved toast and appends an entry to `av_scores` in `localStorage`; JUGAR DE NUEVO resets score, lives and level.
- [ ] Submitting the `/auth` form sets `av_user` in `localStorage`, redirects to `/`, and the nav then shows the uppercased user name instead of "Iniciar Sesión".
- [ ] Clicking the user name in the nav signs out, clears `av_user` and restores the "Iniciar Sesión" button.
- [ ] With a session active, `/salon` shows the "▸ TU MEJOR MARCA EN …" rows; without one, it does not.
- [ ] `/salon` tabs switch the podium and the table between the 8 games.
- [ ] Below 900 px the nav collapses into the hamburger, and the side panel opens, navigates and closes.
- [ ] Reloading any route keeps the session state (the nav does not flip back to signed-out).
- [ ] No page loads files from `references/templates/` at runtime; that folder is reference material only.

---

## 6 — Decisions taken and discarded

| Decision        | Taken                                                                       | Discarded                                                     | Why                                                                                                                                              |
| --------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Routing         | Real App Router routes in Spanish (`/juegos/[id]`, `/jugar/[id]`, `/salon`) | The prototype's hash router in a single client page           | Shareable URLs, back-button support and native `Link` prefetch; the hash router was a constraint of the no-build prototype, not a design choice. |
| Player screen   | Full simulation (auto score, lives, level, pause, game-over modal)          | A static, frozen HUD                                          | The MVP is visual, but a dead screen makes the HUD, the pause overlay and the modal impossible to review. There is still no real game.           |
| Session         | `localStorage` behind a client context                                      | In-memory only, or no session at all                          | The signed-in states (nav, "TU MEJOR MARCA") must survive a reload to be reviewable, and no backend exists yet.                                  |
| Styling         | Consume the existing classes in `app/globals.css`                           | Rewrite the ~950 lines as Tailwind utilities                  | 1:1 fidelity with the prototype at zero risk; the scanlines, CRT, cover gradients and keyframes would be expensive and fragile to translate.     |
| Rendering       | Server components for page shells, `"use client"` only on interactive parts | `"use client"` on every page, as the prototype effectively is | Less JS shipped; `seededScores` is deterministic, so server-rendered leaderboards are safe.                                                      |
| Structure       | `lib/` and `components/` at the repo root, imported via `@/`                | `app/_lib/` and `app/_components/`                            | The `@/*` alias already points at the root, and the components are shared across routes rather than owned by one.                                |
| Missing game id | `notFound()` plus a themed `app/not-found.tsx`                              | Returning `null` like the prototype, or Next's default 404    | A blank screen is a broken state, and the default 404 breaks visually with the rest of the site.                                                 |
| Spec language   | English                                                                     | Spanish, matching the prototype's copy                        | The repository's global instructions require every Markdown file in the repo to be written in English. The UI copy itself stays in Spanish.      |

---

## 7 — Identified risks

- **Hydration mismatches.** The nav and the Hall of Fame depend on `localStorage`, which does not exist on the server. Reading it inside an effect after mount is mandatory; reading it during render produces mismatch warnings and a flash of the wrong state.
- **Next 16 API drift.** `CLAUDE.md` warns that this Next version breaks from training data — notably how `params` is typed and awaited in dynamic routes. Writing `/juegos/[id]` from memory is the most likely source of build failures; the local docs are the source of truth.
- **Tailwind preflight vs the theme.** `app/globals.css` imports Tailwind before the arcade rules. If a preflight reset overrides a prototype style, the fix is a more specific rule in the theme block, not reordering the import.
- **Timer leaks in the player.** The 220 ms interval must be cleared on pause, game over and unmount; the prototype's effect dependencies are the reference, and getting them wrong leaks intervals across navigations.
