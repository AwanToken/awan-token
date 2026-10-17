/** Neon Siege — 4 sequential levels with distinct neon themes. */

export type SiegeLevelId = 1 | 2 | 3 | 4;

export type SiegeLevelDef = {
  id: SiegeLevelId;
  name: string;
  nameIt: string;
  /** Waves before the end-of-level boss fight. */
  wavesToBoss: number;
  bgTop: string;
  bgMid: string;
  bgBot: string;
  accent: string;
  enemyTint: string;
};

export const SIEGE_LEVELS: SiegeLevelDef[] = [
  {
    id: 1,
    name: "Neon Gate",
    nameIt: "Porta Neon",
    wavesToBoss: 4,
    bgTop: "#2a0a4a",
    bgMid: "#140628",
    bgBot: "#050210",
    accent: "#ff2bd6",
    enemyTint: "#4a6fa5",
  },
  {
    id: 2,
    name: "Magenta Drift",
    nameIt: "Deriva Magenta",
    wavesToBoss: 5,
    bgTop: "#3a0840",
    bgMid: "#1a0628",
    bgBot: "#080212",
    accent: "#c77dff",
    enemyTint: "#6b3a5c",
  },
  {
    id: 3,
    name: "Void Belt",
    nameIt: "Fascia Void",
    wavesToBoss: 5,
    bgTop: "#0a2a3a",
    bgMid: "#061828",
    bgBot: "#020810",
    accent: "#7df9ff",
    enemyTint: "#3d5c45",
  },
  {
    id: 4,
    name: "Core Siege",
    nameIt: "Assedio Core",
    wavesToBoss: 6,
    bgTop: "#2a1008",
    bgMid: "#1a0808",
    bgBot: "#0a0204",
    accent: "#ff9f1c",
    enemyTint: "#5c4a7a",
  },
];

export function getSiegeLevel(id: number): SiegeLevelDef {
  const clamped = Math.max(1, Math.min(4, Math.floor(id))) as SiegeLevelId;
  return SIEGE_LEVELS[clamped - 1]!;
}

/** Fixed mined $AWN rewards (off-chain) from mega-brief. */
export const SIEGE_REWARD = {
  miniboss: 5,
  superboss: 10,
  bomb: 20,
} as const;

/** Bomb purchase: 2 TON → keeper, 1 use per match. */
export const SIEGE_BOMB_PRICE_TON = "2";
