import type { VercelRequest, VercelResponse } from "@vercel/node";
import { get, put } from "@vercel/blob";

type HolderRow = {
  wallet: string;
  telegram: string;
  telegramId?: number;
  awn: string;
  updatedAt: number;
};

const BLOB_PATH = "awn-holder-registry-v1.json";
const MAX_ROWS = 500;

function setCors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
}

function sanitizeRow(raw: unknown): HolderRow | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const wallet = String(r.wallet ?? "").trim();
  if (!wallet || wallet.length < 10) return null;
  const telegram = String(r.telegram ?? "—").trim() || "—";
  const telegramId =
    typeof r.telegramId === "number"
      ? r.telegramId
      : typeof r.telegramId === "string" && r.telegramId
        ? Number(r.telegramId)
        : undefined;
  return {
    wallet,
    telegram,
    telegramId: Number.isFinite(telegramId) ? telegramId : undefined,
    awn: String(r.awn ?? "0"),
    updatedAt: Number(r.updatedAt) || Date.now(),
  };
}

async function readRegistry(): Promise<HolderRow[]> {
  try {
    const result = await get(BLOB_PATH, { access: "private" });
    if (!result || !("stream" in result) || !result.stream) return [];
    const text = await new Response(result.stream).text();
    const parsed = JSON.parse(text) as HolderRow[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeRegistry(rows: HolderRow[]): Promise<HolderRow[]> {
  const next = rows
    .slice()
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_ROWS);
  await put(BLOB_PATH, JSON.stringify(next), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
  return next;
}

function upsert(row: HolderRow, prev: HolderRow[]): HolderRow[] {
  const next = prev.filter(
    (r) => r.wallet.toLowerCase() !== row.wallet.toLowerCase(),
  );
  next.unshift(row);
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
      const rows = await readRegistry();
      return res.status(200).json({
        holders: rows,
        count: rows.length,
        updatedAt: Date.now(),
      });
    }

    if (req.method === "POST") {
      const body = req.body;
      const incoming = Array.isArray(body)
        ? body.map(sanitizeRow).filter((r): r is HolderRow => !!r)
        : (() => {
            const one = sanitizeRow(body);
            return one ? [one] : [];
          })();

      if (incoming.length === 0) {
        return res.status(400).json({ error: "need wallet + telegram fields" });
      }

      let rows = await readRegistry();
      for (const row of incoming) {
        rows = upsert(row, rows);
      }
      rows = await writeRegistry(rows);
      return res.status(200).json({ ok: true, holders: rows, count: rows.length });
    }

    return res.status(405).json({ error: "method not allowed" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: msg });
  }
}
