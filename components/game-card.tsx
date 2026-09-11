"use client";

import Link from "next/link";
import { useRef, type MouseEvent } from "react";
import type { Game } from "@/lib/games";

export function GameCard({ game }: { game: Game }) {
  const tiltRef = useRef<HTMLAnchorElement>(null);

  const onMove = (e: MouseEvent<HTMLAnchorElement>) => {
    const el = tiltRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `translateY(-6px) rotateX(${-py * 6}deg) rotateY(${px * 8}deg)`;
  };

  const onLeave = () => {
    const el = tiltRef.current;
    if (el) el.style.transform = "";
  };

  const accent =
    game.color === "magenta" ? "magenta" : game.color === "yellow" ? "yellow" : "";

  return (
    <Link
      ref={tiltRef}
      className="card"
      href={`/games/${game.id}`}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      <div className="cover">
        <div className={"cover-bg " + game.cover} />
        <div className="label">{game.cat}</div>
      </div>
      <div className="meta">
        <div className="title">{game.title}</div>
        <div className="desc">{game.short}</div>
        <div className="row">
          <div className="score-badge">
            <span>MEJOR PUNTUACIÓN</span>
            <b>{game.best.toLocaleString("es-ES")}</b>
          </div>
          {/* The whole card is the link, so this stays a plain span to avoid
              nesting one interactive element inside another. */}
          <span className={"btn " + accent}>JUGAR</span>
        </div>
      </div>
    </Link>
  );
}
