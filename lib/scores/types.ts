/** One leaderboard row, ready to render. */
export interface ScoreRow {
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
