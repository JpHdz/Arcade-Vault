"use client";

import { useEffect, useRef } from "react";
import type {
  EngineCallbacks,
  EngineFactory,
  GameEngine,
} from "@/lib/engines/types";

interface EngineCanvasProps extends EngineCallbacks {
  factory: EngineFactory;
  /** False keeps the engine on its frozen start frame. */
  started: boolean;
  paused: boolean;
}

/**
 * Hosts one engine instance on a canvas filling `.crt-screen`. The engine is
 * built in a single effect and destroyed in its cleanup, so StrictMode's
 * double mount and client navigations never stack loops or listeners. To get
 * a fresh run, remount this component with a new `key`.
 */
export function EngineCanvas({
  factory,
  started,
  paused,
  onStats,
  onGameOver,
}: EngineCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  // Callbacks go through a ref so a parent re-render never rebuilds the engine.
  const callbacksRef = useRef<EngineCallbacks>({ onStats, onGameOver });

  useEffect(() => {
    callbacksRef.current = { onStats, onGameOver };
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = factory(canvas, {
      onStats: (stats) => callbacksRef.current.onStats(stats),
      onGameOver: (finalScore) => callbacksRef.current.onGameOver(finalScore),
    });
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [factory]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !started) return;
    engine.start();
    if (paused) engine.pause();
    else engine.resume();
  }, [factory, started, paused]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        display: "block",
      }}
    />
  );
}
