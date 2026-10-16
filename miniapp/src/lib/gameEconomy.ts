/**
 * Off-chain game economy (entertainment + retention).
 * - spendableAwn: starter 10 + rare finds, spent on Mario-style powerups
 * - goldCoins: classic collectibles (score / fun only)
 * - minedAwn: "mined" toward claim from claim pool (NOT minted on-chain)
 *   Player can queue at ≥ MINED_CLAIM_THRESHOLD; owner settles via BatchTransfer
 */

import { MINED_CLAIM_THRESHOLD } from "../config";
import type { DifficultyId } from "../game/difficulty";
import {
  formatTelegramHandle,
  getTelegramUser,
  toTelegramIdentity,
  type TelegramIdentity,
} from "./telegram";

export { MINED_CLAIM_THRESHOLD };

export type RunPowerId = "mushroom" | "fire_flower" | "star" | "leaf";

export type RunPowerDef = {
  id: RunPowerId;
  name: string;
  blurb: string;
  costAwn: number;
  effect: string;
};

export const RUN_POWERS: RunPowerDef[] = [
  {
    id: "mushroom",
    name: "Fungo $AWN",
    blurb: "Crescita — più hit point e salto",
    costAwn: 3,
    effect: "size+ · jump+",
  },
  {
    id: "fire_flower",
    name: "Fiore di fuoco",
    blurb: "Spara palle di fuoco neon",
    costAwn: 5,
    effect: "fireball",
  },
  {
    id: "star",
    name: "Stella invincibile",
    blurb: "Breve invulnerabilità a inizio run",
    costAwn: 4,
    effect: "invuln_start",
  },
  {
    id: "leaf",
    name: "Foglia planata",
    blurb: "Planata lenta in aria",
    costAwn: 3,
    effect: "glide",
  },
];

/** Chance a collectible is a rare $AWN mined token (rest = gold coin). ~14% — not trivial, not rare enough to frustrate. */
export const AWN_TOKEN_DROP_CHANCE = 0.14;

/**
 * Neon Siege kill drops — attract, don't enrich.
 * Chance scales linearly with difficulty index (easy=0…hard=2), not exponentially.
 * Elite = ace craft only; bosses higher but capped.
 *
 * Rates: elite Easy 6% / Normal 12% / Hard 18%; boss Easy 25% / Normal 35% / Hard 45%.
 * Amounts: elite 0.1–0.5, boss 0.5–1.0 mined $AWN per successful roll.
 */
export type SiegeDropKind = "boss" | "elite";

export const SIEGE_DROP = {
  elite: {
    baseChance: 0.06,
    chancePerTier: 0.06,
    minAwn: 0.1,
    maxAwn: 0.5,
  },
  boss: {
    baseChance: 0.25,
    chancePerTier: 0.1,
    minAwn: 0.5,
    maxAwn: 1.0,
  },
} as const;

const DIFF_INDEX: Record<DifficultyId, number> = {
  easy: 0,
  normal: 1,
  hard: 2,
};

/** Linear chance: base + tier * step (capped). */
export function siegeDropChance(difficulty: DifficultyId, kind: SiegeDropKind): number {
  const cfg = SIEGE_DROP[kind];
  const idx = DIFF_INDEX[difficulty] ?? 0;
  const raw = cfg.baseChance + idx * cfg.chancePerTier;
  return Math.min(kind === "boss" ? 0.45 : 0.2, raw);
}

/** Roll a siege kill drop. Returns mined amount (0 if miss). */
export function rollSiegeAwnDrop(difficulty: DifficultyId, kind: SiegeDropKind): number {
  const cfg = SIEGE_DROP[kind];
  if (Math.random() >= siegeDropChance(difficulty, kind)) return 0;
  const span = cfg.maxAwn - cfg.minAwn;
  const amount = cfg.minAwn + Math.random() * span;
  return Math.round(amount * 10) / 10; // 1 decimal
}

type Eco = {
  starterGranted: boolean;
  spendableAwn: number;
  goldCoins: number;
  minedAwn: number;
  powers: RunPowerId[];
  /** Last known Telegram identity for this wallet (owner panels only). */
  telegram?: TelegramIdentity;
};

const key = (w: string | null) => `awn_run_eco_${w || "guest"}`;

function defaultEco(): Eco {
  return {
    starterGranted: false,
    spendableAwn: 0,
    goldCoins: 0,
    minedAwn: 0,
    powers: [],
  };
}

/** Attach / refresh Telegram identity from WebApp when available. */
function withTelegram(eco: Eco): Eco {
  const id = toTelegramIdentity(getTelegramUser());
  if (!id) return eco;
  eco.telegram = id;
  return eco;
}

export function loadEco(wallet: string | null): Eco {
  try {
    const raw = localStorage.getItem(key(wallet));
    if (!raw) return defaultEco();
    return { ...defaultEco(), ...(JSON.parse(raw) as Eco) };
  } catch {
    return defaultEco();
  }
}

