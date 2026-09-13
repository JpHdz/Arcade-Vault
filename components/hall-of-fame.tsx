"use client";

import { useEffect, useState } from "react";
import { BoardState, podiumClass } from "@/components/leaderboard";
import { GAMES } from "@/lib/games";
import { getPlayerBest, type PlayerBest } from "@/lib/scores/player-best";
import { sanitizePlayerName } from "@/lib/scores/player-name";
import type { ScoreRow } from "@/lib/scores/types";
import { useSession } from "@/lib/session";

/** Podium order on screen: silver, gold, bronze. */
const PODIUM = [
  { index: 1, tier: "silver" },
  { index: 0, tier: "gold" },
  { index: 2, tier: "bronze" },
] as const;

/** The viewer's best run, remembered with the tab and name it was fetched for. */
interface PlayerBestResult {
  key: string;
  best: PlayerBest | null;
}

/**
 * `rowsByGame` holds each game's top 12: `null` = unavailable, `[]` = no
 * scores yet.
 */
export function HallOfFame({
  rowsByGame,
}: {
  rowsByGame: Record<string, ScoreRow[] | null>;
}) {
  const [tab, setTab] = useState(GAMES[0].id);
  const { user } = useSession();
  const [playerBest, setPlayerBest] = useState<PlayerBestResult | null>(null);

  const rows = rowsByGame[tab] ?? null;
  const game = GAMES.find((g) => g.id === tab);
  const playerName = user ? sanitizePlayerName(user.name) : "";
  const bestKey = `${tab}:${playerName}`;

  useEffect(() => {
    if (!playerName) return;
    let cancelled = false;
    getPlayerBest(tab, playerName).then((best) => {
      if (!cancelled) setPlayerBest({ key: `${tab}:${playerName}`, best });
    });
    return () => {
      cancelled = true;
    };
  }, [tab, playerName]);

  // Hidden while loading (the stored result belongs to another tab or name),
  // when signed out, when the sanitized name is empty, and when there is none.
  const you =
    playerName && playerBest?.key === bestKey ? playerBest.best : null;

  return (
    <>
      <div className="hall-tabs">
        {GAMES.map((g) => (
          <button
            key={g.id}
            className={"chip" + (tab === g.id ? " active" : "")}
            onClick={() => setTab(g.id)}
          >
            {g.title}
          </button>
        ))}
      </div>

      <div className="podium">
        {PODIUM.map(({ index, tier }) => {
          const row = rows?.[index];
          const gold = tier === "gold";
          return (
            <div
              key={tier}
              className={`podium-slot ${tier}` + (row ? "" : " vacant")}
            >
              {gold && (
                <div
                  className="pixel"
                  style={{
                    fontSize: 9,
                    color: "var(--gold)",
                    letterSpacing: "0.18em",
                  }}
                >
                  CAMPEÓN
                </div>
              )}
              <div
                className="rank-num"
                style={gold ? { fontSize: 36, marginTop: 4 } : undefined}
              >
                {String(index + 1).padStart(2, "0")}
              </div>
              <div className="name">{row ? row.name : "—"}</div>
              <div
                className="score"
                style={gold ? { fontSize: 20 } : undefined}
              >
                {row ? row.score.toLocaleString("es-ES") : "—"}
              </div>
              <div className="date">{row ? row.date : "—"}</div>
            </div>
          );
        })}
      </div>

      <div className="hall-table">
        <div className="th">
          <div>RANGO</div>
          <div>JUGADOR</div>
          <div>PUNTUACIÓN</div>
          <div>FECHA</div>
        </div>
        {rows === null || rows.length === 0 ? (
          <BoardState unavailable={rows === null} />
        ) : (
          rows.map((r, i) => (
            <div
              // The tab is part of the key so each tab replays the entrance.
              key={`${tab}-${r.rank}`}
              className={"tr" + podiumClass(i)}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
              <div className="pl">{r.name}</div>
              <div className="sc">{r.score.toLocaleString("es-ES")}</div>
              <div className="dt">{r.date}</div>
            </div>
          ))
        )}
        {you && game && (
          <>
            <div className="tr you-label">▸ TU MEJOR MARCA EN {game.title}</div>
            <div
              className="tr you"
              style={{ animationDelay: `${(rows?.length ?? 0) * 50 + 50}ms` }}
            >
              <div className="rk" style={{ color: "var(--yellow)" }}>
                #{String(you.rank).padStart(2, "0")}
              </div>
              <div className="pl" style={{ color: "var(--yellow)" }}>
                {playerName}
              </div>
              <div
                className="sc"
                style={{
                  color: "var(--yellow)",
                  textShadow: "0 0 6px rgba(245,255,0,0.5)",
                }}
              >
                {you.score.toLocaleString("es-ES")}
              </div>
              <div className="dt">{you.date}</div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
