import type { EngineFactory, EngineStats } from "../types";
import {
  ASTEROID_PARTICLES_PER_SIZE,
  COLORS,
  H,
  LEVEL_BASE_ASTEROIDS,
  MAX_DPR,
  MAX_DT,
  POINTS,
  POWERUP_DROP_CHANCE,
  POWERUP_DURATION,
  POWERUP_GUARANTEED_KILLS,
  RESPAWN_DELAY,
  SAFE_DIST,
  SHIP_HIT_FACTOR,
  SHIP_PARTICLES,
  START_ASTEROIDS,
  START_LIVES,
  W,
  type Rgb,
} from "./constants";
import {
  Asteroid,
  Bullet,
  Particle,
  PowerUp,
  Ship,
  dist,
  rand,
  type KeyMap,
} from "./entities";

/**
 * - ready: the initial field is drawn once and frozen; nothing updates and no input is read.
 * - playing / dead: the original game states, unchanged.
 * - gameover: the loop stops and onGameOver fires once. There is no Space-to-restart.
 */
type Phase = "ready" | "playing" | "dead" | "gameover";

/** Keys the game consumes; only these get preventDefault(), so the page never scrolls. */
const CONTROL_CODES = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "Space"]);

/** Typing in a form field must never steer the ship or be swallowed. */
function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

/**
 * TypeScript port of references/started-games/02-asteroids/game.js. All state
 * lives inside this closure, so every mount gets a fresh instance and
 * destroy() releases the frame loop and both window listeners.
 */
