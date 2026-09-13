# SPEC 06 — Real leaderboard and games table

> **Status:** Approved
> **Depends on:** SPEC 01, SPEC 02, SPEC 04, SPEC 05
> **Date:** 2026-09-13
> **Objective:** Persist every saved score in new Supabase `games` and `scores` tables through a validated Server Action, and read the detail leaderboard, the Hall of Fame, the catalog stats and the home ticker from them instead of fake data.

---

## 1 — Why this spec exists

The vault exists to compete for the highest score, but nothing competes yet. Every leaderboard comes from `seededScores()`, a deterministic fake generator in `lib/games.ts`. Every `best` / `plays` value is a hand-written number. The home ticker is a constant. The `FIN DEL JUEGO` modal writes to `av_scores` in `localStorage`, and nothing ever reads it back.

SPEC 04 left a working Supabase connection with an empty `public` schema. At the time of writing that is still the state: zero tables and zero migrations (MCP `list_tables`, `list_migrations`).

SPEC 04 and SPEC 05 both said a real leaderboard needs auth first. This spec deliberately does **not** wait for auth. Writes go through a Server Action that validates the input and inserts with a **server-only secret key**. RLS lets the public read and nothing else. Anyone can still claim any name and post any score through the action, because without auth nothing can stop that. This is recorded as an accepted risk, not solved.

"Games table" means a `games` table in the database, not a UI table. It is seeded from `lib/games.ts` and exists as the foreign-key target for `scores` and the source of per-game stats. The catalog's copy, covers and colours stay in `lib/games.ts`.

Two SPEC 05 acceptance criteria are superseded by this spec:

- `GUARDAR PUNTUACIÓN` no longer appends to `av_scores`. It inserts into `scores`.
- A space typed in the modal's name input is no longer inserted, because names are now restricted to `A–Z`, `0–9` and `_`. The space still must not start, pause or fire anything.

---

## 2 — Scope

**In:**

- One migration creating `public.games`, `public.scores` and the view `public.game_stats`, with RLS enabled, explicit grants, check constraints and indexes, and the 9 catalog games seeded.
- Regenerated `lib/supabase/database.types.ts`.
- `SUPABASE_SECRET_KEY` (server-only) and `lib/supabase/admin.ts`, a secret-key client guarded by `server-only`.
- `lib/supabase/public.ts`, a cookie-less publishable-key client for reads inside cache scopes.
- `lib/scores/` — types, player-name rules, formatting, cached server queries and the browser-side "your best" lookup.
- Server Action `submitScore` in `app/play/[id]/actions.ts`, used by the modal for **all 9 games**, simulated ones included.
- Modal save states: `GUARDANDO…`, saved, and a visible error with retry.
- The remembered player name: every successful save stores the name used in `localStorage` (`av_player_name`), and later runs are saved automatically under it, without asking.
- Removing `saveScore`, `SavedScore` and the `av_scores` writes from `lib/session.tsx`.
- The `/games/[id]` leaderboard (top 10) and its stat strip (`Partidas`, `Mejor global`) read from Supabase.
- The `/games` cards' `MEJOR PUNTUACIÓN` read from Supabase.
- The `/hall-of-fame` podium and table (top 12 per game) read from Supabase.
- The Hall of Fame row `TU MEJOR MARCA EN …` made real: the session name's best run in that game and its real rank.
- The `/home` `ÚLTIMAS PUNTUACIONES` ticker showing the last 7 saved scores, with a client-side relative time.
- Empty states (`SIN PUNTUACIONES AÚN`) and unavailable states (`RANKING NO DISPONIBLE`, `—`) wherever real data replaces fake data.
- On-demand revalidation: the Server Action invalidates the cached score reads right after inserting.
- Deleting `seededScores`, the fake `PLAYERS` list, the `best` / `plays` fields of `Game`, and the `TICKER` constant.

**Out of scope (for future specs):**

- Supabase Auth, real accounts, or any change to `/sign-in`, `components/auth-form.tsx` or the fake `av_user` session.
- Rate limiting score submissions. `lib/rate-limit.ts` is not touched.
- Anti-cheat or per-game score caps. Scores are any integer `≥ 0`.
- Migrating old `av_scores` entries. They stay in users' browsers, ignored.
- Moving the catalog (copy, covers, colours, categories) to the database.
- The home `TOP_PLAYERS` list and `HOME_STATS`. Both stay as they are, fake.
- Enabling `cacheComponents` / `use cache`. That migration is its own spec.
- Showing the player's rank inside the `FIN DEL JUEGO` modal.
- Realtime leaderboard updates, pagination beyond 10 / 12 rows, player profile pages.
- Any UI or tool to delete, edit or moderate scores. Cleanup is done with SQL.

