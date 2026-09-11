import Link from "next/link";

export default function NotFound() {
  return (
    <div
      className="fade-in"
      style={{ textAlign: "center", padding: "120px 32px 140px" }}
    >
      <div
        className="pixel flicker neon-magenta"
        style={{ fontSize: "clamp(24px, 6vw, 52px)", letterSpacing: "0.08em" }}
      >
        GAME OVER · 404
      </div>
      <div
        className="pixel"
        style={{
          marginTop: 20,
          fontSize: "clamp(9px, 1.6vw, 12px)",
          letterSpacing: "0.2em",
          color: "var(--yellow)",
        }}
      >
        CARTUCHO NO ENCONTRADO
      </div>
      <p
        style={{
          marginTop: 18,
          color: "var(--ink-dim)",
          fontSize: 13,
          letterSpacing: "0.04em",
        }}
      >
        Esta ranura del vault está vacía. Vuelve a la biblioteca y elige otro
        juego.
      </p>
      <Link className="btn lg" href="/games" style={{ marginTop: 32 }}>
        VOLVER AL VAULT
      </Link>
    </div>
  );
}
