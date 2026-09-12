"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { EngineCanvas } from "@/components/engine-canvas";
import { getEngine } from "@/lib/engines/registry";
import type { EngineStats } from "@/lib/engines/types";
import type { Game } from "@/lib/games";
import { useSession } from "@/lib/session";

/** Simulated score tick, in milliseconds. */
const TICK_MS = 220;
/** Points needed to reach the next level. */
const POINTS_PER_LEVEL = 2500;

/** Shortcuts must never fire while the player is typing in a form field. */
function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

export function GamePlayer({ game }: { game: Game }) {
  const router = useRouter();
  const { user, saveScore } = useSession();
  // A registered engine means a real canvas game; otherwise the SPEC 01 simulation runs.
  const factory = getEngine(game.id);

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [saved, setSaved] = useState(false);
  // Null means "follow the session"; typing in the modal pins a name instead.
  const [typedName, setTypedName] = useState<string | null>(null);

  // Engine-backed games only.
  const [started, setStarted] = useState(false);
  const [engineLevel, setEngineLevel] = useState(1);
  const [powerUpSeconds, setPowerUpSeconds] = useState(0);
  // Bumping it remounts the canvas, which builds a fresh engine instance.
  const [runKey, setRunKey] = useState(0);

  const name = typedName ?? user?.name ?? "INVITADO";
  const level = factory
    ? engineLevel
    : Math.floor(score / POINTS_PER_LEVEL) + 1;

  // There is no real game yet, so the score climbs on its own. The interval is
  // torn down whenever the run is paused or finished, and on unmount.
  useEffect(() => {
    if (factory || over || paused) return;
    const t = setInterval(
      () => setScore((s) => s + Math.floor(10 + Math.random() * 90)),
      TICK_MS,
    );
    return () => clearInterval(t);
  }, [factory, over, paused]);

  // Start overlay: Space begins the run.
  useEffect(() => {
    if (!factory || started || over) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || isEditableTarget(e.target)) return;
      e.preventDefault();
      setStarted(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [factory, started, over]);

  // During a run: P / Escape toggle pause, and a hidden tab or a blurred
  // window pauses it so the player never comes back to a dead ship.
  useEffect(() => {
    if (!factory || !started || over) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || isEditableTarget(e.target)) return;
      if (e.key === "Escape" || e.key.toLowerCase() === "p") {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") setPaused(true);
    };
    const onBlur = () => setPaused(true);
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
    };
  }, [factory, started, over]);

  const handleStats = (stats: EngineStats) => {
    setScore(stats.score);
    setLives(stats.lives);
    setEngineLevel(stats.level);
    setPowerUpSeconds(stats.powerUpSeconds);
  };

  const handleGameOver = (finalScore: number) => {
    setScore(finalScore);
    setOver(true);
  };

  const restart = () => {
    setScore(0);
    setLives(3);
    setPaused(false);
    setOver(false);
    setSaved(false);
    setStarted(false);
    setEngineLevel(1);
    setPowerUpSeconds(0);
    setRunKey((k) => k + 1);
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {name}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{score.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">{"♥ ".repeat(lives).trim() || "—"}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, "0")}</div>
          </div>
          {factory && powerUpSeconds > 0 && (
            <div className="hud-stat power">
              <div className="l">Disparo 3x</div>
              <div className="v">{powerUpSeconds.toFixed(1)}s</div>
            </div>
          )}
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={() => setPaused((p) => !p)}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button className="btn magenta" onClick={() => setOver(true)}>
            FIN
          </button>
          <button
            className="btn ghost"
            onClick={() => router.push(`/games/${game.id}`)}
          >
            SALIR
          </button>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          {factory ? (
            <EngineCanvas
              key={runKey}
              factory={factory}
              started={started}
              paused={paused || over}
              onStats={handleStats}
              onGameOver={handleGameOver}
            />
          ) : (
            <div className="game-arena">
              <div className="grid-floor" />
              <div className="enemy e1" />
              <div className="enemy e2" />
              <div className="enemy e3" />
              <div className="player-ship" />
            </div>
          )}
          {factory && !started && (
            <button
              type="button"
              className="crt-content"
              onClick={() => setStarted(true)}
              style={{
                background: "rgba(0,0,0,0.55)",
                border: 0,
                cursor: "pointer",
                zIndex: 4,
              }}
            >
              <div>
                <div className="pixel neon-cyan" style={{ fontSize: 26 }}>
                  {game.title}
                </div>
                <div
                  className="pixel neon-yellow"
                  style={{ fontSize: 12, marginTop: 22 }}
                >
                  PULSA ESPACIO PARA EMPEZAR
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    marginTop: 16,
                    letterSpacing: "0.16em",
                  }}
                >
                  ← → ROTAR · ↑ PROPULSAR · ESPACIO DISPARAR · P PAUSA
                </div>
              </div>
            </button>
          )}
          {paused && (
            <div
              className="crt-content"
              style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}
            >
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  EN PAUSA
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    marginTop: 10,
                    letterSpacing: "0.16em",
                  }}
                >
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{score.toLocaleString("es-ES")}</div>
            {!saved ? (
              <div className="input-row">
                <input
                  value={name}
                  onChange={(e) =>
                    setTypedName(e.target.value.toUpperCase().slice(0, 10))
                  }
                  placeholder="TUS INICIALES"
                  aria-label="Nombre para la tabla de puntuaciones"
                />
                <button
                  className="btn yellow"
                  onClick={() => {
                    saveScore({ game: game.id, score, name });
                    setSaved(true);
                  }}
                >
                  GUARDAR PUNTUACIÓN
                </button>
              </div>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <button
                className="btn magenta"
                onClick={() => router.push("/games")}
              >
                VOLVER AL VAULT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
