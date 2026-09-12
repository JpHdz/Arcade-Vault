import { createAsteroidsGame } from "./asteroids/game";
import type { EngineFactory } from "./types";

/** Catalog id → engine factory. Only games with a real canvas port appear here. */
const ENGINES: Record<string, EngineFactory> = {
  asteroides: createAsteroidsGame,
};

/** `undefined` means the player falls back to the SPEC 01 simulation. */
export function getEngine(gameId: string): EngineFactory | undefined {
  // Own keys only, so an id such as "constructor" never resolves to a prototype member.
  return Object.prototype.hasOwnProperty.call(ENGINES, gameId)
    ? ENGINES[gameId]
    : undefined;
}
