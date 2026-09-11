"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useSession } from "@/lib/session";

/** The library tab stays lit while browsing or playing a game. */
function isLibrary(pathname: string) {
  return pathname.startsWith("/games") || pathname.startsWith("/play");
}

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { user, signOut } = useSession();

  const close = () => setOpen(false);
  const cls = (active: boolean) => (active ? "active" : "");

  return (
    <>
      <nav className="av-nav">
        <Link className="logo" href="/home" onClick={close}>
          <div className="logo-mark" />
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </Link>
        <div className="links">
          <Link className={cls(pathname === "/home")} href="/home">
            Inicio
          </Link>
          <Link className={cls(isLibrary(pathname))} href="/games">
            Biblioteca
          </Link>
          <Link
            className={cls(pathname === "/hall-of-fame")}
            href="/hall-of-fame"
          >
            Salón de la Fama
          </Link>
          <Link className={cls(pathname === "/about")} href="/about">
            Acerca de
          </Link>
        </div>
        <div className="spacer" />
        <div className="coin-counter">
          <span className="coin" />
          <span>CRÉDITOS · 03</span>
        </div>
        {user ? (
          <button className="btn ghost auth-btn" onClick={signOut}>
            {user.name} ▾
          </button>
        ) : (
          <Link className="btn auth-btn" href="/sign-in">
            Iniciar Sesión
          </Link>
        )}
        <button
          className="btn ghost hamburger"
          onClick={() => setOpen(true)}
          aria-label="Menú"
        >
          ≡
        </button>
      </nav>

      <div
        className={"av-mobile-backdrop" + (open ? " open" : "")}
        onClick={close}
      />
      <aside className={"av-mobile-panel" + (open ? " open" : "")}>
        <div className="pixel neon-cyan" style={{ fontSize: 11, marginBottom: 16 }}>
          MENÚ
        </div>
        <Link className={cls(pathname === "/home")} href="/home" onClick={close}>
          Inicio
        </Link>
        <Link className={cls(isLibrary(pathname))} href="/games" onClick={close}>
          Biblioteca
        </Link>
        <Link
          className={cls(pathname === "/hall-of-fame")}
          href="/hall-of-fame"
          onClick={close}
        >
          Salón de la Fama
        </Link>
        <Link className={cls(pathname === "/about")} href="/about" onClick={close}>
          Acerca de
        </Link>
        <Link
          className={cls(pathname === "/sign-in")}
          href="/sign-in"
          onClick={close}
        >
          {user ? "Cuenta" : "Iniciar Sesión"}
        </Link>
        <div style={{ flex: 1 }} />
        <div
          className="pixel"
          style={{
            fontSize: 9,
            color: "var(--ink-faint)",
            letterSpacing: "0.16em",
          }}
        >
          CRÉDITOS · 03
        </div>
      </aside>
    </>
  );
}
