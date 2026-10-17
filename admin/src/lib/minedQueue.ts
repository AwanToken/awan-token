/**
 * Owner Command Deck: queued mined $AWN settlements from the miniapp.
 * Shared Blob API (same pattern as holders registry) + optional JSON import.
 */

import { MINED_QUEUE_API_URL } from "../config";

export type MinedQueueEntry = {
  wallet: string;
  minedAwn: number;
  at: number;
  telegram?: string;
  telegramId?: number;
  telegramLabel?: string;
};

export const MINED_QUEUE_LS_KEY = "awn_owner_mined_claim_queue";

export function loadLocalMinedQueue(): MinedQueueEntry[] {
  try {
    const raw = localStorage.getItem(MINED_QUEUE_LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MinedQueueEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalMinedQueue(rows: MinedQueueEntry[]) {
  localStorage.setItem(MINED_QUEUE_LS_KEY, JSON.stringify(rows.slice(-500)));
}

export function importMinedQueueJson(raw: string): MinedQueueEntry[] {
  const parsed = JSON.parse(raw) as
    | MinedQueueEntry[]
    | { queue?: MinedQueueEntry[] };
  const rows = Array.isArray(parsed) ? parsed : parsed.queue ?? [];
  if (!Array.isArray(rows)) throw new Error("JSON non valido");
  return rows
    .filter((r) => r && typeof r.wallet === "string" && Number(r.minedAwn) > 0)
    .map((r) => ({
      wallet: String(r.wallet).trim(),
      minedAwn: Number(r.minedAwn),
      at: Number(r.at) || Date.now(),
      telegram: r.telegram,
      telegramId: r.telegramId,
      telegramLabel: r.telegramLabel,
    }));
}

/** Alternate address / amount lines for BatchTransfer textarea. */
export function minedQueueToBatchText(rows: MinedQueueEntry[]): string {
  return rows
    .map((r) => `${r.wallet}\n${formatMinedAmount(r.minedAwn)}`)
    .join("\n");
}

function formatMinedAmount(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 1000) / 1000);
}

export function telegramLabel(entry: MinedQueueEntry): string {
  if (entry.telegramLabel) return entry.telegramLabel;
  if (entry.telegram) return entry.telegram;
  if (entry.telegramId != null) return `id:${entry.telegramId}`;
  return "—";
}

export async function fetchRemoteMinedQueue(): Promise<MinedQueueEntry[]> {
  const res = await fetch(MINED_QUEUE_API_URL, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`mined-queue api ${res.status}`);
  }
  const data = (await res.json()) as
    | { queue?: MinedQueueEntry[] }
    | MinedQueueEntry[];
  const rows = Array.isArray(data) ? data : data.queue ?? [];
  return rows.filter((r) => r && typeof r.wallet === "string" && Number(r.minedAwn) > 0);
}

export async function clearRemoteMinedQueue(): Promise<void> {
  const res = await fetch(MINED_QUEUE_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clear: true }),
  });
  if (!res.ok) {
    throw new Error(`mined-queue clear ${res.status}`);
  }
}

/** Merge remote + local by (wallet, at) identity; newest last. */
export function mergeMinedQueues(
  a: MinedQueueEntry[],
  b: MinedQueueEntry[],
): MinedQueueEntry[] {
  const map = new Map<string, MinedQueueEntry>();
  for (const row of [...a, ...b]) {
    const key = `${row.wallet.toLowerCase()}|${row.at}|${row.minedAwn}`;
    map.set(key, row);
  }
  return [...map.values()].sort((x, y) => x.at - y.at).slice(-500);
}

export function totalMinedQueued(rows: MinedQueueEntry[]): number {
  return rows.reduce((s, r) => s + (Number(r.minedAwn) || 0), 0);
}

/** Short wallet + @tg + amount for sticky alert / ops hint. */
export function minedQueueTopHint(rows: MinedQueueEntry[]): string {
  const top = rows[0];
  if (!top) return "";
  const w = top.wallet;
  const short =
    w.length > 12 ? `${w.slice(0, 6)}…${w.slice(-4)}` : w;
  const tg = telegramLabel(top);
  const tgPart = tg && tg !== "—" ? ` · ${tg}` : "";
  return `${short}${tgPart} · ${formatMinedAmount(top.minedAwn)} $AWN`;
}
