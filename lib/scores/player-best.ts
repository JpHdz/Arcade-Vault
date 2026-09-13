import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { formatScoreDate } from "./format";

export interface PlayerBest {
  rank: number;
  score: number;
  date: string;
}

/**
 * The name's best run in the game and its rank among all of that game's runs.
 * Runs in the browser with the publishable key: it is per viewer, so it cannot
 * live in the cached page, and the public `select` grant is all it needs.
 *
 * Rank = 1 + the runs with a higher score, or with the same score and an
 * earlier `created_at` (the leaderboard's tie rule).
 *
 * `null` when the name has no run in the game, when Supabase is not
 * configured, or when a query fails.
 */
export async function getPlayerBest(
  gameId: string,
  name: string,
): Promise<PlayerBest | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;

  try {
    const { data: best, error } = await supabase
      .from("scores")
      .select("score, created_at")
      .eq("game_id", gameId)
      .eq("player_name", name)
      .order("score", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!best) return null;

    // The timestamp holds "." and ":", so it is quoted inside the filter.
    const { count, error: countError } = await supabase
      .from("scores")
      .select("id", { count: "exact", head: true })
      .eq("game_id", gameId)
      .or(
        `score.gt.${best.score},and(score.eq.${best.score},created_at.lt."${best.created_at}")`,
      );
    if (countError) throw countError;

    return {
      rank: (count ?? 0) + 1,
      score: best.score,
      date: formatScoreDate(best.created_at),
    };
  } catch (error) {
    console.error("[scores] getPlayerBest failed:", error);
    return null;
  }
}
