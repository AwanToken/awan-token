/**
 * Owner Command Deck: wallet · @telegram · $AWN · role.
 *
 * Source of truth for balances: TonAPI jetton holders (on-chain JW balances).
 * Source of truth for @username: shared API (Vercel Blob via miniapp /api/holders).
 * Registry tags merge in — they never drop on-chain holders.
 */

import { Address } from "@ton/core";
import {
  HOLDERS_API_URL,
  KNOWN_AWN_WALLETS,
  MINTER,
  TOTAL_SUPPLY_AWN,
  TONAPI_BASE,
} from "../config";
import { fromUnits } from "./ton";

export const HOLDERS_LS_KEY = "awn_holder_registry_v1";

export type HolderRole =
  | "owner"
  | "liquidity_vault"
  | "lp_pool_owner"
  | "dedust_pool"
  | "keeper"
  | "holder";

export type HolderRow = {
  wallet: string;
  telegram: string;
  telegramId?: number;
  awn: string;
  updatedAt: number;
  /** Where tokens sit / who this address is (ops / LP / retail). */
  role?: HolderRole;
  roleLabel?: string;
};

export type TokenLocationSummary = {
  totalSupply: number;
  holdersSum: number;
  owner: number;
  liquidityVault: number;
  lpPoolOwner: number;
  retail: number;
  unexplained: number;
  holderCount: number;
};

const ROLE_LABELS: Record<HolderRole, string> = {
  owner: "Owner",
  liquidity_vault: "DeDust AWN vault (LP)",
  lp_pool_owner: "LP / simulated pool",
  dedust_pool: "DeDust pool",
  keeper: "Keeper",
  holder: "Holder",
};

function walletKey(raw: string): string {
  try {
    return Address.parse(raw).toRawString().toLowerCase();
  } catch {
    return raw.trim().toLowerCase();
  }
}

function toFriendly(raw: string): string {
  try {
    return Address.parse(raw).toString({
      urlSafe: true,
      bounceable: true,
      testOnly: false,
    });
  } catch {
    return raw;
  }
}

