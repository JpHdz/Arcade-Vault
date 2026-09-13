"use server";

import { revalidateTag } from "next/cache";
import { getGame } from "@/lib/games";
import { PLAYER_NAME_PATTERN } from "@/lib/scores/player-name";
import { SCORES_TAG } from "@/lib/scores/queries";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type SubmitScoreResult =
  { status: "saved" } | { status: "error"; message: string };

/** Upper bound of the `integer` column the score is stored in. */
const MAX_SCORE = 2_147_483_647;

/** The only sentence a failed insert ever sends to the browser. */
const SAVE_FAILED = "NO SE PUDO GUARDAR. INTÉNTALO DE NUEVO.";

/**
 * Saves one finished run to the leaderboard.
 *
 * Reachable by direct POST, not just through the game-over modal, so it trusts
 * nothing the client sent: the name is validated, never rewritten. The insert
 * uses the secret key because RLS grants the public `select` only. Without auth
 * anyone can still post any score under any name; see the risks in SPEC 06.
 */
export async function submitScore(input: {
  gameId: string;
  name: string;
  score: number;
}): Promise<SubmitScoreResult> {
  const { gameId, name, score } = (input ?? {}) as Partial<typeof input>;

  if (typeof gameId !== "string" || !getGame(gameId)) {
    return { status: "error", message: "JUEGO DESCONOCIDO" };
  }
  if (typeof name !== "string" || !PLAYER_NAME_PATTERN.test(name)) {
    return { status: "error", message: "NOMBRE NO VÁLIDO: SOLO A–Z, 0–9 Y _" };
  }
  if (
    typeof score !== "number" ||
    !Number.isInteger(score) ||
    score < 0 ||
    score > MAX_SCORE
  ) {
    return { status: "error", message: "PUNTUACIÓN NO VÁLIDA" };
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    console.error(
      "[scores] NEXT_PUBLIC_SUPABASE_URL and the secret key must both be set to save scores.",
    );
    return { status: "error", message: "GUARDADO NO DISPONIBLE" };
  }

  try {
    // The SDK reports database failures in `error` instead of throwing, so
    // both paths have to be handled.
    const { error } = await supabase
      .from("scores")
      .insert({ game_id: gameId, player_name: name, score });
    if (error) {
      console.error(
        `[scores] Insert rejected: ${error.code ?? "no code"}: ${error.message}`,
      );
      return { status: "error", message: SAVE_FAILED };
    }
  } catch (cause) {
    console.error("[scores] Insert request failed:", cause);
    return { status: "error", message: SAVE_FAILED };
  }

  // `{ expire: 0 }`: the next read of any score query blocks on fresh data.
  revalidateTag(SCORES_TAG, { expire: 0 });
  return { status: "saved" };
}
