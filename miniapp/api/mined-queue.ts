import type { VercelRequest, VercelResponse } from "@vercel/node";
import { get, put } from "@vercel/blob";

/**
 * Shared mined-$AWN claim queue (miniapp POST → Command Deck GET).
 * Players queue at ≥100 off-chain; Owner settles via BatchTransfer.
 */

export type MinedQueueEntry = {
  wallet: string;
  minedAwn: number;
  at: number;
  telegram?: string;
  telegramId?: number;
};

const BLOB_PATH = "awn-mined-claim-queue-v1.json";
const MAX_ROWS = 500;

function setCors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
}

function sanitizeEntry(raw: unknown): MinedQueueEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const wallet = String(r.wallet ?? "").trim();
  if (!wallet || wallet.length < 10) return null;
  const minedAwn = Number(r.minedAwn);
  if (!Number.isFinite(minedAwn) || minedAwn <= 0) return null;
  const telegramId =
    typeof r.telegramId === "number"
      ? r.telegramId
      : typeof r.telegramId === "string" && r.telegramId
        ? Number(r.telegramId)
        : undefined;
  return {
    wallet,
    minedAwn,
    at: Number(r.at) || Date.now(),
    telegram: String(r.telegram ?? "").trim() || undefined,
    telegramId: Number.isFinite(telegramId) ? telegramId : undefined,
  };
}

async function readQueue(): Promise<MinedQueueEntry[]> {
  try {
    const result = await get(BLOB_PATH, { access: "private" });
    if (!result || !("stream" in result) || !result.stream) return [];
    const text = await new Response(result.stream).text();
    const parsed = JSON.parse(text) as MinedQueueEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue(rows: MinedQueueEntry[]): Promise<MinedQueueEntry[]> {
  const next = rows.slice(-MAX_ROWS);
  await put(BLOB_PATH, JSON.stringify(next), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
  return next;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({
      error: "BLOB_READ_WRITE_TOKEN missing on server",
    });
  }

  try {
    if (req.method === "GET") {
      const queue = await readQueue();
      return res.status(200).json({
        queue,
        count: queue.length,
        updatedAt: Date.now(),
      });
    }

    if (req.method === "POST") {
      const body = req.body as Record<string, unknown> | unknown[] | null;

      if (body && !Array.isArray(body) && body.clear === true) {
        await writeQueue([]);
        return res.status(200).json({ ok: true, queue: [], count: 0 });
      }

      if (body && !Array.isArray(body) && body.replace === true) {
        const raw = Array.isArray(body.queue) ? body.queue : [];
        const next = raw
          .map(sanitizeEntry)
          .filter((e): e is MinedQueueEntry => !!e)
          .slice(-MAX_ROWS);
        const queue = await writeQueue(next);
        return res.status(200).json({ ok: true, queue, count: queue.length });
      }

      const incoming = Array.isArray(body)
        ? body.map(sanitizeEntry).filter((e): e is MinedQueueEntry => !!e)
        : (() => {
            const one = sanitizeEntry(body);
            return one ? [one] : [];
          })();

      if (incoming.length === 0) {
        return res.status(400).json({ error: "need wallet + minedAwn fields" });
      }

      let queue = await readQueue();
      queue = [...queue, ...incoming].slice(-MAX_ROWS);
      queue = await writeQueue(queue);
      return res.status(200).json({ ok: true, queue, count: queue.length });
    }

    return res.status(405).json({ error: "method not allowed" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: msg });
  }
}
