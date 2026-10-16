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
 * Stub for Command Deck prize events:
 * Admin batch-transfers $AWN to top wallets after a tournament window.
 * Wire via admin BatchTransfer — see miniapp README.
 */
export function adminPrizeNote(): string {
  return "Prize $AWN drops are sent from Command Deck (admin BatchTransfer). This Mini App only stores local scores.";
}
