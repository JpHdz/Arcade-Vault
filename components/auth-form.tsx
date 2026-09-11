"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useSession } from "@/lib/session";

export function AuthForm() {
  const router = useRouter();
  const { signIn, signOut } = useSession();
  const [tab, setTab] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [pass, setPass] = useState("");
  const [email, setEmail] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    signIn({ name: (name || "PLAYER1").toUpperCase().slice(0, 10) });
    router.push("/games");
  };

  const playAsGuest = () => {
    signOut();
    router.push("/games");
  };

  return (
    <div className="auth-card">
      <div className="auth-header">
        <div className="mark" />
        <h2 className="neon-cyan">ARCADE VAULT</h2>
        <div
          className="mono"
          style={{
            fontSize: 11,
            color: "var(--ink-faint)",
            letterSpacing: "0.16em",
            marginTop: 6,
          }}
        >
          ACCESO AL SISTEMA · v2.6
        </div>
      </div>

      <div className="auth-tabs">
        <button className={tab === "in" ? "on" : ""} onClick={() => setTab("in")}>
          INICIAR SESIÓN
        </button>
        <button className={tab === "up" ? "on" : ""} onClick={() => setTab("up")}>
          CREAR CUENTA
        </button>
      </div>

      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="av-user">Usuario</label>
          <input
            id="av-user"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="px_kai"
          />
        </div>
        {tab === "up" && (
          <div className="field slide-in">
            <label htmlFor="av-email">Correo electrónico</label>
            <input
              id="av-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jugador@vault.gg"
            />
          </div>
        )}
        <div className="field">
          <label htmlFor="av-pass">Contraseña</label>
          <input
            id="av-pass"
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        <button
          className="btn lg"
          type="submit"
          style={{ width: "100%", marginTop: 8 }}
        >
          {tab === "in" ? "ENTRAR AL VAULT" : "CREAR Y JUGAR"}
        </button>
      </form>

      <button
        className="btn ghost"
        style={{ width: "100%", marginTop: 10 }}
        onClick={playAsGuest}
      >
        JUGAR COMO INVITADO
      </button>

      <div className="auth-divider">O CONTINÚA CON</div>
      <div className="social">
        {/* Decorative in this MVP: there is no real OAuth behind them. */}
        <button className="btn ghost" type="button">
          ◆ GOOGLE
        </button>
        <button className="btn ghost" type="button">
          ▣ GITHUB
        </button>
      </div>

      <div
        style={{
          marginTop: 18,
          textAlign: "center",
          fontSize: 11,
          color: "var(--ink-faint)",
          letterSpacing: "0.1em",
        }}
      >
        AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
      </div>
    </div>
  );
}
