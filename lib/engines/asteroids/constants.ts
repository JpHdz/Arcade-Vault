// Every number below is ported verbatim from
// references/started-games/02-asteroids/game.js. Changing one is a balance
// change and needs its own spec.

/** Game world size. The canvas backing store is scaled by the device pixel ratio on top. */
export const W = 800;
export const H = 600;

// Power-up
export const POWERUP_DROP_CHANCE = 0.15;
export const POWERUP_DURATION = 5;
export const POWERUP_TTL = 12;
export const POWERUP_RADIUS = 12;
export const POWERUP_MIN_SPEED = 20;
export const POWERUP_MAX_SPEED = 40;
/** A power-up is guaranteed after this many kills without one spawning. */
export const POWERUP_GUARANTEED_KILLS = 5;
export const TRIPLE_SPREAD = 0.18;

// Bullet
export const BULLET_SPEED = 520;
export const BULLET_TTL = 1.1;
export const BULLET_RADIUS = 2;

// Asteroid, indexed by size 1 (small), 2 (medium), 3 (large)
export const RADII = [0, 16, 30, 50] as const;
/** Base speed per size. */
export const SPEEDS = [0, 85, 55, 32] as const;
/** Points per size. */
export const POINTS = [0, 100, 50, 20] as const;
export const ASTEROID_SPEED_JITTER = 15;
export const ASTEROID_MAX_ROT_SPEED = 1.2;
export const ASTEROID_MIN_VERTS = 8;
export const ASTEROID_MAX_VERTS = 13;
/** Initial asteroids keep at least this far from the centre, where the ship spawns. */
export const SAFE_DIST = 130;
/** Fraction of the asteroid radius used for ship collisions. */
export const SHIP_HIT_FACTOR = 0.82;

// Ship
export const SHIP_RADIUS = 12;
/** rad/s */
export const SHIP_ROT = 3.5;
/** px/s² */
export const SHIP_THRUST = 260;
export const SHIP_DRAG = 0.987;
/** Seconds of blinking invincibility after every (re)spawn. */
export const SHIP_INVINCIBLE = 3;
export const SHOOT_COOLDOWN = 0.2;
/** Distance from the ship centre to where bullets appear. */
export const SHIP_NOSE = 21;

// Particles
export const PARTICLE_MIN_SPEED = 30;
export const PARTICLE_MAX_SPEED = 130;
export const PARTICLE_MIN_LIFE = 0.4;
export const PARTICLE_MAX_LIFE = 1.1;
export const ASTEROID_PARTICLES_PER_SIZE = 5;
export const SHIP_PARTICLES = 14;

// Run
export const START_LIVES = 3;
export const START_ASTEROIDS = 4;
/** Level n spawns LEVEL_BASE_ASTEROIDS + n large asteroids. */
export const LEVEL_BASE_ASTEROIDS = 3;
/** Seconds between losing a life and the ship respawning. */
export const RESPAWN_DELAY = 2;
/** Largest frame step, in seconds, so a long frame never teleports anything. */
export const MAX_DT = 0.05;
/** Cap on the device pixel ratio, which bounds the fill cost on dense screens. */
export const MAX_DPR = 2;

export type Rgb = readonly [number, number, number];

/**
 * Canvas cannot read CSS variables, so these hex values mirror the palette in
 * app/globals.css (--cyan, --magenta, --yellow, --green). If the palette
 * changes there, update it here too.
 *
 * The neon recolour covers the world only; the in-canvas HUD keeps the
 * original white text, white life icons and #0ff triple-shot line.
 */
export const COLORS = {
  ship: "#00f5ff",
  thrust: "rgba(255, 130, 0, 0.85)",
  asteroid: "#ff006e",
  bullet: "#f5ff00",
  powerUp: "#00ff88",
  asteroidParticle: [255, 0, 110] as Rgb,
  shipParticle: [0, 245, 255] as Rgb,
  hud: "#fff",
  hudPowerUp: "#0ff",
} as const;

/** shadowBlur for the ship, asteroids and power-up. Never on particles or bullets. */
export const GLOW = 8;
