import type { Metadata } from "next";
import Link from "next/link";
import { HallOfFame } from "@/components/hall-of-fame";

export const metadata: Metadata = { title: "Salón de la Fama" };

export default function HallOfFamePage() {
  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>

      <HallOfFame />

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link className="btn lg" href="/games">
          VOLVER A LA BIBLIOTECA
        </Link>
      </div>
    </div>
  );
}