---

## 3 — Data model

### Database — one migration

Created with `npm run db:new games_and_scores`, which yields `supabase/migrations/<timestamp>_games_and_scores.sql`.

```sql
create table public.games (
  id text primary key check (id ~ '^[a-z0-9-]{1,40}$'),
  title text not null,
  created_at timestamptz not null default now()
);

create table public.scores (
  id bigint generated always as identity primary key,
  game_id text not null references public.games (id) on delete restrict,
  player_name text not null check (player_name ~ '^[A-Z0-9_]{1,10}$'),
  score integer not null check (score >= 0),
  created_at timestamptz not null default now()
);

-- Leaderboard order: score desc, then the earlier run first.
create index scores_game_rank_idx on public.scores (game_id, score desc, created_at asc);
create index scores_recent_idx on public.scores (created_at desc);
create index scores_game_player_idx on public.scores (game_id, player_name);

create view public.game_stats with (security_invoker = true) as
  select g.id as game_id, max(s.score) as best, count(s.id) as plays
  from public.games g
  left join public.scores s on s.game_id = g.id
  group by g.id;
```

Security, in the same migration:

- `alter table … enable row level security` on both tables.
- `revoke all` on both tables and the view from `anon` and `authenticated`, then `grant select` back to both roles. `grant select, insert` on `scores` and `grant select` on `games` to `service_role`.
- One `for select to anon, authenticated using (true)` policy per table.
- **No** insert, update or delete policy anywhere. Only the secret key (`service_role`, which bypasses RLS) can write.

Seed, in the same migration: the 9 catalog rows, with `id` and `title` exactly as in `lib/games.ts`:

`asteroides`, `bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `rocas`, `ranaria`, `duelo-pixel`.

Conventions:

- `score` is `integer`. No cap is enforced, but the column type bounds it at `2 147 483 647`, which no run reaches.
- Ranking is **every saved run**, not the best per name. The same name may appear several times.
- Ties: the earlier `created_at` ranks higher.
- `plays` = the number of rows in `scores` for that game. Only saved runs count.
- A future game needs a migration inserting its `games` row, in the same change that adds it to `lib/games.ts`.

### Environment variables

| Variable              | Reaches the browser | Read by                 | Purpose                                                           |
| --------------------- | ------------------- | ----------------------- | ----------------------------------------------------------------- |
| `SUPABASE_SECRET_KEY` | **no**              | `lib/supabase/admin.ts` | Secret key, `sb_secret_…`. Bypasses RLS; used only for inserting. |

It never gains a `NEXT_PUBLIC_` prefix. The MCP cannot read it, so the user copies it from the dashboard (Settings > API Keys) into `.env.local`.

### Supabase clients

```ts
// lib/supabase/admin.ts — starts with `import "server-only"`
/** `null` when the URL or SUPABASE_SECRET_KEY is missing. Session persistence off. */
export function createSupabaseAdminClient(): SupabaseClient<Database> | null;

// lib/supabase/public.ts
/** Cookie-less publishable-key client, safe inside `unstable_cache`. `null` when unconfigured. */
export function createSupabasePublicClient(): SupabaseClient<Database> | null;
```

Both are built per call, like the SPEC 04 factories. The existing `createSupabaseServerClient` is not used for these reads because it calls `cookies()`, which is not allowed inside a cache scope.

### Score domain — `lib/scores/`

```ts
// lib/scores/types.ts — client-safe
export interface ScoreRow {
  // moved from lib/games.ts, same shape
  rank: number;
  name: string;
  score: number;
  /** "dd/mm/yyyy", UTC. */
  date: string;
}

export interface GameStats {
  /** null when the game has no scores yet. */
  best: number | null;
  plays: number;
}

/** Keyed by Game["id"]. */
export type GameStatsMap = Record<string, GameStats>;

export interface RecentScore {
  name: string;
  gameId: string;
  score: number;
  /** ISO timestamp from created_at. */
  at: string;
}
```

```ts
// lib/scores/player-name.ts — client-safe, shared by the modal and the action
export const PLAYER_NAME_PATTERN = /^[A-Z0-9_]{1,10}$/;
/** Uppercases, drops every character outside A–Z 0–9 _, cuts to 10. */
export function sanitizePlayerName(raw: string): string;
```

```ts
// lib/scores/format.ts — client-safe
export function formatScoreDate(iso: string): string; // "13/09/2026", UTC
export function formatPlays(n: number): string; // 0 → "0", 950 → "950", 21340 → "21.3K", 1250000 → "1.3M"
```

```ts
// lib/scores/queries.ts — starts with `import "server-only"`
export const SCORES_TAG = "scores";