export const createAsteroidsGame: EngineFactory = (canvas, callbacks) => {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Asteroids: 2D canvas context unavailable");
  const ctx = context;

  // High-DPI: the backing store is scaled by the device pixel ratio while the
  // world keeps its 800×600 coordinates.
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // ── Input ──────────────────────────────────────────────────────────────────

  const keys: KeyMap = {};
  const justPressed: KeyMap = {};

  function clearKeys() {
    for (const code of Object.keys(keys)) delete keys[code];
    for (const code of Object.keys(justPressed)) delete justPressed[code];
  }

  function pressed(code: string) {
    const val = justPressed[code];
    justPressed[code] = false;
    return val;
  }

  // ── Run state ──────────────────────────────────────────────────────────────

  let ship = new Ship();
  let bullets: Bullet[] = [];
  let asteroids: Asteroid[] = [];
  let particles: Particle[] = [];
  let powerUps: PowerUp[] = [];
  let score = 0;
  let lives = START_LIVES;
  let level = 1;
  let phase: Phase = "ready";
  let paused = false;
  let destroyed = false;
  let deadTimer = 0;
  let powerUpSpawned = false;
  let killsSinceSpawn = 0;

  let frame: number | null = null;
  let lastTime: number | null = null;
  let lastStats: EngineStats | null = null;
  let gameOverSent = false;

  function spawnAsteroids(count: number) {
    for (let i = 0; i < count; i++) {
      let x: number;
      let y: number;
      do {
        x = rand(0, W);
        y = rand(0, H);
      } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
      asteroids.push(new Asteroid(x, y, 3));
    }
  }

  function initGame() {
    ship = new Ship();
    bullets = [];
    asteroids = [];
    particles = [];
    powerUps = [];
    powerUpSpawned = false;
    killsSinceSpawn = 0;
    score = 0;
    lives = START_LIVES;
    level = 1;
    // The original starts in 'playing'; here the run waits in 'ready' until start().
    phase = "ready";
    spawnAsteroids(START_ASTEROIDS);
  }

  function nextLevel() {
    level++;
    bullets = [];
    particles = [];
    powerUps = [];
    powerUpSpawned = false;
    killsSinceSpawn = 0;
    ship.reset();
    spawnAsteroids(LEVEL_BASE_ASTEROIDS + level);
  }

  function explode(x: number, y: number, count: number, rgb: Rgb) {
    for (let i = 0; i < count; i++) particles.push(new Particle(x, y, rgb));
  }

  function killShip() {
    explode(ship.x, ship.y, SHIP_PARTICLES, COLORS.shipParticle);
    ship.dead = true;
    lives--;
    if (lives <= 0) {
      phase = "gameover";
    } else {
      phase = "dead";
      deadTimer = RESPAWN_DELAY;
    }
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  function update(dt: number) {
    if (phase === "dead") {
      deadTimer -= dt;
      particles.forEach((p) => p.update(dt));
      particles = particles.filter((p) => !p.dead);
      asteroids.forEach((a) => a.update(dt));
      if (deadTimer <= 0) {
        phase = "playing";
        ship.reset();
      }
      return;
    }
    if (phase !== "playing") return;

    // Shoot
    if (pressed("Space")) {
      bullets.push(...ship.tryShoot());
    }

    ship.update(dt, keys);
    bullets.forEach((b) => b.update(dt));
    asteroids.forEach((a) => a.update(dt));
    particles.forEach((p) => p.update(dt));
    powerUps.forEach((p) => p.update(dt));

    bullets = bullets.filter((b) => !b.dead);
    particles = particles.filter((p) => !p.dead);
    powerUps = powerUps.filter((p) => !p.dead);

    for (const p of powerUps) {
      if (!p.dead && dist(ship, p) < ship.radius + p.radius) {
        p.dead = true;
        ship.tripleShot = POWERUP_DURATION;
      }
    }

    // Bullet vs asteroid
    const newAsteroids: Asteroid[] = [];
    for (const b of bullets) {
      for (const a of asteroids) {
        if (!a.dead && !b.dead && dist(b, a) < a.radius) {
          b.dead = true;
          a.dead = true;
          score += POINTS[a.size];
          explode(
            a.x,
            a.y,
            a.size * ASTEROID_PARTICLES_PER_SIZE,
            COLORS.asteroidParticle,
          );
          newAsteroids.push(...a.split());
          if (!powerUpSpawned) {
            killsSinceSpawn++;
            const guaranteed = killsSinceSpawn >= POWERUP_GUARANTEED_KILLS;
            if (guaranteed || Math.random() < POWERUP_DROP_CHANCE) {
              powerUps.push(new PowerUp(a.x, a.y));
              powerUpSpawned = true;
            }
          }
        }
      }
    }
    asteroids = asteroids.filter((a) => !a.dead).concat(newAsteroids);
    bullets = bullets.filter((b) => !b.dead);

    // Ship vs asteroid
    if (ship.invincible <= 0) {
      for (const a of asteroids) {
        if (dist(ship, a) < ship.radius + a.radius * SHIP_HIT_FACTOR) {
          killShip();
          break;
        }
      }
    }

    // Level cleared
    if (phase === "playing" && asteroids.length === 0) nextLevel();
  }

  // ── Draw ───────────────────────────────────────────────────────────────────

  function drawLifeIcon(x: number, y: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 2);
    ctx.strokeStyle = COLORS.hud;
    ctx.lineWidth = 1.2;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(-6, -5);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-6, 5);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  /** The game's own HUD, kept verbatim and drawn in every phase. */
  function drawHUD() {
    ctx.fillStyle = COLORS.hud;
    ctx.font = "15px monospace";

    ctx.textAlign = "left";
    ctx.fillText(`SCORE  ${score}`, 14, 26);

    ctx.textAlign = "center";
    ctx.fillText(`NIVEL ${level}`, W / 2, 26);

    for (let i = 0; i < lives; i++) drawLifeIcon(W - 16 - i * 22, 18);

    if (ship.tripleShot > 0) {
      ctx.textAlign = "left";
      ctx.fillStyle = COLORS.hudPowerUp;
      ctx.fillText(`3x  ${ship.tripleShot.toFixed(1)}s`, 14, 46);
    }
  }

  function draw() {
    // Transparent background: the CRT vignette shows through underneath.
    ctx.clearRect(0, 0, W, H);

    particles.forEach((p) => p.draw(ctx));
    asteroids.forEach((a) => a.draw(ctx));
    powerUps.forEach((p) => p.draw(ctx));
    bullets.forEach((b) => b.draw(ctx));
    ship.draw(ctx);

    drawHUD();
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  /** Reads the same state drawHUD renders, and only notifies React on change. */
  function emitStats() {
    const powerUpSeconds =
      ship.tripleShot > 0 ? Number(ship.tripleShot.toFixed(1)) : 0;
    if (
      lastStats &&
      lastStats.score === score &&
      lastStats.lives === lives &&
      lastStats.level === level &&
      lastStats.powerUpSeconds === powerUpSeconds
    ) {
      return;
    }
    lastStats = { score, lives, level, powerUpSeconds };
    callbacks.onStats({ ...lastStats });
  }

  // ── Loop ───────────────────────────────────────────────────────────────────

  function cancelFrame() {
    if (frame !== null) {
      cancelAnimationFrame(frame);
      frame = null;
    }
  }

  function scheduleFrame() {
    if (frame === null && !destroyed) frame = requestAnimationFrame(loop);
  }

  function loop(ts: number) {
    frame = null;
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, MAX_DT);
    lastTime = ts;
    update(dt);
    emitStats();
    draw();
    if (phase === "gameover") {
      if (!gameOverSent) {
        gameOverSent = true;
        callbacks.onGameOver(score);
      }
      return;
    }
    scheduleFrame();
  }

  // ── Input listeners ────────────────────────────────────────────────────────

  function acceptsInput(e: KeyboardEvent) {
    if (isEditableTarget(e.target)) return false;
    return !paused && (phase === "playing" || phase === "dead");
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!acceptsInput(e)) return;
    if (!keys[e.code]) justPressed[e.code] = true;
    keys[e.code] = true;
    if (CONTROL_CODES.has(e.code)) e.preventDefault();
  }

  function onKeyUp(e: KeyboardEvent) {
    if (!acceptsInput(e)) return;
    keys[e.code] = false;
    // Also on keyup: a focused button would otherwise be activated by Space.
    if (CONTROL_CODES.has(e.code)) e.preventDefault();
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  // Frozen start frame: the field and the in-canvas HUD, nothing moving.
  initGame();
  emitStats();
  draw();

  return {
    start() {
      if (destroyed || phase !== "ready") return;
      // The Space that dismissed the start overlay must not fire a bullet.
      clearKeys();
      phase = "playing";
      lastTime = null;
      if (!paused) scheduleFrame();
    },
    pause() {
      paused = true;
      cancelFrame();
      // A key released while the window was unfocused never sends keyup.
      clearKeys();
    },
    resume() {
      if (destroyed || phase === "ready" || phase === "gameover") return;
      paused = false;
      lastTime = null;
      scheduleFrame();
    },
    destroy() {
      destroyed = true;
      cancelFrame();
      clearKeys();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    },
  };
};
