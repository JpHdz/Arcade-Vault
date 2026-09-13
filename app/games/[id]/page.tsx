import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Leaderboard } from "@/components/leaderboard";
import { GAMES, getGame } from "@/lib/games";
import { formatPlays } from "@/lib/scores/format";
import { getGameStats, getLeaderboard } from "@/lib/scores/queries";

// The catalogue is a fixed list, so every detail page is prerendered; an
// unknown id is answered by the `notFound()` below. Unlike /play/[id], this
// route keeps the default `dynamicParams`: its pages read the `scores` tag, and
// in Next 16.3.4 expiring that tag drops the cached page, which a route with
// `dynamicParams = false` then answers (and caches) as a 404.

// Saving a score expires the cached reads on demand; this hourly pass only
// lets a page rendered during a Supabase outage recover without a new save.
export const revalidate = 3600;

export function generateStaticParams() {
  return GAMES.map((game) => ({ id: game.id }));
}

export async function generateMetadata(
  props: PageProps<"/games/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  return { title: getGame(id)?.title };
}

export default async function GameDetailPage(props: PageProps<"/games/[id]">) {
  const { id } = await props.params;
  const game = getGame(id);
  if (!game) notFound();

  const [scores, stats] = await Promise.all([
    getLeaderboard(id, 10),
    getGameStats(),
  ]);
  // Undefined when the stats are unavailable: both values then show "—".
  const gameStats = stats?.[id];

  return (
    <div className="av-detail fade-in">
      <div>
        <div className="detail-cover">
          <div className={"cover-bg " + game.cover} />
        </div>
        <div style={{ marginTop: 20 }} className="detail-info">
          <div className="detail-tags">
            <span>{game.cat}</span>
            <span>1 JUGADOR</span>
            <span>TECLADO / TÁCTIL</span>
            <span>RETRO 1985</span>
          </div>
          <h2 className="neon-cyan">{game.title}</h2>
          <p>{game.long}</p>
          <div className="stat-strip">
            <div>
              <div className="l">Partidas</div>
              <div className="v">
                {gameStats ? formatPlays(gameStats.plays) : "—"}
              </div>
            </div>
            <div>
              <div className="l">Mejor global</div>
              <div
                className="v"
                style={{
                  color: "var(--magenta)",
                  textShadow: "0 0 6px rgba(255,0,110,0.5)",
                }}
              >
                {gameStats?.best != null
                  ? gameStats.best.toLocaleString("es-ES")
                  : "—"}
              </div>
            </div>
            <div>
              <div className="l">Dificultad</div>
              <div
                className="v"
                style={{
                  color: "var(--yellow)",
                  textShadow: "0 0 6px rgba(245,255,0,0.5)",
                }}
              >
                ★ ★ ★ ☆ ☆
              </div>
            </div>
          </div>
          <div className="detail-actions">
            <Link className="btn xl pulse" href={`/play/${game.id}`}>
              ▶ JUGAR AHORA
            </Link>
            <Link className="btn ghost lg" href="/games">
              VOLVER AL VAULT
            </Link>
          </div>
        </div>
      </div>

      <aside>
        <Leaderboard rows={scores} />
      </aside>
    </div>
  );
}
