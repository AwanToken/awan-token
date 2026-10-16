/** Local ledger of claim earnings per wallet (contract has no claim history getter). */

export type ClaimRecord = {
  cycleId: number;
  /** Estimated / recorded TON nano-string for display */
  amountTon: string;
  amountNano: string;
  at: number;
  txHint?: string;
};

const key = (wallet: string) => `awn_claim_hist_${wallet}`;

export function loadClaimHistory(wallet: string | null): ClaimRecord[] {
  if (!wallet) return [];
  try {
    const raw = localStorage.getItem(key(wallet));
    return raw ? (JSON.parse(raw) as ClaimRecord[]) : [];
  } catch {
    return [];
  }
}

export function addClaimRecord(wallet: string, rec: Omit<ClaimRecord, "at">) {
  const list = loadClaimHistory(wallet);
  // one entry per cycle
  const filtered = list.filter((r) => r.cycleId !== rec.cycleId);
  filtered.unshift({ ...rec, at: Date.now() });
  localStorage.setItem(key(wallet), JSON.stringify(filtered.slice(0, 50)));
  return filtered;
}

export function totalClaimedTon(wallet: string | null): number {
  return loadClaimHistory(wallet).reduce((s, r) => s + Number(r.amountTon || 0), 0);
}
