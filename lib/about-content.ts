import type { AccentColor } from "@/lib/home-content";

export type HighlightIconKind = "HEART" | "BROWSER" | "PLANT";

export interface Highlight {
  icon: HighlightIconKind;
  text: string;
  color: Extract<AccentColor, "cyan" | "magenta" | "green">;
}

export interface ContactTip {
  text: string;
  /** Modifier appended to `.tip-led`: "" is green, "y" yellow, "m" magenta. */
  led: "" | "y" | "m";
}

export const ABOUT_MISSION =
  "ARCADE VAULT nació del amor por los videojuegos clásicos. Nuestra misión es preservar y celebrar los arcades que definieron una generación, haciéndolos accesibles para todos, en cualquier lugar y sin costo.";

export const HIGHLIGHTS: Highlight[] = [
  { icon: "HEART", text: "HECHO CON ❤️ PARA JUGADORES", color: "magenta" },
  {
    icon: "BROWSER",
    text: "JUEGOS EN HTML — CORREN EN CUALQUIER NAVEGADOR",
    color: "cyan",
  },
  { icon: "PLANT", text: "PROYECTO EN CONSTANTE CRECIMIENTO", color: "green" },
];

export const CONTACT_TIPS: ContactTip[] = [
  { text: "RESPUESTA EN 24-48H", led: "" },
  { text: "SUGERENCIAS BIENVENIDAS", led: "y" },
  { text: "SIN SPAM, JAMÁS", led: "m" },
];

/** Pixels in the divider banner between the about hero and the contact block. */
export const DIVIDER_PIXEL_COUNT = 24;
