import type { Metadata } from "next";
import { ContactForm } from "@/components/about/contact-form";
import { HighlightIcon } from "@/components/about/highlight-icon";
import { RevealObserver } from "@/components/home/reveal-observer";
import {
  ABOUT_MISSION,
  CONTACT_TIPS,
  DIVIDER_PIXEL_COUNT,
  HIGHLIGHTS,
} from "@/lib/about-content";

export const metadata: Metadata = { title: "Acerca de" };

export default function AboutPage() {
  return (
    <div className="about fade-in">
      <RevealObserver />

      <section className="about-hero">
        <div className="kicker pixel neon-yellow">▸ ACERCA DE</div>
        <h1 className="about-title">ACERCA DE ARCADE VAULT</h1>
        <p className="about-mission">{ABOUT_MISSION}</p>

        <div className="highlight-row">
          {HIGHLIGHTS.map((h, i) => (
            <div
              key={h.icon}
              className={"highlight " + h.color}
              style={{ transitionDelay: i * 80 + "ms" }}
            >
              <HighlightIcon kind={h.icon} />
              <div className="hl-text pixel">{h.text}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="about-divider reveal" aria-hidden="true">
        <div className="div-bar"></div>
        <div className="div-pixels">
          {Array.from({ length: DIVIDER_PIXEL_COUNT }, (_, i) => (
            <span key={i} style={{ animationDelay: i * 80 + "ms" }}></span>
          ))}
        </div>
        <div className="div-bar"></div>
      </div>

      <section className="about-contact reveal">
        <div className="contact-grid">
          <div className="contact-intro">
            <div className="kicker pixel neon-cyan">▸ CONTACTO</div>
            <h2 className="contact-title">CONTÁCTANOS</h2>
            <p className="contact-sub">
              ¿Tienes alguna sugerencia, quieres proponer un juego, o
              simplemente quieres saludar? Escríbenos.
            </p>
            <div className="contact-tips">
              {CONTACT_TIPS.map((tip) => (
                <div key={tip.text} className="tip">
                  <span className={("tip-led " + tip.led).trim()}></span>
                  {tip.text}
                </div>
              ))}
            </div>
          </div>

          <ContactForm />
        </div>
      </section>
    </div>
  );
}
