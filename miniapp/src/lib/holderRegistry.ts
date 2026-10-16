/**
 * Registry of miniapp users for the Owner Command Deck table:
 * wallet · @telegram · $AWN amount.
 * Stored in localStorage (same browser) and optionally POSTed to VITE_HOLDERS_ENDPOINT.
 *
 * Bind rule:
 * - Normal users: 1 Telegram id → 1 wallet (first bind wins).
 * - Owner only: same Telegram username/id may register multiple wallets.
 */
import { TOKEN_OWNER } from "../config";
import { formatTelegramHandle, getTelegramUser, toTelegramIdentity } from "./telegram";
import { fetchHolder, fromUnits, normalizeAddress, toFriendlyAddress } from "./ton";

export const HOLDERS_LS_KEY = "awn_holder_registry_v1";

export type HolderRow = {
  wallet: string;
  telegram: string;
  telegramId?: number;
  awn: string;
  updatedAt: number;
};

function loadAll(): HolderRow[] {
  try {
    const raw = localStorage.getItem(HOLDERS_LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HolderRow[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAll(rows: HolderRow[]) {
  localStorage.setItem(HOLDERS_LS_KEY, JSON.stringify(rows.slice(0, 500)));
}

function isTokenOwnerWallet(addr: string): boolean {
  try {
    return normalizeAddress(addr).equals(normalizeAddress(TOKEN_OWNER));
  } catch {
    return false;
  }
}

/** TG may multi-bind only if this wallet is Owner, or TG already has Owner wallet. */
function ownerAllowsMultiWallet(tgId: number, walletFriendly: string, all: HolderRow[]): boolean {
  if (isTokenOwnerWallet(walletFriendly)) return true;
  return all.some(
    (r) => r.telegramId === tgId && isTokenOwnerWallet(r.wallet),
  );
}

export function listHolderRegistry(): HolderRow[] {
  return loadAll().sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Upsert current miniapp user (wallet + Telegram + on-chain $AWN).
 * Rule: 1 Telegram → 1 wallet, except Owner (same @username, more wallets OK).
 */
export async function registerMiniappHolder(wallet: string | null): Promise<HolderRow | null> {
  if (!wallet) return null;
  const tg = getTelegramUser();
  const identity = toTelegramIdentity(tg);
  const telegram =
    formatTelegramHandle(identity) || (tg ? `id:${tg.id}` : "—");
  const friendly = toFriendlyAddress(wallet);

  const all = loadAll();
  if (tg?.id != null) {
    const bound = all.find((r) => r.telegramId === tg.id);
    if (
      bound &&
      bound.wallet.toLowerCase() !== friendly.toLowerCase() &&
      !ownerAllowsMultiWallet(tg.id, friendly, all)
    ) {
      // Non-Owner: keep first bind, ignore other wallets for this TG.
      return bound;
    }
  }

  let awn = "0";
  try {
    const h = await fetchHolder(wallet);
    awn = fromUnits(h.balance);
  } catch {
    /* keep previous / 0 */
  }

  const row: HolderRow = {
    wallet: friendly,
    telegram,
    telegramId: tg?.id,
    awn,
    updatedAt: Date.now(),
  };

  const next = all.filter(
    (r) => r.wallet.toLowerCase() !== row.wallet.toLowerCase(),
  );
  next.unshift(row);
  saveAll(next);

  const endpoint = import.meta.env.VITE_HOLDERS_ENDPOINT as string | undefined;
  if (endpoint) {
    try {
      void fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(row),
      });
    } catch {
      /* optional beacon */
    }
  }

  return row;
}

/** Export for Owner Command Deck import. */
export function getHolderRegistryForExport(): HolderRow[] {
  return listHolderRegistry();
}

export function exportHolderRegistryJson(): string {
  return JSON.stringify(listHolderRegistry(), null, 2);
}
