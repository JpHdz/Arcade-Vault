/**
 * Player-name rules, shared by the game-over modal and the `submitScore`
 * Server Action. Mirrors the `player_name` check constraint in the database.
 */
export const PLAYER_NAME_PATTERN = /^[A-Z0-9_]{1,10}$/;

const MAX_LENGTH = 10;

/** Uppercases, drops every character outside A–Z 0–9 _, cuts to 10. */
export function sanitizePlayerName(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "")
    .slice(0, MAX_LENGTH);
}
