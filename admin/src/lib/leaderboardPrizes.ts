/**
 * Owner Command Deck: import Classifica (leaderboard) prize JSON → BatchTransfer.
 * Miniapp exports top wallets; Owner pastes here and prefills the batch textarea.
 */

export type LeaderboardPrizeRow = {
  wallet: string;
  amount: number;
  rank?: number;
  name?: string;
  score?: number;
};

/** Default $AWN prizes by rank (1-indexed). Owner can edit amounts in JSON before import. */
export const DEFAULT_PRIZE_AWN = [
  5000, 2500, 1000, 500, 250, 150, 100, 100, 75, 75,
];

export function importLeaderboardPrizeJson(raw: string): LeaderboardPrizeRow[] {
  const parsed = JSON.parse(raw) as
    | LeaderboardPrizeRow[]
    | { prizes?: LeaderboardPrizeRow[]; rows?: LeaderboardPrizeRow[] };
  const rows = Array.isArray(parsed)
    ? parsed
    : parsed.prizes ?? parsed.rows ?? [];
  if (!Array.isArray(rows)) throw new Error("JSON non valido");
  return rows
    .map((r, i) => {
      const wallet = String(r.wallet ?? "").trim();
      const amount = Number(
        (r as { amount?: number; prizeAwn?: number; minedAwn?: number }).amount ??
          (r as { prizeAwn?: number }).prizeAwn ??
          (r as { minedAwn?: number }).minedAwn ??
          0,
      );
      return {
        wallet,
        amount,
        rank: Number(r.rank) || i + 1,
        name: r.name,
        score: r.score != null ? Number(r.score) : undefined,
      };
    })
    .filter((r) => r.wallet.length >= 10 && Number.isFinite(r.amount) && r.amount > 0);
}

/** Alternate address / amount lines for BatchTransfer textarea. */
export function leaderboardPrizesToBatchText(rows: LeaderboardPrizeRow[]): string {
  return rows
    .map((r) => {
      const n = r.amount;
      const amt = Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000);
      return `${r.wallet}\n${amt}`;
    })
    .join("\n");
}

export function totalPrizeAwn(rows: LeaderboardPrizeRow[]): number {
  return rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
}
