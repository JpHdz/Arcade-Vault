import type { ScoreRow } from "@/lib/scores/types";

/** Highlight class for the three top places, empty for the rest. */
export function podiumClass(index: number) {
  return index === 0
    ? " top1"
    : index === 1
      ? " top2"
      : index === 2
        ? " top3"
        : "";
}

/**
 * The two states a board shows instead of rows. An empty board is an
 * invitation (attract mode, with a blinking cursor); an unavailable one is
 * powered off: dim and still, so it never reads as "no scores yet".
 */
export function BoardState({ unavailable }: { unavailable: boolean }) {
  if (unavailable) {
    return (
      <div className="lb-empty is-down">
        <p className="lb-empty-title">RANKING NO DISPONIBLE</p>
      </div>
    );
  }
  return (
    <div className="lb-empty">
      <p className="lb-empty-title">SIN PUNTUACIONES AÚN</p>
      <p className="lb-empty-cta">SÉ EL PRIMERO EN ENTRAR AL RANKING</p>
    </div>
  );
}

/** `null` = the ranking is unavailable; `[]` = no scores yet. */
export function Leaderboard({ rows }: { rows: ScoreRow[] | null }) {
  return (
    <div className="leaderboard">
      <h3>MEJORES PUNTUACIONES</h3>
      {rows === null || rows.length === 0 ? (
        <BoardState unavailable={rows === null} />
      ) : (
        // Keyed by rank: every saved run is ranked, so names repeat.
        rows.map((r, i) => (
          <div key={r.rank} className={"lb-row" + podiumClass(i)}>
            <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
            <div className="pl">
              {r.name}
              <div
                style={{
                  fontSize: 10,
                  color: "var(--ink-faint)",
                  letterSpacing: "0.1em",
                }}
              >
                {r.date}
              </div>
            </div>
            <div className="sc">{r.score.toLocaleString("es-ES")}</div>
          </div>
        ))
      )}
    </div>
  );
}
