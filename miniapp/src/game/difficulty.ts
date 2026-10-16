export type DifficultyId = "easy" | "normal" | "hard";

export type DifficultyDef = {
  id: DifficultyId;
  label: string;
  labelIt: string;
  blurb: string;
  /** Enemy HP multiplier */
  enemyHp: number;
  /** Enemy move / bullet speed */
  enemySpeed: number;
  /** How many enemies per wave (scale) */
  spawnMul: number;
  /** Extra player shields at start */
  bonusShields: number;
  /** Player damage multiplier */
  playerDmg: number;
  /** Seconds between waves */
  waveGap: number;
  /** Chance enemy shoots (boss/bomber already have rates) */
  enemyFireMul: number;
  /** Score multiplier for leaderboard fairness */
  scoreMul: number;
};

export const DIFFICULTIES: DifficultyDef[] = [
  {
    id: "easy",
    label: "Easy",
    labelIt: "Facile",
    blurb: "Nemici lenti, +2 scudi, più danno — ideale per iniziare",
    enemyHp: 0.55,
    enemySpeed: 0.7,
    spawnMul: 0.7,
    bonusShields: 2,
    playerDmg: 1.45,
    waveGap: 7.5,
    enemyFireMul: 0.45,
    scoreMul: 0.85,
  },
  {
    id: "normal",
    label: "Normal",
    labelIt: "Normale",
    blurb: "Equilibrato — sfida standard Neon Siege",
    enemyHp: 1,
    enemySpeed: 1,
    spawnMul: 1,
    bonusShields: 0,
    playerDmg: 1,
    waveGap: 6.2,
    enemyFireMul: 1,
    scoreMul: 1,
  },
  {
    id: "hard",
    label: "Hard",
    labelIt: "Difficile",
    blurb: "Onde dense, fuoco nemico alto — solo per ace",
    enemyHp: 1.45,
    enemySpeed: 1.25,
    spawnMul: 1.25,
    bonusShields: 0,
    playerDmg: 0.9,
    waveGap: 5,
    enemyFireMul: 1.55,
    scoreMul: 1.35,
  },
];

export function getDifficulty(id: DifficultyId): DifficultyDef {
  return DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[0]!;
}
