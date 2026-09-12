# SPEC 05 — Asteroides, the first playable game

> **Status:** Approved
> **Depends on:** SPEC 01, SPEC 02
> **Date:** 2026-09-12
> **Objective:** Port `references/started-games/02-asteroids/game.js` to a new `asteroides` catalog entry that runs as a real canvas game inside the existing player, through a per-game engine registry that leaves the other eight games simulated.

---

## 1 — Why this spec exists

Every game in the vault is still the SPEC 01 simulation: the score climbs by itself on a 220 ms interval over a decorative CSS arena. The platform exists to play games and compete for scores, and none of that is possible yet.

`references/started-games/02-asteroids/` is a finished, dependency-free Asteroids clone: one `game.js` file on an 800×600 canvas. It cannot be dropped into Next as-is. It grabs the canvas with `getElementById`, keeps all its state in module-level globals, registers `window` key listeners it never removes, and draws its own HUD and game-over screen. Loaded naively, every navigation to the player would leak listeners and stack another `requestAnimationFrame` loop.

`asteroides` is a **new game**, not a replacement for `rocas`. `rocas` keeps its entry, its cover and its simulation exactly as they are today.

Tetris and Arkanoid already wait under `references/started-games/`. So this spec also sets the small contract every real game will follow: a factory that takes a canvas, reports stats through callbacks, and cleans up after itself. A registry maps catalog ids to those factories.

---

## 2 — Scope

**In:**

