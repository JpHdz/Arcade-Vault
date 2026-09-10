import type { ScoreRow } from "@/lib/games";

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

export function Leaderboard({ rows }: { rows: ScoreRow[] }) {
  return (
    <div className="leaderboard">
      <h3>MEJORES PUNTUACIONES</h3>
      {rows.map((r, i) => (
        <div key={r.name} className={"lb-row" + podiumClass(i)}>
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
      ))}
    </div>
  );
}
