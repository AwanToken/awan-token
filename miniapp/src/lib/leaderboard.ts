export type ScoreEntry = {
  name: string;
  score: number;
  ship: string;
  wallet?: string;
  at: number;
};

const LS_KEY = "awn_neon_siege_lb";
const MAX = 20;

/** In-memory mirror for the session (localStorage is the durable store). */
const memory: ScoreEntry[] = [];

function loadAll(): ScoreEntry[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const parsed = raw ? (JSON.parse(raw) as ScoreEntry[]) : [];
    memory.length = 0;
    memory.push(...parsed);
    return parsed;
  } catch {
    return [...memory];
  }
}

function persist(entries: ScoreEntry[]) {
  memory.length = 0;
  memory.push(...entries);
  localStorage.setItem(LS_KEY, JSON.stringify(entries));
}

export function getTop(n = MAX): ScoreEntry[] {
  return loadAll()
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}

export function submitScore(entry: Omit<ScoreEntry, "at">): ScoreEntry[] {
  const all = loadAll();
  all.push({ ...entry, at: Date.now() });
  all.sort((a, b) => b.score - a.score);
  const trimmed = all.slice(0, MAX);
  persist(trimmed);
  return trimmed;
}

/**
 * Default $AWN prizes by rank (1-indexed). Owner can edit amounts after export
 * before pasting into Command Deck BatchTransfer.
 */
export const DEFAULT_PRIZE_AWN = [
  5000, 2500, 1000, 500, 250, 150, 100, 100, 75, 75,
];

export type PrizeExportRow = {
  rank: number;
  wallet: string;
  amount: number;
  name: string;
  score: number;
  ship?: string;
  at: number;
};

/**
 * Top entries that have a wallet, with default prize amounts for BatchTransfer.
 * Copy JSON → Command Deck «Import leaderboard JSON» → Prefill BatchTransfer.
 */
export function exportTopPrizeJson(
  n = 10,
  prizes: number[] = DEFAULT_PRIZE_AWN,
): string {
  const top = getTop(Math.max(n, 20));
  const withWallet = top.filter((e) => e.wallet && e.wallet.trim().length >= 10);
  const rows: PrizeExportRow[] = withWallet.slice(0, n).map((e, i) => {
    const prize = prizes[i] ?? prizes[prizes.length - 1] ?? 50;
    return {
      rank: i + 1,
      wallet: String(e.wallet).trim(),
      amount: prize,
      name: e.name,
      score: e.score,
      ship: e.ship,
      at: e.at,
    };
  });
  return JSON.stringify({ prizes: rows }, null, 2);
}

export function countExportableWallets(n = 10): number {
  return getTop(Math.max(n, 20)).filter(
    (e) => e.wallet && e.wallet.trim().length >= 10,
  ).slice(0, n).length;
}

/** Ops note for Classifica prize settle flow. */
export function adminPrizeNote(): string {
  return "Copia JSON top wallet → Command Deck → Import leaderboard → Prefill BatchTransfer. Premi $AWN non partono da questa Mini App.";
}
