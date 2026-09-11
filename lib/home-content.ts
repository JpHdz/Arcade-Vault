export type AccentColor = "cyan" | "magenta" | "yellow" | "green";
export type FeatureIconKind = "GAMEPAD" | "FREE" | "TROPHY" | "ROCKET";

export interface Feature {
  icon: FeatureIconKind;
  title: string;
  description: string;
  color: AccentColor;
}

export interface TickerEntry {
  player: string;
  /** Display name of the game, not a Game["id"]. */
  game: string;
  score: number;
  when: string;
  color: AccentColor;
}

export interface TopPlayer {
  rank: number;
  player: string;
  score: number;
}

export interface HomeStat {
  value: string;
  unit: string;
  caption: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export const FEATURES: Feature[] = [
  {
    icon: "GAMEPAD",
    title: "JUEGOS CLÁSICOS",
    description:
      "Arkanoid, Tetris, Snake y muchos más. Los mejores arcades de todos los tiempos en un solo lugar.",
    color: "cyan",
  },
  {
    icon: "FREE",
    title: "100% GRATIS",
    description:
      "Sin suscripciones, sin pagos ocultos. Todos los juegos disponibles de forma gratuita.",
    color: "yellow",
  },
  {
    icon: "TROPHY",
    title: "LADDER BOARDS",
    description:
      "Compite con jugadores de todo el mundo. Escala el ranking y demuestra quién es el mejor.",
    color: "magenta",
  },
  {
    icon: "ROCKET",
    title: "SIEMPRE CRECIENDO",
    description:
      "Agregamos nuevos juegos constantemente. Vuelve seguido, siempre habrá algo nuevo que jugar.",
    color: "green",
  },
];

export const HOME_STATS: HomeStat[] = [
  { value: "12+", unit: "JUEGOS", caption: "Y CONTANDO" },
  { value: "MILES", unit: "DE PARTIDAS", caption: "JUGADAS CADA DÍA" },
  { value: "GLOBAL", unit: "RANKING", caption: "COMPITE CON EL MUNDO" },
];

export const TICKER: TickerEntry[] = [
  { player: "NEONFOX", game: "Caída", score: 184220, when: "hace 2 min", color: "magenta" },
  { player: "PX_KAI", game: "Glotón", score: 96400, when: "hace 5 min", color: "yellow" },
  { player: "Z3R0COOL", game: "Invasores", score: 54190, when: "hace 8 min", color: "green" },
  { player: "VAULT_07", game: "Rocas", score: 41200, when: "hace 12 min", color: "cyan" },
  { player: "GLITCHA", game: "Bloque Buster", score: 28450, when: "hace 18 min", color: "cyan" },
  { player: "ARKADYA", game: "Serpentina", score: 7820, when: "hace 24 min", color: "green" },
  { player: "CYBER_LU", game: "Ranaria", score: 18900, when: "hace 31 min", color: "yellow" },
];

export const TOP_PLAYERS: TopPlayer[] = [
  { rank: 1, player: "NEONFOX", score: 312840 },
  { rank: 2, player: "PX_KAI", score: 248110 },
  { rank: 3, player: "M00NRYU", score: 196720 },
  { rank: 4, player: "VAULT_07", score: 154300 },
  { rank: 5, player: "GLITCHA", score: 138900 },
];

export const PRICING_PERKS: string[] = [
  "Acceso a todos los juegos",
  "Ranking global y salón de la fama",
  "Sin anuncios entre partidas",
  "Guarda tus puntuaciones",
  "Nuevos juegos cada mes",
  "Funciona en cualquier navegador",
];

export const FAQ: FaqItem[] = [
  {
    question: "¿REALMENTE ES GRATIS?",
    answer:
      'Sí. Arcade Vault es un proyecto sin fines de lucro hecho por amor a los clásicos. No hay versión "premium" escondida.',
  },
  {
    question: "¿NECESITO CREAR CUENTA?",
    answer:
      "No. Puedes jugar como invitado. Si quieres guardar tu puntuación y aparecer en el ranking, regístrate en 10 segundos.",
  },
  {
    question: "¿CÓMO SOBREVIVEN SIN COBRAR?",
    answer:
      "Es un proyecto comunitario. Si te gusta, compártelo. Esa es toda la moneda que aceptamos.",
  },
];