/** Top `limit` runs of one game. `null` = unavailable (unconfigured or query failed). */
export function getLeaderboard(
  gameId: string,
  limit: number,
): Promise<ScoreRow[] | null>;

/** Every game's stats from `game_stats`. `null` = unavailable. */
export function getGameStats(): Promise<GameStatsMap | null>;

/** Latest `limit` saved runs across all games. `null` = unavailable. */
export function getRecentScores(limit: number): Promise<RecentScore[] | null>;
```

- Each query is an `unstable_cache` over `createSupabasePublicClient()`, tagged `[SCORES_TAG]`.
- Inside the cached function a Supabase error **throws**, so a failure is never cached. The exported wrapper catches it, logs it with a `[scores]` prefix and returns `null`.
- When Supabase is unconfigured the wrapper returns `null` without querying. `npm run build` therefore passes without credentials.

```ts
// lib/scores/player-best.ts — client-side, uses createSupabaseBrowserClient()
export interface PlayerBest {
  rank: number;
  score: number;
  date: string;
}

/** The name's best run in the game and its rank among all runs. `null` when none, unconfigured or failed. */
export function getPlayerBest(
  gameId: string,
  name: string,
): Promise<PlayerBest | null>;
```

Rank = 1 + the count of that game's rows with a higher score, or with an equal score and an earlier `created_at`.

### Server Action — `app/play/[id]/actions.ts`

```ts
"use server";

export type SubmitScoreResult =
  { status: "saved" } | { status: "error"; message: string };

export async function submitScore(input: {
  gameId: string;
  name: string;
  score: number;
}): Promise<SubmitScoreResult>;
```

Rules, in order. Like `sendContactMessage`, it trusts nothing the client sent.

| Check                                                               | Message returned                          |
| ------------------------------------------------------------------- | ----------------------------------------- |
| `getGame(gameId)` is undefined                                      | `JUEGO DESCONOCIDO`                       |
| `name` fails `PLAYER_NAME_PATTERN` (no server-side sanitizing)      | `NOMBRE NO VÁLIDO: SOLO A–Z, 0–9 Y _`     |
| `score` is not an integer, or `< 0`, or `> 2147483647`              | `PUNTUACIÓN NO VÁLIDA`                    |
| `createSupabaseAdminClient()` is `null`                             | `GUARDADO NO DISPONIBLE`                  |
| The insert returns `error` or throws                                | `NO SE PUDO GUARDAR. INTÉNTALO DE NUEVO.` |
| Success: `revalidateTag(SCORES_TAG, { expire: 0 })`, then `"saved"` | —                                         |

The SDK or database error is logged on the server only, never returned to the browser. `{ expire: 0 }` is the non-deprecated form that makes the next request block on fresh data. `updateTag` is not used, because its docs only cover tags assigned through `fetch` or `cacheTag`, not `unstable_cache`.

### Modal — `components/game-player.tsx`

```ts
type SaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved" }
  | { status: "error"; message: string };