function parseAwn(awn: string): number {
  const n = Number(String(awn).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function resolveRole(wallet: string): { role: HolderRole; roleLabel: string } {
  const key = walletKey(wallet);
  for (const known of KNOWN_AWN_WALLETS) {
    if (walletKey(known.address) === key) {
      return { role: known.role, roleLabel: ROLE_LABELS[known.role] };
    }
  }
  return { role: "holder", roleLabel: ROLE_LABELS.holder };
}

function withRole(row: HolderRow): HolderRow {
  const { role, roleLabel } = resolveRole(row.wallet);
  return { ...row, role, roleLabel };
}

export function formatAwnDisplay(awn: string): string {
  const n = parseAwn(awn);
  if (!Number.isFinite(n)) return awn;
  if (Number.isInteger(n)) return n.toLocaleString("en-US");
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

export function loadHolderRegistry(): HolderRow[] {
  try {
    const raw = localStorage.getItem(HOLDERS_LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HolderRow[];
    return Array.isArray(parsed) ? parsed.map(withRole) : [];
  } catch {
    return [];
  }
}

export function saveHolderRegistry(rows: HolderRow[]) {
  localStorage.setItem(HOLDERS_LS_KEY, JSON.stringify(rows.slice(0, 1000)));
}

export function upsertHolderRow(row: HolderRow, prev: HolderRow[]): HolderRow[] {
  const key = walletKey(row.wallet);
  const next = prev.filter((r) => walletKey(r.wallet) !== key);
  next.unshift(withRole(row));
  return sortHoldersByBalance(next).slice(0, 1000);
}

export function importHolderRegistryJson(raw: string): HolderRow[] {
  const parsed = JSON.parse(raw) as HolderRow[];
  if (!Array.isArray(parsed)) throw new Error("JSON non valido");
  return sortHoldersByBalance(
    parsed
      .filter((r) => r && typeof r.wallet === "string")
      .map((r) =>
        withRole({
          wallet: toFriendly(r.wallet),
          telegram: r.telegram || "—",
          telegramId: r.telegramId,
          awn: String(r.awn ?? "0"),
          updatedAt: Number(r.updatedAt) || Date.now(),
        }),
      ),
  );
}

export function sortHoldersByBalance(rows: HolderRow[]): HolderRow[] {
  return [...rows].sort((a, b) => parseAwn(b.awn) - parseAwn(a.awn));
}

/**
 * Merge by wallet identity (EQ/UQ/raw).
 * `balanceSource` balances always win when present and non-empty.
 * Telegram handles prefer non-empty @ from either side.
 */
function mergeByWallet(
  balanceSource: HolderRow[],
  tagSource: HolderRow[],
): HolderRow[] {
  const map = new Map<string, HolderRow>();

  for (const r of tagSource) {
    map.set(walletKey(r.wallet), withRole({ ...r, wallet: toFriendly(r.wallet) }));
  }

  for (const r of balanceSource) {
    const key = walletKey(r.wallet);
    const prev = map.get(key);
    const friendly = toFriendly(r.wallet);
    if (!prev) {
      map.set(key, withRole({ ...r, wallet: friendly }));
      continue;
    }
    const chainAwn = r.awn != null && String(r.awn) !== "" ? String(r.awn) : prev.awn;
    map.set(
      key,
      withRole({
        ...prev,
        ...r,
        wallet: friendly,
        awn: chainAwn,
        telegram:
          r.telegram && r.telegram !== "—"
            ? r.telegram
            : prev.telegram && prev.telegram !== "—"
              ? prev.telegram
              : "—",
        telegramId: r.telegramId ?? prev.telegramId,
        updatedAt: Math.max(r.updatedAt || 0, prev.updatedAt || 0),
      }),
    );
  }

  return sortHoldersByBalance([...map.values()]);
}

/** Pull Telegram registry from miniapp shared API. */
export async function fetchRemoteHolderRegistry(): Promise<HolderRow[]> {
  const res = await fetch(HOLDERS_API_URL, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`holders api ${res.status}`);
  }
  const data = (await res.json()) as { holders?: HolderRow[] } | HolderRow[];
  const rows = Array.isArray(data) ? data : data.holders ?? [];
  return rows
    .filter((r) => r && typeof r.wallet === "string")
    .map((r) =>
      withRole({
        wallet: toFriendly(r.wallet),
        telegram: r.telegram || "—",
        telegramId: r.telegramId,
        // Registry awn is advisory only — sync overwrites from TonAPI.
        awn: String(r.awn ?? "0"),
        updatedAt: Number(r.updatedAt) || Date.now(),
      }),
    );
}

type TonapiHolder = {
  balance: string;
  owner?: { address?: string; is_wallet?: boolean };
};

/**
 * Paginate ALL on-chain jetton holders from TonAPI.
 * Balances are real JW balances (not claim-map get_holder_info).
 */
export async function fetchOnChainJettonHolders(
  pageSize = 100,
): Promise<HolderRow[]> {
  const now = Date.now();
  const out: HolderRow[] = [];
  let offset = 0;
  let total: number | null = null;

  for (;;) {
    const url =
      `${TONAPI_BASE}/jettons/${encodeURIComponent(MINTER)}/holders` +
      `?limit=${pageSize}&offset=${offset}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      throw new Error(`tonapi holders ${res.status}`);
    }
    const data = (await res.json()) as {
      addresses?: TonapiHolder[];
      total?: number;
    };
    if (typeof data.total === "number") total = data.total;
    const batch = data.addresses ?? [];
    for (const h of batch) {
      const owner = h.owner?.address;
      if (!owner) continue;
      let awn = "0";
      try {
        awn = fromUnits(BigInt(h.balance || "0"));
      } catch {
        awn = h.balance || "0";
      }
      out.push(
        withRole({
          wallet: toFriendly(owner),
          telegram: "—",
          awn,
          updatedAt: now,
        }),
      );
    }
    offset += batch.length;
    if (batch.length === 0) break;
    if (batch.length < pageSize) break;
    if (total != null && offset >= total) break;
    // Safety: avoid infinite loops on bad APIs
    if (offset > 50_000) break;
  }

  return sortHoldersByBalance(out);
}

export function summarizeTokenLocation(rows: HolderRow[]): TokenLocationSummary {
  let holdersSum = 0;
  let owner = 0;
  let liquidityVault = 0;
  let lpPoolOwner = 0;
  let retail = 0;

  for (const r of rows) {
    const n = parseAwn(r.awn);
    holdersSum += n;
    switch (r.role) {
      case "owner":
        owner += n;
        break;
      case "liquidity_vault":
        liquidityVault += n;
        break;
      case "lp_pool_owner":
      case "dedust_pool":
        lpPoolOwner += n;
        break;
      default:
        retail += n;
        break;
    }
  }

  const unexplained = Math.max(0, TOTAL_SUPPLY_AWN - holdersSum);
  return {
    totalSupply: TOTAL_SUPPLY_AWN,
    holdersSum,
    owner,
    liquidityVault,
    lpPoolOwner,
    retail,
    unexplained,
    holderCount: rows.length,
  };
}

/**
 * Sync: on-chain jetton balances (TonAPI, fully paginated) + optional @tg tags.
 * Never overwrites TonAPI balances with get_holder_info (claim map can be stale).
 */
export async function syncHoldersFromNetwork(
  prev: HolderRow[] = [],
): Promise<HolderRow[]> {
  const [remote, chain] = await Promise.all([
    fetchRemoteHolderRegistry().catch(() => [] as HolderRow[]),
    fetchOnChainJettonHolders(),
  ]);

  // Tags only — strip balances so registry/localStorage cannot override TonAPI.
  const tags: HolderRow[] = [...prev, ...remote].map((r) => ({
    ...r,
    awn: "0",
  }));

  const merged = mergeByWallet(chain, tags);
  // Keep on-chain balances; drop zero-balance tag-only ghosts.
  return merged.filter((r) => parseAwn(r.awn) > 0 || (r.role && r.role !== "holder"));
}
