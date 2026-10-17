/** RunAwan — 4 sequential platformer levels with end bosses. */

export type RunLevelId = 1 | 2 | 3 | 4;

export type BossKind = "octopus" | "werewolf" | "medusa" | "minotaur";

export type BossDef = {
  kind: BossKind;
  name: string;
  nameIt: string;
  hp: number;
  /** Seconds between energy-sphere volleys. */
  shootCd: number;
  /** Sphere speed px/s. */
  sphereSpeed: number;
  /** Spheres per volley. */
  sphereCount: number;
  color: string;
  accent: string;
};

export type RunLevelDef = {
  id: RunLevelId;
  name: string;
  nameIt: string;
  /** Horizontal world length in px (playfield before boss arena). */
  worldLen: number;
  /** Boss arena width appended after worldLen. */
  arenaW: number;
  /** Ground goomba-like enemies. */
  enemyCount: number;
  /** Multiplier on enemy patrol speed. */
  enemySpeedMul: number;
  /** Floating pads density (higher = more platforms). */
  padCount: number;
  /** Extra hard $AWN coins floating high. */
  rareAwnCount: number;
  /** Temporary power-up pickups in the level. */
  pickupCount: number;
  /** Breakable / question brick clusters. */
  brickClusters: number;
  /** Optional mid-level checkpoint x. */
  checkpointX: number;
  boss: BossDef;
  bgTop: string;
  bgMid: string;
  bgBot: string;
  accent: string;
  platformTop: string;
  platformBot: string;
  brickColor: string;
};

export const RUN_LEVELS: RunLevelDef[] = [
  {
    id: 1,
    name: "Coral Depths",
    nameIt: "Profondità Corallo",
    worldLen: 5200,
    arenaW: 520,
    enemyCount: 14,
    enemySpeedMul: 0.85,
    padCount: 22,
    rareAwnCount: 6,
    pickupCount: 5,
    brickClusters: 10,
    checkpointX: 2600,
    boss: {
      kind: "octopus",
      name: "Tide Kraken",
      nameIt: "Piovra delle Maree",
      hp: 8,
      shootCd: 2.2,
      sphereSpeed: 160,
      sphereCount: 2,
      color: "#6b3fa0",
      accent: "#c77dff",
    },
    bgTop: "#1a3a5a",
    bgMid: "#0c1e38",
    bgBot: "#040c18",
    accent: "#5ce1ff",
    platformTop: "#3a9bc9",
    platformBot: "#1a4a6a",
    brickColor: "#c4784a",
  },
  {
    id: 2,
    name: "Moonlit Grove",
    nameIt: "Bosco Lunare",
    worldLen: 6000,
    arenaW: 560,
    enemyCount: 18,
    enemySpeedMul: 1.05,
    padCount: 26,
    rareAwnCount: 8,
    pickupCount: 6,
    brickClusters: 12,
    checkpointX: 3000,
    boss: {
      kind: "werewolf",
      name: "Night Howler",
      nameIt: "Lupo Mannaro",
      hp: 10,
      shootCd: 1.9,
      sphereSpeed: 190,
      sphereCount: 3,
      color: "#5a4638",
      accent: "#e8b896",
    },
    bgTop: "#2a1840",
    bgMid: "#140828",
    bgBot: "#080212",
    accent: "#c77dff",
    platformTop: "#8b6a9a",
    platformBot: "#3a2a4a",
    brickColor: "#a06840",
  },
  {
    id: 3,
    name: "Stone Gaze",
    nameIt: "Sguardo di Pietra",
    worldLen: 6800,
    arenaW: 600,
    enemyCount: 22,
    enemySpeedMul: 1.2,
    padCount: 30,
    rareAwnCount: 10,
    pickupCount: 7,
    brickClusters: 14,
    checkpointX: 3400,
    boss: {
      kind: "medusa",
      name: "Serpent Queen",
      nameIt: "Medusa",
      hp: 12,
      shootCd: 1.6,
      sphereSpeed: 210,
      sphereCount: 3,
      color: "#2a6a4a",
      accent: "#7dffb0",
    },
    bgTop: "#0a2a3a",
    bgMid: "#061828",
    bgBot: "#020810",
    accent: "#7df9ff",
    platformTop: "#5ce1ff",
    platformBot: "#0a4a5a",
    brickColor: "#b88850",
  },
  {
    id: 4,
    name: "Labyrinth Core",
    nameIt: "Cuore del Labirinto",
    worldLen: 7600,
    arenaW: 640,
    enemyCount: 26,
    enemySpeedMul: 1.35,
    padCount: 34,
    rareAwnCount: 12,
    pickupCount: 8,
    brickClusters: 16,
    checkpointX: 3800,
    boss: {
      kind: "minotaur",
      name: "Horned Titan",
      nameIt: "Minotauro",
      hp: 16,
      shootCd: 1.4,
      sphereSpeed: 230,
      sphereCount: 4,
      color: "#6a3018",
      accent: "#ff9f1c",
    },
    bgTop: "#2a1008",
    bgMid: "#1a0808",
    bgBot: "#0a0204",
    accent: "#ff9f1c",
    platformTop: "#ffb347",
    platformBot: "#6a2a08",
    brickColor: "#c06030",
  },
];

export function getRunLevel(id: number): RunLevelDef {
  const clamped = Math.max(1, Math.min(4, Math.floor(id))) as RunLevelId;
  return RUN_LEVELS[clamped - 1]!;
}

/** Extra play purchase: 1 TON → keeper, max 10 buys / calendar day. */
export const RUN_LIFE_PRICE_TON = "1";
export const RUN_LIFE_MAX_PURCHASES_PER_DAY = 10;
/** Free lives topped up each calendar day (local). */
export const RUN_FREE_LIVES_PER_DAY = 3;

/** Pause / emergency power-up: 1 TON each → keeper. */
export const RUN_PAUSE_POWER_PRICE_TON = "1";
