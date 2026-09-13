import "server-only";

import { unstable_cache } from "next/cache";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabasePublicClient } from "@/lib/supabase/public";

import { formatScoreDate } from "./format";
import type { GameStatsMap, RecentScore, ScoreRow } from "./types";

/**
 * Cached score reads for Server Components.
 *
 * Every read is an `unstable_cache` entry tagged `SCORES_TAG`; the
 * `submitScore` Server Action expires the tag right after inserting, so the
 * next request blocks on fresh data. Inside a cached function a Supabase error
 * throws, so a failure is never stored in the cache. The exported wrappers
 * catch it, log it and return `null`, which the pages render as "unavailable".
 * When Supabase is not configured the wrappers return `null` without querying,
 * so `next build` works without credentials.
 */

export const SCORES_TAG = "scores";

function requirePublicClient() {
  const supabase = createSupabasePublicClient();
  if (!supabase) throw new Error("Supabase is not configured");
  return supabase;
}

const cachedLeaderboard = unstable_cache(
  async (gameId: string, limit: number): Promise<ScoreRow[]> => {
    const { data, error } = await requirePublicClient()
      .from("scores")
      .select("player_name, score, created_at")
      .eq("game_id", gameId)
      // Leaderboard order: score desc, then the earlier run first.
      .order("score", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(limit);
    if (error) throw error;

    return data.map((row, i) => ({
      rank: i + 1,
      name: row.player_name,
      score: row.score,
      date: formatScoreDate(row.created_at),
    }));
  },
  ["scores:leaderboard"],
  { tags: [SCORES_TAG] },
);

const cachedGameStats = unstable_cache(
  async (): Promise<GameStatsMap> => {
    const { data, error } = await requirePublicClient()
      .from("game_stats")
      .select("game_id, best, plays");
    if (error) throw error;

    const stats: GameStatsMap = {};
    for (const row of data) {
      // Views type every column as nullable; `game_id` and `plays` never are.
      if (!row.game_id) continue;
      stats[row.game_id] = { best: row.best, plays: row.plays ?? 0 };
    }
    return stats;
  },
  ["scores:game-stats"],
  { tags: [SCORES_TAG] },
);

const cachedRecentScores = unstable_cache(
  async (limit: number): Promise<RecentScore[]> => {
    const { data, error } = await requirePublicClient()
      .from("scores")
      .select("player_name, game_id, score, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;

    return data.map((row) => ({
      name: row.player_name,
      gameId: row.game_id,
      score: row.score,
      at: row.created_at,
    }));
  },
  ["scores:recent"],
  { tags: [SCORES_TAG] },
);

async function unavailableOnError<T>(
  label: string,
  read: () => Promise<T>,
): Promise<T | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    return await read();
  } catch (error) {
    console.error(`[scores] ${label} failed:`, error);
    return null;
  }
}

/** Top `limit` runs of one game. `null` = unavailable (unconfigured or query failed). */
export function getLeaderboard(
  gameId: string,
  limit: number,
): Promise<ScoreRow[] | null> {
  return unavailableOnError("getLeaderboard", () =>
    cachedLeaderboard(gameId, limit),
  );
}

/** Every game's stats from `game_stats`. `null` = unavailable. */
export function getGameStats(): Promise<GameStatsMap | null> {
  return unavailableOnError("getGameStats", () => cachedGameStats());
}

/** Latest `limit` saved runs across all games. `null` = unavailable. */
export function getRecentScores(limit: number): Promise<RecentScore[] | null> {
  return unavailableOnError("getRecentScores", () => cachedRecentScores(limit));
}