```

| State    | Input    | Button                                    | Below the input                   |
| -------- | -------- | ----------------------------------------- | --------------------------------- |
| `idle`   | enabled  | `GUARDAR PUNTUACIÓN`                      | —                                 |
| `saving` | disabled | `GUARDANDO…`, disabled                    | —                                 |
| `error`  | enabled  | `GUARDAR PUNTUACIÓN`, enabled (the retry) | the message, class `.save-error`  |
| `saved`  | hidden   | hidden                                    | the existing `.toast-saved` block |

- The name field shows `typed ?? remembered ?? (sanitizePlayerName(user?.name ?? "") || "INVITADO")`. Once the player types, the field shows exactly that, even empty (the action then rejects it); `INVITADO` only fills in while nothing has been typed.
- Every keystroke passes through `sanitizePlayerName`.
- `JUGAR DE NUEVO` resets the state to `idle`.

**Remembered name** — `lib/scores/remembered-name.ts` (`"use client"`):

- Every `"saved"` result writes the name used to `localStorage.av_player_name`, whether the save was manual or automatic.
- `remembered` is that value, read through an external store (server snapshot `null`, so nothing mismatches on hydration). A value that fails `PLAYER_NAME_PATTERN` is ignored.
- When a run ends (the engine reports game over, or the player presses `FIN`) and a name is remembered, the modal opens already in `saving` and calls `submitScore` with the remembered name and the final score, with no click. `saved` shows the existing `.toast-saved` block; `error` shows the normal input and retry button, pre-filled with the remembered name.
- There is no UI to forget or change the remembered name; it stays until the browser storage is cleared. Signing out does not clear it.

### Page data flow

| Route           | Server reads                                                         | Renders                                                                                                                                      |
| --------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `/games/[id]`   | `getLeaderboard(id, 10)`, `getGameStats()`                           | `<Leaderboard rows>`. `Partidas` = `formatPlays(plays)`, or `—` when unavailable. `Mejor global` = `best`, or `—` when `null` / unavailable. |
| `/games`        | `getGameStats()`                                                     | `<LibraryGrid games stats>` → `<GameCard game stats>`. `MEJOR PUNTUACIÓN` = `best`, or `—`.                                                  |
| `/hall-of-fame` | `getLeaderboard(g.id, 12)` for each of the 9 games, in `Promise.all` | `<HallOfFame rowsByGame>`, where `rowsByGame: Record<string, ScoreRow[] \| null>`.                                                           |
| `/home`         | `getRecentScores(7)`                                                 | Ticker rows `name ▸ GAME.TITLE +score <TimeAgo at>`. The colour is the game's `color`.                                                       |

- Each of those four pages also exports `revalidate = 3600`. On-demand invalidation is the freshness mechanism. The hourly revalidation only exists so a page rendered during a Supabase outage recovers without waiting for the next save.
- `dynamicParams = false` and `generateStaticParams` stay as they are.

Empty and unavailable states:

| Where              | `[]` (no scores)                                              | `null` (unavailable)               |
| ------------------ | ------------------------------------------------------------- | ---------------------------------- |
| Detail leaderboard | `SIN PUNTUACIONES AÚN` + `SÉ EL PRIMERO EN ENTRAR AL RANKING` | `RANKING NO DISPONIBLE`            |
| Hall table         | the same two lines inside `.hall-table`                       | `RANKING NO DISPONIBLE`            |
| Hall podium        | each slot without a row shows `—` for name, score and date    | all three slots show `—`           |
| Home ticker        | one line `SIN PUNTUACIONES AÚN · SÉ EL PRIMERO`               | one line `ACTIVIDAD NO DISPONIBLE` |

### Other component changes

- `components/leaderboard.tsx`: rows are keyed by `rank`, not `name`, because names now repeat. It renders the states above.
- `components/hall-of-fame.tsx`: it gets its rows from props and no longer builds them. The `TU MEJOR MARCA` row calls `getPlayerBest(tab, sanitizePlayerName(user.name))` on tab change. It is hidden while loading, when signed out, when the sanitized name is empty, and when the result is `null`.
- `components/time-ago.tsx` (`"use client"`, new): it renders nothing on the server and, after hydration, `AHORA` (under 1 min), `hace N min`, `hace N h` or `hace N d`. It refreshes every 60 s, with no hydration warning.

### Removed

- From `lib/games.ts`: `best`, `plays`, `ScoreRow` (moved), `PLAYERS`, `seededScores`.
- From `lib/home-content.ts`: `TICKER` and `TickerEntry`.
- From `lib/session.tsx`: `SavedScore`, `SCORES_KEY`, `saveScore`, and `readStored` if it is left unused.

---

## 4 — Implementation plan

Each step leaves the project building and every route working.

1. **Read the guides first.** As `CLAUDE.md` requires, read these under `node_modules/next/dist/docs/01-app/` before writing any Next.js code: `02-guides/caching-without-cache-components.md`, `03-api-reference/04-functions/unstable_cache.md`, `03-api-reference/04-functions/revalidateTag.md`, `01-getting-started/07-mutating-data.md`, `02-guides/server-actions.md` and `02-guides/data-security.md`. Then read Supabase's RLS, views (`security_invoker`) and API-keys guides through the MCP `search_docs` tool. Confirm that `revalidateTag(tag, { expire: 0 })` expires `unstable_cache` entries tagged `tag`.
2. **Migration.** Run `npm run db:new games_and_scores` and write the SQL from the data model: tables, checks, indexes, view, RLS, grants, policies and the 9-row seed. Re-read it, then run `npm run db:push`. Check with MCP `list_tables` (2 tables, RLS on) and `get_advisors` (security): no finding about `games`, `scores` or `game_stats`.
3. **Types.** Run `npm run db:types` and commit the result. Confirm `Database` now lists `games`, `scores` and the `game_stats` view.
4. **Secret key and clients.**
   - Add `SUPABASE_SECRET_KEY=` to `specs/.env.example`, with a comment: server-only, bypasses RLS, never `NEXT_PUBLIC_`.
   - The user pastes the real key into `.env.local`.
   - Run `npm install server-only`.
   - Create `lib/supabase/admin.ts` and `lib/supabase/public.ts`. Nothing imports them yet.
5. **Score domain.** Create `lib/scores/types.ts` (move `ScoreRow` here and update the `Leaderboard` import), `lib/scores/player-name.ts` and `lib/scores/format.ts`.
6. **Queries.** Create `lib/scores/queries.ts` with `SCORES_TAG`, `getLeaderboard`, `getGameStats` and `getRecentScores`. Follow the cache and error rules from the data model. Nothing consumes it yet.
7. **Server Action.** Create `app/play/[id]/actions.ts` with `submitScore`, following the validation table.
8. **Design pass.** Invoke `/frontend-design`, as `CLAUDE.md` requires. It sets the direction for every new visual state before any CSS is written: `.save-error`, `.lb-empty`, the hall empty and unavailable rows, the `—` podium placeholders and `.tick-empty`. Use only the existing palette variables.
9. **Modal wiring.**
   - In `components/game-player.tsx`, replace `saveScore` with `submitScore` and the `SaveState` flow, and sanitize the name input.
   - In the same step, remove `saveScore`, `SavedScore` and `SCORES_KEY` from `lib/session.tsx`.
   - Add `.save-error` to `app/globals.css`.
10. **Detail leaderboard.** In `app/games/[id]/page.tsx`, read `getLeaderboard(id, 10)` and `getGameStats()`. Drive the leaderboard and the stat strip from them and export `revalidate = 3600`. Give `components/leaderboard.tsx` the rank key and the empty and unavailable states.
11. **Catalog stats.**
    - `app/games/page.tsx` reads `getGameStats()` and exports `revalidate = 3600`.
    - `LibraryGrid` and `GameCard` take `stats`.
    - Remove `best` and `plays` from `Game` and from the 9 entries in `lib/games.ts`.
12. **Hall of Fame.**
    - `app/hall-of-fame/page.tsx` reads the 9 leaderboards and exports `revalidate = 3600`.
    - `HallOfFame` takes `rowsByGame` and renders the podium placeholders and the empty and unavailable states.
    - Create `lib/scores/player-best.ts` and wire the real `TU MEJOR MARCA` row.
13. **Remove the fakes.** Delete `seededScores` and `PLAYERS` from `lib/games.ts`, now unused. `grep` confirms no references remain.
14. **Home ticker.**
    - Create `components/time-ago.tsx`.
    - `app/home/page.tsx` reads `getRecentScores(7)`, renders the ticker from it and exports `revalidate = 3600`.
    - Delete `TICKER` and `TickerEntry` from `lib/home-content.ts`.
    - `TOP_PLAYERS` and `HOME_STATS` are not touched.
15. **Verification.**
    - Run `npm run lint` and `npm run build` twice: with `.env.local`, and with it temporarily renamed.
    - Run the Playwright pass the acceptance criteria describe, against `npm run build && npm run start`. On-demand revalidation only shows in production mode; dev renders every request fresh.
    - Screenshots go to `.playwright-screenshots/`.

---

## 5 — Acceptance criteria

**Build and security**

- [ ] `npm run build` completes with no errors and `npm run lint` reports no errors.
- [ ] `npm run build` also succeeds with no Supabase variables. Then `/games/asteroides` shows `RANKING NO DISPONIBLE`, `Mejor global` `—` and `Partidas` `—`.
- [ ] MCP `list_tables` shows `games` and `scores` with RLS enabled. `select id from games order by id` returns exactly the 9 ids of `GAMES`.
- [ ] MCP `get_advisors` (security) reports no finding about `games`, `scores` or `game_stats`.
- [ ] An insert into `scores` sent with the **publishable** key (a `curl` `POST` to `/rest/v1/scores`) is rejected, and the row count does not change.
- [ ] A `select` on `scores` with the publishable key succeeds.
- [ ] SQL inserts with `player_name = 'ab c'`, with `score = -1`, and with `game_id = 'nope'` are each rejected by a constraint (MCP `execute_sql`).
- [ ] `lib/supabase/admin.ts` and `lib/scores/queries.ts` start with `import "server-only"`, and no `"use client"` module imports either.
- [ ] No file under `.next/static` contains `sb_secret_`. `SUPABASE_SECRET_KEY` appears only in `lib/supabase/admin.ts` and `specs/.env.example`.

**Fresh database (zero scores)**

- [ ] `/games/asteroides` shows `SIN PUNTUACIONES AÚN`, `Partidas` `0` and `Mejor global` `—`.
- [ ] Every card on `/games` shows `—` as `MEJOR PUNTUACIÓN`.
- [ ] `/hall-of-fame` shows `—` in all three podium slots and the empty line in the table.
- [ ] The `/home` ticker shows `SIN PUNTUACIONES AÚN · SÉ EL PRIMERO`, and `TOP_PLAYERS` renders unchanged.

**Saving**

- [ ] Finishing an `asteroides` run and saving as `PX_KAI` inserts exactly one row with `game_id = 'asteroides'` and `player_name = 'PX_KAI'`, and the modal score as `score`.
- [ ] While saving, the button reads `GUARDANDO…` and is disabled. A double click inserts one row.
- [ ] Saving from a simulated game (`/play/caida`, then `FIN`) inserts a row with `game_id = 'caida'`.
- [ ] Typing `ab c-ñ9` in the name input leaves `ABC9` in the field.
- [ ] With no remembered name: signed in with the fake session as `juan pérez`, the modal pre-fills `JUANPREZ`; signed out, it pre-fills `INVITADO`.
- [ ] With `SUPABASE_SECRET_KEY` removed, saving shows `GUARDADO NO DISPONIBLE`, the button stays enabled, and nothing is inserted.
- [ ] With the network offline, saving shows `NO SE PUDO GUARDAR. INTÉNTALO DE NUEVO.`. Back online, the same button saves.
- [ ] `JUGAR DE NUEVO` after a save brings back the `GUARDAR PUNTUACIÓN` button for the next run.
- [ ] After a save, `localStorage.av_scores` did not change. `grep -r saveScore app components lib` finds nothing.
- [ ] After a save as `PX_KAI`, `localStorage.av_player_name` is `PX_KAI`.
- [ ] With `PX_KAI` remembered, the next run is saved when it ends with no click: the modal goes through `GUARDANDO…` to `PUNTUACIÓN GUARDADA` and exactly one `PX_KAI` row is inserted.
- [ ] With `PX_KAI` remembered and the fake session as `juan pérez`, the run is saved as `PX_KAI`.
- [ ] With `av_player_name` set to `ab c`, nothing is saved automatically and the modal asks for the name as usual.
- [ ] With `PX_KAI` remembered and the network offline, the automatic save shows `NO SE PUDO GUARDAR. INTÉNTALO DE NUEVO.` with the input pre-filled with `PX_KAI`; back online, the button saves.

**Reading, in `npm run start`**

- [ ] Right after saving `PX_KAI` on `asteroides`, `/games/asteroides` shows that row in the leaderboard, `Partidas` up by one, and `Mejor global` updated when it is a new best.
- [ ] The `ASTEROIDES` card on `/games` shows the new best, the `ASTEROIDES` tab on `/hall-of-fame` lists the row, and the first `/home` ticker row reads `PX_KAI ▸ ASTEROIDES +<score> AHORA`.
- [ ] Two saves by the same name both appear as separate leaderboard rows.
- [ ] Two rows with the same score in one game are listed with the earlier one first.
- [ ] The detail leaderboard never shows more than 10 rows, and the hall table never more than 12.
- [ ] Every leaderboard date reads `dd/mm/yyyy`.
- [ ] Signed in as `PX_KAI`, the `TU MEJOR MARCA EN ASTEROIDES` row shows that name's highest score and a rank equal to its position in the full ordering.
- [ ] The row is hidden when signed out, and hidden for a signed-in name with no scores in that game.
- [ ] A ticker row's time moves from `AHORA` to `hace 1 min` within about two minutes without a reload.

**Leftovers**

- [ ] `grep -r "seededScores\|PLAYERS\|TICKER" app components lib` finds nothing, and `Game` has no `best` or `plays` field.
- [ ] `git diff lib/rate-limit.ts lib/supabase/server.ts components/auth-form.tsx` is empty.
- [ ] The browser console reports no errors or hydration warnings on `/home`, `/games`, `/games/asteroides`, `/hall-of-fame` and `/play/asteroides`.

---

## 6 — Decisions taken and discarded

| Decision           | Taken                                                                                    | Discarded                                                    | Why                                                                                                                                                                                   |
| ------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Games table"      | A `games` table seeded from `lib/games.ts`; the catalog stays local                      | The whole catalog in the DB; a UI-only table                 | It gives `scores` a real foreign key and a stats source without making routes, copy and covers depend on the DB.                                                                      |
| Auth               | Ship before auth                                                                         | Waiting for an auth spec                                     | The leaderboard is the platform's purpose. The spoofable-name cost is accepted and recorded under risks.                                                                              |
| Write path         | Server Action + server-only secret key; RLS grants the public `select` only              | Anonymous browser insert with an RLS `insert` policy         | With an insert policy anyone can bypass the app with `curl` and the public key. With none, every write passes the action's validation.                                                |
| Secret key         | `SUPABASE_SECRET_KEY` + `server-only`, used only for inserts                             | Reads with it too; the legacy `service_role` key             | Reads stay on the publishable key so RLS is exercised. Secret keys also answer `401` if ever used from a browser.                                                                     |
| Which games save   | All 9, simulated included                                                                | Only engine-backed games                                     | The user's choice. The simulated runs' self-climbing scores will enter the real ranking; see risks.                                                                                   |
| Ranking            | Every saved run                                                                          | Best run per name                                            | The user's choice. One name can fill a top 10; see risks.                                                                                                                             |
| Ties               | `score desc, created_at asc`                                                             | Newer first                                                  | Classic arcade rule: matching a record does not put you ahead of whoever set it.                                                                                                      |
| Score validation   | Any integer `≥ 0`; the `integer` column is the only ceiling                              | `1..9 999 999`; per-game caps                                | The user's choice. Without auth no cap prevents cheating inside the range anyway.                                                                                                     |
| Rate limit         | None                                                                                     | 10 per 10 min per IP; 3 per 10 min                           | The user's choice. `lib/rate-limit.ts` stays the contact form's alone; see risks.                                                                                                     |
| Name rule          | `^[A-Z0-9_]{1,10}$`; the input sanitizes as you type; the server rejects, never rewrites | Any printable text                                           | It matches the existing name style and rules out invisible or look-alike names. Rejecting on the server keeps the action honest to what the client sent.                              |
| Guests             | May save with the modal's name, default `INVITADO`                                       | Session required                                             | The fake session adds no guarantee over a typed name.                                                                                                                                 |
| Remembered name    | Stored after every save; later runs save automatically under it; no UI to change it          | Pre-fill only; a "not me" button; clearing it on sign-out    | The user's choice: returning players skip the modal entirely. The cost is recorded under risks.                                                                                       |
| Fake data          | Removed; real data with empty and unavailable states                                     | Padding with `seededScores`; seeding fake rows into `scores` | Nothing invented sits next to real names, and nothing fake is left in the table forever.                                                                                              |
| Empty vs down      | Two states: `SIN PUNTUACIONES AÚN` and `RANKING NO DISPONIBLE`                           | One state for both                                           | Telling a visitor "no scores yet" while the database is down would be wrong.                                                                                                          |
| `plays`            | Count of saved rows, from the `game_stats` view                                          | Recording every game over                                    | No extra write path. A view keeps the aggregate in SQL and respects RLS through `security_invoker`.                                                                                   |
| `av_scores`        | Stop writing it; old entries ignored                                                     | Writing both; fallback only                                  | One source of truth. Nothing ever read `av_scores`.                                                                                                                                   |
| Save failure UX    | Visible message, button stays as retry, `GUARDANDO…` while pending                       | Silent "saved"                                               | Claiming a save that did not happen is the worst outcome for a leaderboard.                                                                                                           |
| Freshness          | On-demand: `revalidateTag("scores", { expire: 0 })` after each insert                    | Time-based only; dynamic per request                         | The saver sees their run on the next view, and other visits keep hitting the cache.                                                                                                   |
| Cache model        | Previous model: `unstable_cache` + tags                                                  | Enabling `cacheComponents` now                               | `cacheComponents` changes the whole app, including `<Activity>` navigation under the game player. It gets its own migration spec, even though `unstable_cache` is marked as replaced. |
| Invalidation grain | One tag, `scores`                                                                        | Per-game tags                                                | The stats map and the ticker change on every save anyway, so per-game tags would save almost nothing.                                                                                 |
| Safety revalidate  | `revalidate = 3600` on the four reading pages                                            | None                                                         | A page rendered during an outage would otherwise keep `RANKING NO DISPONIBLE` until the next save.                                                                                    |
| Read client        | New cookie-less `createSupabasePublicClient`                                             | `createSupabaseServerClient`                                 | The server client calls `cookies()`, which cache scopes forbid.                                                                                                                       |
| "Your best" row    | Real, by the sanitized session name, fetched in the browser                              | Removing it; leaving it fake; a Server Action for reads      | It is per viewer, so it cannot live in the cached page. The browser client plus public `select` needs no new endpoint.                                                                |
| Stats placement    | `/games/[id]` stat strip and `/games` cards                                              | The detail page only                                         | A card and its detail page must not show different bests. `/home` mini cards show no stats, so nothing changes there.                                                                 |
| Home               | Real ticker; `TOP_PLAYERS` untouched                                                     | Both real; neither                                           | Ranking raw scores across games with different scales (184K vs 24) means nothing. A cross-game ranking needs its own design.                                                          |
| Ticker time        | Client `TimeAgo` from the ISO timestamp                                                  | `hace N min` rendered on the server                          | The page is cached, so a server-rendered time would freeze.                                                                                                                           |
| Dates              | `dd/mm/yyyy` in UTC                                                                      | The viewer's time zone                                       | Server and client produce the same string, so there is no hydration mismatch. A late-night run may show the next day.                                                                 |
| Catalog sync       | Every new game adds its `games` row in a migration                                       | Upserting `games` from `lib/games.ts` at runtime             | Runtime upserts would need the secret key on every read path. Drift is caught by an acceptance check.                                                                                 |

---

## 7 — Identified risks

- **Anyone can post any score under any name.** With no auth, no rate limit and no cap, the Server Action accepts a scripted flood or a fake record. Only malformed input is stopped. Mitigation today: delete rows with SQL. The real fix is the auth spec, plus a rate-limit spec if this happens before auth lands.
- **Simulated scores pollute the ranking.** The 8 simulated games raise the score by themselves, so their leaderboards measure patience, not skill. Accepted by choice. When a game gets a real engine, its old simulated rows may need a cleanup.
- **One name can fill a leaderboard.** With every run ranked, a single player saving repeatedly can occupy the whole top 10.
- **Name impersonation.** `TU MEJOR MARCA` matches by name, so two people using `PX_KAI` share one "best". It will be wrong until auth ties scores to accounts.
- **Every run is saved automatically once a name is remembered.** An accidental `FIN` at 0 points becomes a real row, and on a shared device the next person plays under the previous name. A mistyped name cannot be changed from the UI; only clearing the browser storage resets it. Accepted by choice.
- **Secret-key leak.** The key bypasses RLS entirely. Three things guard it: `server-only`, the absence of a `NEXT_PUBLIC_` prefix, and the `.next/static` grep criterion. Rotate the key in the dashboard if it ever leaks.
- **Catalog drift.** A game added to `lib/games.ts` without its `games` row makes every save for it fail with `NO SE PUDO GUARDAR`. The acceptance check comparing ids catches it at review time.
- **A cached failure.** If Supabase is down while a page regenerates, the page shows `RANKING NO DISPONIBLE` until the next save or at most an hour. Failures themselves are never stored in the data cache.
- **`unstable_cache` is marked as replaced in Next 16.** It still works in the previous model, but the future `cacheComponents` spec must move `lib/scores/queries.ts` to `use cache` + `cacheTag` (+ `updateTag`).
- **In-memory cache on multiple instances.** On a multi-instance or serverless deployment, `revalidateTag` may not reach every instance's cache. It is fine for a single `next start`. Revisit at deployment time.
- **Supabase's explicit-grant default.** Tables created in raw SQL may carry no default grants for `anon`, `authenticated` or `service_role`. The migration grants explicitly. A missing grant shows up as every read being `null` or every save failing.

---

## What is **not** in this spec

- Auth, real accounts, or any change to the fake session beyond removing `saveScore`.
- Rate limiting, anti-cheat or score caps.
- Migrating old `av_scores` data.
- Moving the catalog to the database.
- Real `TOP_PLAYERS` or `HOME_STATS` on `/home`.
- `cacheComponents` / `use cache`.
- A rank in the game-over modal, realtime updates, pagination, profiles, or a moderation UI.

Each one of those, if it lands, goes in its own spec.