- New catalog entry `asteroides` in `lib/games.ts`, inserted as the **first** element of `GAMES`, with new Spanish copy that describes the real mechanics.
- New cover class `cover-asteroides` in `app/globals.css`, visually distinct from `cover-rocas`.
- The `/home` game rail grows from 6 to 7 cards: `GAMES.slice(0, 7)`, and `.mini-rail` uses 7 columns above 1100 px.
- A generic engine contract (`lib/engines/types.ts`) and a registry (`lib/engines/registry.ts`) mapping catalog ids to engine factories.
- A TypeScript port of `game.js` under `lib/engines/asteroids/`. It is instance-scoped, with no module-level mutable state, and every listener and frame is released on `destroy()`.
- Mechanics ported verbatim: every constant, the split rules, scoring, lives, respawn invincibility, level progression and the triple-shot power-up.
- The original look of `game.js`, unchanged: white vector lines on an opaque black background, a `#0ff` power-up and no glow. (Amended after implementation: the neon recolour first planned here was dropped at the user's request, both to keep the original style and to avoid the per-frame `shadowBlur` cost.)
- **Both HUDs.** The game keeps its own in-canvas HUD (`drawHUD` / `drawLifeIcon`: `SCORE`, `NIVEL`, the ship life icons and the `3x` timer) and its keyboard controls, ported verbatim. In addition, the engine notifies React of score, lives, level and the triple-shot timer so the existing React HUD shows them too.
- A new `DISPARO 3X` HUD stat, visible only while the power-up is active.
- A start overlay (`PULSA ESPACIO PARA EMPEZAR`) inside the CRT. Space or a click starts the run.
- Game over hands off to the existing `FIN DEL JUEGO` modal, which saves to `av_scores` through the unchanged `saveScore`. The canvas `GAME OVER` overlay is removed.
- Pause through the HUD button, the `P` and `Escape` keys, and automatically when the tab is hidden or the window loses focus.
- High-DPI rendering: the canvas backing store is scaled by the device pixel ratio while the game world stays 800×600.

**Out of scope (for future specs):**

- Any change to the `rocas` entry, its `cover-rocas` rule, or its simulation.
- Porting Tetris, Arkanoid or any other game. Only the registry slot they will use is created.
- Touch or on-screen controls. On a touch device the game renders but is not playable.
- Sound effects or music. The original has none.
- New mechanics or balance changes: no UFOs, no hyperspace, no extra power-ups.
- Persisting scores anywhere other than `av_scores`, including Supabase. A real leaderboard needs the auth spec first.
- Reading `av_scores` back into the Hall of Fame or the detail leaderboard. Both keep showing `seededScores`.
- Real `best` / `plays` values. They stay mock numbers like the rest of the catalog.
- Adding `P` / `Escape` shortcuts or auto-pause to the simulated games.
- Gamepad support, key remapping, a settings screen.

---

## 3 — Data model

No persistence is introduced. `av_scores` gains entries with `game: "asteroides"` through the existing `SavedScore` shape, unchanged.

### Catalog entry — `lib/games.ts`

Inserted at index `0` of `GAMES`. Nothing else in the file changes.

```ts
{
  id: "asteroides",
  title: "ASTEROIDES",
  short: "Parte rocas en pedazos sin chocar con ninguna.",
  long: "Tu nave vectorial deriva en un campo de asteroides sin bordes: lo que sale por un lado entra por el otro. Cada roca grande se parte en dos medianas y cada mediana en dos pequeñas. Atrapa el núcleo 3X y dispara en abanico durante cinco segundos.",
  cat: "SHOOTER",
  cover: "cover-asteroides",
  color: "cyan",
  best: 38750,
  plays: "21.3K",
}
```

Side effects of being first, all accepted: it becomes the first card in `/games`, the first card in the `/home` rail, and the default tab of `/hall-of-fame`. `generateStaticParams` in `/games/[id]` and `/play/[id]` already maps `GAMES`, so both routes prerender for it with no route change.

### Engine contract — `lib/engines/types.ts`

```ts
export interface EngineStats {
  score: number;
  lives: number;
  level: number;
  /** Seconds of triple shot left, rounded to one decimal; 0 when inactive. */
  powerUpSeconds: number;
}

export interface EngineCallbacks {
  /** Called only when at least one field changed, never once per frame for nothing. */
  onStats: (stats: EngineStats) => void;
  /** Called once, when the last life is lost. */
  onGameOver: (finalScore: number) => void;
}

export interface GameEngine {
  /** Leaves the frozen start frame and begins the run. Idempotent. */
  start(): void;
  /** Stops the frame loop and clears held keys. Idempotent. */
  pause(): void;
  /** Restarts the frame loop without a time jump. No-op before start() or after game over. */
  resume(): void;
  /** Cancels the frame loop and removes every listener; the instance is unusable afterwards. */
  destroy(): void;
}

export type EngineFactory = (
  canvas: HTMLCanvasElement,
  callbacks: EngineCallbacks,
) => GameEngine;
```

### Registry — `lib/engines/registry.ts`

```ts
export function getEngine(gameId: string): EngineFactory | undefined;
// Backed by a literal map: { asteroides: createAsteroidsGame }
```

`undefined` means the player falls back to the SPEC 01 simulation.

### Asteroids engine — `lib/engines/asteroids/`

| File           | Contents                                                                                                                                                                                                               |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `constants.ts` | World size (`W = 800`, `H = 600`), every numeric constant from `game.js` with its original value, and the original colours.                                                                                            |
| `entities.ts`  | `Bullet`, `Asteroid`, `PowerUp`, `Ship`, `Particle`. The same fields, update rules and colours as the original. `draw(ctx)` takes the context as a parameter. `Ship.update` receives the held-keys map as a parameter. |
| `game.ts`      | `createAsteroidsGame: EngineFactory`. It owns the run state, the loop, input, the device-pixel-ratio setup and the stats emission.                                                                                     |

Internal run phase, private to `game.ts`:

```ts
type Phase = "ready" | "playing" | "dead" | "gameover";
// plus a separate `paused: boolean`
```

- `ready`: the initial field of 4 large asteroids is drawn once and frozen. No update runs and no input is read.
- `playing` / `dead`: the original `'playing'` / `'dead'` states, unchanged.
- `gameover`: the loop stops, `onGameOver(score)` fires once, and nothing else happens. There is no Space-to-restart.

### Colours — `constants.ts`

The game keeps the colours of `game.js`, with no glow (`shadowBlur`) anywhere:

| Element                  | Colour                                                          |
| ------------------------ | --------------------------------------------------------------- |
| Ship outline             | `#fff`                                                          |
| Thrust flame             | `rgba(255, 130, 0, 0.85)`                                       |
| Asteroid outline         | `#fff`                                                          |
| Bullet                   | `#fff`                                                          |
| Power-up diamond + `3x`  | `#0ff`                                                          |
| Asteroid particles       | white, fading                                                   |
| Ship explosion particles | white, fading                                                   |
| Background               | `fillRect` `#000`                                               |
| In-canvas HUD            | white `15px monospace` text, white life icons, `#0ff` `3x` line |

The opaque background covers the `.crt-screen` `::before` vignette, as in the original; the `::after` scanlines stay on top of the canvas.

### Kept from the port: the in-canvas HUD

`drawHUD` and `drawLifeIcon` are ported **verbatim** and drawn every frame, on top of the world, in every phase including `ready`. This is the game's own HUD and it is not removed. The React HUD is an **additional** view of the same numbers. It never replaces the canvas HUD.

### Removed from the port

Only `drawOverlay` (the canvas `GAME OVER` screen) and the `gameover` Space-restart branch are removed. Game over is handled by the start overlay and the modal.

### Player HUD — `components/game-player.tsx`

When `getEngine(game.id)` returns a factory:

| HUD stat           | Source                                    | Visible          |
| ------------------ | ----------------------------------------- | ---------------- |
| `Jugador`          | unchanged                                 | always           |
| `Puntuación`       | `EngineStats.score`                       | always           |
| `Vidas`            | `EngineStats.lives` as `♥`                | always           |
| `Nivel`            | `EngineStats.level`, padded to 2 digits   | always           |
| `Disparo 3x` (new) | `EngineStats.powerUpSeconds`, e.g. `4.2s` | only while `> 0` |

The new stat uses the class `hud-stat power`. A new rule `.hud-stat.power .v` colours it `--green` with the same glow pattern as `.lives` and `.level`.

---

## 4 — Implementation plan

Each step leaves the project building and every route working.

1. **Read the guides first.** As `CLAUDE.md` requires, before writing any Next.js code read `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`, `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md` and `node_modules/next/dist/docs/01-app/02-guides/server-and-client-boundary.md`. Re-read `references/started-games/02-asteroids/game.js` end to end before porting.
2. **Catalog entry.** Insert the `asteroides` object at index `0` of `GAMES` exactly as in the data model. At this point `/play/asteroides` runs the simulation, which proves the routes prerender.
3. **Cover.** Invoke `/frontend-design` as `CLAUDE.md` requires. Then add `.cover-asteroides` with its `::before` / `::after` to `app/globals.css`, next to the other `cover-*` rules. Use only existing palette variables, and suggest the ship silhouette and polygonal rocks. Do not touch `.cover-rocas`.
4. **Home rail.** Change `GAMES.slice(0, 6)` to `GAMES.slice(0, 7)` in `app/home/page.tsx`. Change the base `.mini-rail` rule to `repeat(7, minmax(0, 1fr))`. Leave both media queries as they are.
5. **Engine contract and registry.** Create `lib/engines/types.ts` with the types above and `lib/engines/registry.ts` with `getEngine` over an empty map. Nothing consumes it yet.
6. **Constants and entities.** Create `lib/engines/asteroids/constants.ts` and `lib/engines/asteroids/entities.ts`. Port the five classes with the same numbers. Each class exposes `draw(ctx)` and uses the original colours. No module-level mutable state.
7. **Engine core.** Create `lib/engines/asteroids/game.ts` with `createAsteroidsGame`. It holds the per-instance state and ports `spawnAsteroids`, `initGame`, `nextLevel`, `explode`, `killShip`, `update`, `drawHUD`, `drawLifeIcon` and `draw` — the in-canvas HUD included — minus only `drawOverlay` and the Space-restart branch. It runs the `requestAnimationFrame` loop with the original 50 ms `dt` clamp, and emits `onStats` only on change and `onGameOver` once.
8. **Engine input and lifecycle.** In the same file, add `keydown` / `keyup` listeners on `window` with these rules:
   - Ignore events whose target is an `input`, `textarea`, `select` or content-editable element.
   - Ignore everything unless the phase is `playing` or `dead` and the game is not paused.
   - `preventDefault()` only on `ArrowLeft`, `ArrowRight`, `ArrowUp` and `Space`, and only when consumed.
   - `start()` clears the held-keys and just-pressed maps before the first frame.
   - `pause()` cancels the frame and clears both maps, so a key held during a blur does not stay stuck.
   - `resume()` resets `lastTime` to `null`.
   - `destroy()` cancels the frame and removes both listeners.
   - Size the backing store to `800 × dpr` by `600 × dpr`, with `dpr = Math.min(devicePixelRatio, 2)`, and apply `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`.
9. **Register.** Add `asteroides: createAsteroidsGame` to the registry map.
10. **Engine canvas.** Create `components/engine-canvas.tsx` (`"use client"`). It renders a `<canvas>` absolutely filling `.crt-screen`. In one effect it calls the factory and `destroy()`s on cleanup, which makes it safe under StrictMode's double mount. It calls `start()` / `pause()` / `resume()` from its `started` and `paused` props, and forwards the callbacks through refs so a re-render does not rebuild the engine.
11. **Player wiring.** In `components/game-player.tsx`, resolve `getEngine(game.id)`.
    - **With a factory:**
      - Render `<EngineCanvas>` in place of `.game-arena`, and do not run the simulation interval.
      - Drive score, lives and level from `onStats`.
      - Show the start overlay (a `.crt-content` block with `ASTEROIDES`, `PULSA ESPACIO PARA EMPEZAR` and the line `← → ROTAR · ↑ PROPULSAR · ESPACIO DISPARAR · P PAUSA`) until Space or a click starts the run.
      - Toggle `paused` on `P` / `Escape` while started and not over.
      - Set `paused` on `visibilitychange` to hidden and on window `blur` while started and not over.
      - `onGameOver` and the `FIN` button both open the existing modal, and the engine is paused behind it.
      - `JUGAR DE NUEVO` remounts `<EngineCanvas>` with a new `key`. That gives a fresh instance back at the start overlay with score 0, 3 lives and level 1.
    - **Without a factory:** the SPEC 01 code path runs exactly as today.
12. **HUD power stat.** Add the `Disparo 3x` stat with class `hud-stat power`, and append `.hud-stat.power .v` to `app/globals.css`.
13. **Verification.** Run `npm run lint` and `npm run build`, then the Playwright pass the acceptance criteria describe. Screenshots go to `.playwright-screenshots/`.

---

## 5 — Acceptance criteria

- [ ] `npm run build` completes with no errors and `npm run lint` reports no errors.
- [ ] `/games` shows 9 cards with `ASTEROIDES` first; `ROCAS` is still present with its original title, copy and cover.
- [ ] `git diff lib/games.ts` shows only the inserted `asteroides` object; `.cover-rocas` in `app/globals.css` has no diff.
- [ ] `/games/asteroides` renders the `cover-asteroides` cover, the new copy, `38.750` / `21.3K` in the stats strip and a 10-row leaderboard, with no hydration warning.
- [ ] `/home` shows 7 mini cards in one row at 1440 px, 3 columns at 1000 px and 2 columns at 500 px, with `ASTEROIDES` first.
- [ ] `/hall-of-fame` opens on the `ASTEROIDES` tab.
- [ ] `/play/asteroides` first shows the start overlay over a frozen field; nothing moves until Space or a click on the overlay.
- [ ] While playing, `←` / `→` rotate the ship, `↑` thrusts it with the flame, Space fires, and the page never scrolls.
- [ ] The canvas draws its own HUD during play: `SCORE  <n>` top-left, `NIVEL <n>` top-centre and one ship icon per life top-right, exactly as in the original `game.js`.
- [ ] At every moment the canvas HUD and the React HUD show the same score, lives and level.
- [ ] Destroying a large, medium and small asteroid adds exactly 20, 50 and 100 to both the canvas `SCORE` and the React `Puntuación`.
- [ ] Losing a life removes one `♥` from the HUD; the ship respawns in the centre after 2 s and blinks while invincible.
- [ ] Losing the third life opens the `FIN DEL JUEGO` modal showing the same score the HUD showed; no `GAME OVER` text is drawn on the canvas.
- [ ] Picking up the power-up shows `Disparo 3x` counting down from `5.0s`, each shot fires three bullets, and the stat disappears at zero.
- [ ] Clearing every asteroid moves `Nivel` to `02` and spawns 5 large asteroids.
- [ ] `P`, `Escape` and the `PAUSA` button each toggle pause; the `EN PAUSA` overlay appears and nothing on the canvas moves.
- [ ] Switching to another tab while playing leaves the game paused on return.
- [ ] `FIN` opens the modal with the current score and the canvas stops moving behind it.
- [ ] `GUARDAR PUNTUACIÓN` appends `{ game: "asteroides", score, name, at }` to `av_scores`.
- [ ] Typing a name with a space in the modal input inserts the space, and fires nothing.
- [ ] `JUGAR DE NUEVO` brings back the start overlay with `Puntuación` 0, three `♥` and `Nivel` `01`.
- [ ] After leaving `/play/asteroides` through `SALIR`, pressing Space and the arrows on `/games/asteroides` scrolls the page normally, and the console shows no errors.
- [ ] Entering and leaving `/play/asteroides` three times in a row, then playing, the ship rotates and bullets travel at the same speed as on the first visit (no stacked loops).
- [ ] The canvas `width` attribute equals `800 × min(devicePixelRatio, 2)` and the vector lines are not blurry on a 2× screen.
- [ ] A Playwright screenshot during play shows the original look: a white ship, white asteroids, white bullets and, when present, a cyan `3x` power-up on black, with no glow, under the CRT scanlines.
- [ ] `/play/rocas` and the other seven players still run the SPEC 01 simulation, and `P` does nothing there.
- [ ] The browser console reports no errors or hydration warnings on any route touched.
- [ ] No page loads files from `references/` at runtime.

---

## 6 — Decisions taken and discarded

| Decision          | Taken                                                                                            | Discarded                                                                 | Why                                                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catalog identity  | A new entry `asteroides`                                                                         | Reusing `rocas`; renaming `rocas`                                         | They are different games. `rocas` stays a separate simulated title and must not be modified.                                                          |
| Catalog position  | First in `GAMES`                                                                                 | Last; next to `rocas`                                                     | It is the only playable game and should be the first thing a visitor meets in `/games`, `/home` and `/hall-of-fame`.                                  |
| Home rail         | 7 cards, 7 desktop columns, tablet and mobile rows left incomplete                               | Keeping 6 and dropping `rocas`; 6 columns with an orphan row; `auto-fill` | Adding a game must not push `rocas` out of the rail. One row on desktop keeps the section's shape; changing the media queries was not needed.         |
| Cover             | New `cover-asteroides`                                                                           | Reusing `cover-rocas`                                                     | Two games with the same cover side by side in the rail would read as a duplicate.                                                                     |
| Copy and stats    | New copy describing the real mechanics; plausible mock `best` / `plays`                          | Reusing `rocas` copy; zeros                                               | The copy must match what the player finds. Zeros would look broken next to eight mocked games.                                                        |
| Code shape        | TypeScript port, one instance per mount, `destroy()` releases everything                         | Loading `game.js` from `public/` with `<Script>`                          | The original's globals and permanent `window` listeners leak on every client navigation and double up under StrictMode.                               |
| Engine location   | `lib/engines/`                                                                                   | `lib/games/`                                                              | A `lib/games/` folder would sit beside `lib/games.ts` and make `@/lib/games` ambiguous to read.                                                       |
| Engine selection  | A registry of `id → EngineFactory`, simulation as the fallback                                   | `if (game.id === "asteroides")` in `GamePlayer`                           | Tetris and Arkanoid are already waiting; each should register, not add a branch.                                                                      |
| Registry loading  | Static import of the engine into the player chunk                                                | `next/dynamic` / lazy `import()` per game                                 | One engine of a few hundred lines does not justify the async loading states. Revisit when several engines exist.                                      |
| HUD               | Both: the game's in-canvas HUD kept verbatim, plus the React HUD fed by `onStats`                | Removing `drawHUD` so the canvas draws only the world; canvas-only HUD    | The game keeps its own HUD and controls intact and only notifies React. The React HUD adds the platform's view without taking anything from the game. |
| Stats emission    | Only on change                                                                                   | Every frame                                                               | A `setState` per frame would re-render the player 60 times a second for nothing.                                                                      |
| Triple-shot timer | Both: the original `3x  4.2s` canvas line, plus a fifth React HUD stat visible only while active | Only one of the two; no indicator                                         | It follows the HUD decision: the canvas line is part of `drawHUD`, and the React HUD mirrors it.                                                      |
| Visual style      | White on black as in the original, no glow                                                       | Neon recolour with `shadowBlur` glow (first approved, then dropped)       | Amended after implementation at the user's request: the game keeps its own look, and per-frame canvas glow is the costliest part of rendering.        |
| Canvas background | Opaque black fill, as in the original                                                            | Transparent (`clearRect`)                                                 | It follows the original look; the CRT scanlines still sit on top.                                                                                     |
| Mechanics         | Verbatim constants and rules, triple shot included                                               | Rebalancing; UFOs; hyperspace                                             | The port is a translation. Gameplay changes would need their own spec and their own tuning.                                                           |
| Run start         | Start overlay, Space or click to begin, for every run                                            | Starting on mount like the original                                       | The player does not lose a life while the page loads, and the first key press lands on the game.                                                      |
| Game over         | The existing modal and `saveScore`; the canvas overlay removed                                   | Keeping the canvas `GAME OVER` with Space to restart                      | Saving a score already lives in the modal. A second restart path would bypass it.                                                                     |
| Restart           | Remount the canvas with a new `key`, back to the start overlay                                   | A `restart()` method on the engine                                        | A fresh instance cannot inherit stale state, and the contract stays four methods.                                                                     |
| Pause             | HUD button, `P` / `Escape`, auto-pause on hidden tab or window blur                              | The button only                                                           | Keyboard players need a key. Coming back to a dead ship after a tab switch is the worst case.                                                         |
| Shortcut scope    | Only for engine-backed games                                                                     | Adding `P` / `Escape` to the simulation too                               | The simulated players are SPEC 01 behaviour and this spec does not touch them.                                                                        |
| Touch controls    | Out of scope                                                                                     | On-screen buttons under the CRT                                           | They add layout, states and device testing. They are their own spec.                                                                                  |
| Scores            | `av_scores` through the unchanged `saveScore`                                                    | Supabase now                                                              | A scores table needs auth and RLS first, which would break this spec into several domains.                                                            |
| Sharpness         | Backing store scaled by `min(devicePixelRatio, 2)`, world fixed at 800×600                       | A plain 800×600 canvas scaled by CSS                                      | CSS upscaling blurs one-pixel vector lines on high-DPI screens. The cap at 2 bounds the fill cost.                                                    |

---

## 7 — Identified risks

- **Stacked loops and leaked listeners.** Without a strict `destroy()` in the effect cleanup, StrictMode's double mount and every client navigation start another `requestAnimationFrame` loop. The game would visibly speed up and Space would keep being swallowed on other pages. Two acceptance criteria target this directly.
- **Swallowing keys meant for the page.** `preventDefault()` on Space and the arrows is required so the page does not scroll, but applied too broadly it breaks typing in the modal's name input and scrolling on other pages. The target filter and the phase check are what keep it contained.
- **Double-handling the starting Space.** The same keydown that dismisses the start overlay could also reach the engine and fire a bullet. `start()` clearing the key maps before the first frame prevents it.
- **Stuck keys after a blur.** A key released while the window is unfocused never delivers `keyup`, so the ship would keep thrusting on return. `pause()` clearing the held-keys map is the fix, and auto-pause on blur makes sure it runs.
- **Re-render churn.** Emitting stats every frame, or passing inline callbacks that rebuild the engine on every render, would tank performance or reset the game mid-run. The callbacks go through refs and stats are emitted only on change.
- **The two HUDs disagreeing.** If `onStats` is emitted from a different point than the one `drawHUD` reads, the canvas and React numbers can differ for a frame or drift. Both must read the same per-instance state, and `onStats` must be emitted at the end of the same `update` that `draw` then renders.
- **The rail at 7 columns.** Between 1100 px and roughly 1300 px, seven cards get narrow and the 10 px pixel-font titles may wrap. The acceptance check at 1440 px does not cover that band, so eyeball it at 1150 px.

---

## What is **not** in this spec

- Any change to `rocas` or to the other seven simulated games.
- Tetris, Arkanoid or any second engine.
- Touch controls, sound, gamepad, key remapping.
- New mechanics or rebalancing.
- Supabase scores, a real leaderboard, or reading `av_scores` into any page.

Each one of those, if it lands, goes in its own spec.
