import type { Metadata } from "next";
import { LibraryGrid } from "@/components/library-grid";
import { GAMES } from "@/lib/games";

// The root layout's title template does not reach this page: both belong to
// the same route segment, so the suffix is written out here.
export const metadata: Metadata = { title: "Biblioteca · Arcade Vault" };

export default function Home() {
  return (
    <div className="fade-in">
      <section className="av-hero">
        <h1 className="flicker">ARCADE VAULT</h1>
        <div className="sub">
          INSERTA UNA MONEDA PARA JUGAR <span className="blink">_</span>
        </div>
      </section>

      <LibraryGrid games={GAMES} />
    </div>
  );
}
