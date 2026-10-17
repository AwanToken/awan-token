/**
 * RunAwan lives / plays (off-chain counter + TonConnect micropayments).
 * Scoped to RunAwan only — Neon Siege does not share this counter.
 */

import {
  RUN_FREE_LIVES_PER_DAY,
  RUN_LIFE_MAX_PURCHASES_PER_DAY,
  RUN_LIFE_PRICE_TON,
} from "../game/run/runLevels";

export { RUN_FREE_LIVES_PER_DAY, RUN_LIFE_MAX_PURCHASES_PER_DAY, RUN_LIFE_PRICE_TON };

export type RunLivesState = {
  /** Local calendar day key YYYY-MM-DD */
  day: string;
  lives: number;
  purchasesToday: number;
};

const storageKey = (wallet: string | null) => `awn_run_lives_${wallet || "guest"}`;

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function defaultState(): RunLivesState {
  return {
    day: todayKey(),
    lives: RUN_FREE_LIVES_PER_DAY,
    purchasesToday: 0,
  };
}

function persist(wallet: string | null, state: RunLivesState) {
  localStorage.setItem(storageKey(wallet), JSON.stringify(state));
}

/** Load lives, rolling calendar day (refill free floor, reset purchase cap). */
export function loadRunLives(wallet: string | null): RunLivesState {
  const today = todayKey();
  let state: RunLivesState;
  try {
    const raw = localStorage.getItem(storageKey(wallet));
    state = raw ? { ...defaultState(), ...(JSON.parse(raw) as RunLivesState) } : defaultState();
  } catch {
    state = defaultState();
  }
  if (state.day !== today) {
    state.day = today;
    state.purchasesToday = 0;
    if (state.lives < RUN_FREE_LIVES_PER_DAY) {
      state.lives = RUN_FREE_LIVES_PER_DAY;
    }
    persist(wallet, state);
  }
  return state;
}

export function getRunLives(wallet: string | null): number {
  return loadRunLives(wallet).lives;
}

export function purchasesLeftToday(wallet: string | null): number {
  const s = loadRunLives(wallet);
  return Math.max(0, RUN_LIFE_MAX_PURCHASES_PER_DAY - s.purchasesToday);
}

export function canBuyRunLife(wallet: string | null): boolean {
  return purchasesLeftToday(wallet) > 0;
}

/** Spend one life to start a RunAwan play. */
export function consumeRunLife(
  wallet: string | null,
): { ok: true; lives: number } | { ok: false; lives: number } {
  const s = loadRunLives(wallet);
  if (s.lives < 1) return { ok: false, lives: s.lives };
  s.lives -= 1;
  persist(wallet, s);
  return { ok: true, lives: s.lives };
}

/**
 * Credit one life after a successful 1 TON → keeper payment.
 * Enforces max purchases per calendar day client-side.
 */
export function grantPurchasedRunLife(
  wallet: string | null,
): { ok: true; state: RunLivesState } | { ok: false; error: "daily_cap" } {
  const s = loadRunLives(wallet);
  if (s.purchasesToday >= RUN_LIFE_MAX_PURCHASES_PER_DAY) {
    return { ok: false, error: "daily_cap" };
  }
  s.purchasesToday += 1;
  s.lives += 1;
  persist(wallet, s);
  return { ok: true, state: s };
}
