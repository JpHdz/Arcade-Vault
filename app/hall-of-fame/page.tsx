import type { Metadata } from "next";
import Link from "next/link";
import { HallOfFame } from "@/components/hall-of-fame";
import { GAMES } from "@/lib/games";
import { getLeaderboard } from "@/lib/scores/queries";

export const metadata: Metadata = { title: "Salón de la Fama" };

// Saving a score expires the cached reads on demand; this hourly pass only
// lets a page rendered during a Supabase outage recover without a new save.
export const revalidate = 3600;

export default async function HallOfFamePage() {
  const boards = await Promise.all(GAMES.map((g) => getLeaderboard(g.id, 12)));
  const rowsByGame = Object.fromEntries(GAMES.map((g, i) => [g.id, boards[i]]));

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>

      <HallOfFame rowsByGame={rowsByGame} />

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link className="btn lg" href="/games">
          VOLVER A LA BIBLIOTECA
        </Link>
      </div>
    </div>
  );
}
