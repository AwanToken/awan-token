/**
 * Owner-only table: wallet · @telegram · $AWN (from miniapp users).
 * Miniapp rule: 1 TG = 1 wallet; only Token Owner may register multiple wallets under the same @username.
 */

export const HOLDERS_LS_KEY = "awn_holder_registry_v1";

export type HolderRow = {
  wallet: string;
  telegram: string;
  telegramId?: number;
  awn: string;
  updatedAt: number;
};

export function loadHolderRegistry(): HolderRow[] {
  try {
    const raw = localStorage.getItem(HOLDERS_LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HolderRow[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveHolderRegistry(rows: HolderRow[]) {
  localStorage.setItem(HOLDERS_LS_KEY, JSON.stringify(rows.slice(0, 500)));
}

export function upsertHolderRow(row: HolderRow, prev: HolderRow[]): HolderRow[] {
  const next = prev.filter(
    (r) => r.wallet.toLowerCase() !== row.wallet.toLowerCase(),
  );
  next.unshift(row);
  return next.slice(0, 500);
}

export function importHolderRegistryJson(raw: string): HolderRow[] {
  const parsed = JSON.parse(raw) as HolderRow[];
  if (!Array.isArray(parsed)) throw new Error("JSON non valido");
  return parsed
    .filter((r) => r && typeof r.wallet === "string")
    .map((r) => ({
      wallet: r.wallet,
      telegram: r.telegram || "—",
      telegramId: r.telegramId,
      awn: String(r.awn ?? "0"),
      updatedAt: Number(r.updatedAt) || Date.now(),
    }));
}
