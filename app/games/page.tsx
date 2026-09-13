import type { Metadata } from "next";
import { LibraryGrid } from "@/components/library-grid";
import { GAMES } from "@/lib/games";
import { getGameStats } from "@/lib/scores/queries";

// The root layout's title template does not reach this page: both belong to
// the same route segment, so the suffix is written out here.
export const metadata: Metadata = { title: "Biblioteca · Arcade Vault" };

// Saving a score expires the cached reads on demand; this hourly pass only
// lets a page rendered during a Supabase outage recover without a new save.
export const revalidate = 3600;

export default async function Home() {
  const stats = await getGameStats();

  return (
    <div className="fade-in">
      <section className="av-hero">
        <h1 className="flicker">ARCADE VAULT</h1>
        <div className="sub">
          INSERTA UNA MONEDA PARA JUGAR <span className="blink">_</span>
        </div>
      </section>

      <LibraryGrid games={GAMES} stats={stats} />
    </div>
  );
}
