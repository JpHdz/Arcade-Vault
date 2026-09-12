/**
 * Contract every real (canvas) game follows so the player can host it. A game
 * registers an `EngineFactory` in `lib/engines/registry.ts`; games without one
 * keep running the SPEC 01 simulation.
 */

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