function saveEco(wallet: string | null, eco: Eco) {
  localStorage.setItem(key(wallet), JSON.stringify(eco));
}

/** First time opening AWN Run: grant 10 spendable $AWN for powerups. */
export function ensureStarterGrant(wallet: string | null): Eco {
  const eco = loadEco(wallet);
  const prevTg = JSON.stringify(eco.telegram ?? null);
  withTelegram(eco);
  if (!eco.starterGranted) {
    eco.starterGranted = true;
    eco.spendableAwn += 10;
    saveEco(wallet, eco);
  } else if (JSON.stringify(eco.telegram ?? null) !== prevTg) {
    saveEco(wallet, eco);
  }
  return eco;
}

export function buyPower(wallet: string | null, id: RunPowerId): Eco | { error: string } {
  const eco = ensureStarterGrant(wallet);
  const def = RUN_POWERS.find((p) => p.id === id);
  if (!def) return { error: "Unknown" };
  if (eco.powers.includes(id)) return { error: "Owned" };
  if (eco.spendableAwn < def.costAwn) return { error: "Insufficient $AWN" };
  eco.spendableAwn -= def.costAwn;
  eco.powers.push(id);
  saveEco(wallet, eco);
  return eco;
}

export function applyRunRewards(
  wallet: string | null,
  gold: number,
  mined: number,
  spendableBonus = 0,
): Eco {
  const eco = withTelegram(ensureStarterGrant(wallet));
  eco.goldCoins += gold;
  eco.minedAwn += mined;
  eco.spendableAwn += spendableBonus;
  saveEco(wallet, eco);
  return eco;
}

/** Persist mined $AWN from a Neon Siege run (same ledger as AWN Run). */
export function applySiegeKillReward(wallet: string | null, mined: number): Eco {
  if (mined <= 0) return ensureStarterGrant(wallet);
  return applyRunRewards(wallet, 0, mined, 0);
}

/** Owner-facing: pending mined $AWN across guest + wallet keys is per-wallet only. */
export function getMinedPending(wallet: string | null): number {
  return loadEco(wallet).minedAwn;
}

/** True when mined balance meets the claim-pool queue threshold. */
export function canClaimMined(wallet: string | null): boolean {
  return getMinedPending(wallet) >= MINED_CLAIM_THRESHOLD;
}

/** Mark mined as “queued for owner claim batch” without wiping (owner settles off-app). */
export function markClaimQueued(wallet: string | null): Eco {
  const eco = loadEco(wallet);
  saveEco(wallet, eco);
  return eco;
}

export type OwnerClaimQueue = {
  wallet: string;
  minedAwn: number;
  at: number;
  telegram?: TelegramIdentity;
  /** Preformatted @user / name·id for owner lists. */
  telegramLabel?: string;
};

const OWNER_Q = "awn_owner_mined_claim_queue";

export function queueMinedForOwnerClaim(wallet: string): OwnerClaimQueue[] {
  const eco = withTelegram(loadEco(wallet));
  if (eco.minedAwn <= 0) return loadOwnerQueue();
  const telegram = eco.telegram ?? toTelegramIdentity(getTelegramUser());
  const q = loadOwnerQueue();
  q.push({
    wallet,
    minedAwn: eco.minedAwn,
    at: Date.now(),
    telegram,
    telegramLabel: formatTelegramHandle(telegram) || undefined,
  });
  localStorage.setItem(OWNER_Q, JSON.stringify(q.slice(-100)));
  eco.minedAwn = 0;
  saveEco(wallet, eco);
  return q;
}

/**
 * Player claim: queue all mined $AWN (≥ threshold) for owner BatchTransfer
 * settlement from the claim-pool path. Clears local mined counter.
 */
export function claimMinedToPool(
  wallet: string | null,
): { ok: true; queued: number; queue: OwnerClaimQueue[] } | { ok: false; error: string } {
  if (!wallet) return { ok: false, error: "wallet_required" };
  const pending = getMinedPending(wallet);
  if (pending < MINED_CLAIM_THRESHOLD) {
    return { ok: false, error: "below_threshold" };
  }
  const queue = queueMinedForOwnerClaim(wallet);
  return { ok: true, queued: pending, queue };
}

/** Display label for owner panels (queue entry or live session). */
export function ownerTelegramLabel(
  entry: { telegram?: TelegramIdentity; telegramLabel?: string } | null | undefined,
): string {
  if (!entry) return "";
  if (entry.telegramLabel) return entry.telegramLabel;
  return formatTelegramHandle(entry.telegram);
}

export function loadOwnerQueue(): OwnerClaimQueue[] {
  try {
    const raw = localStorage.getItem(OWNER_Q);
    return raw ? (JSON.parse(raw) as OwnerClaimQueue[]) : [];
  } catch {
    return [];
  }
}

export function clearOwnerQueue() {
  localStorage.setItem(OWNER_Q, "[]");
}
