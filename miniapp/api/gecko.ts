import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Server-side GeckoTerminal proxy — browsers hit CORS on api.geckoterminal.com.
 * Allowlisted resources only (pool / token / ohlcv for $AWN DeDust pair).
 */

const GT_BASE = "https://api.geckoterminal.com/api/v2";
const NETWORK = "ton";
const MINTER = "EQA2T-nreKcnBzZmQfAJfEXCBdx8qPGVi8zGIUhFMtYi1vPs";
const DEDUST_POOL = "EQDRwZaP6FX2J-VMQxVRydeTAWDKrVomkai5G-Iwji43X8oo";

const RESOURCES: Record<string, string> = {
  pool: `${GT_BASE}/networks/${NETWORK}/pools/${encodeURIComponent(DEDUST_POOL)}`,
  token: `${GT_BASE}/networks/${NETWORK}/tokens/${encodeURIComponent(MINTER)}`,
  ohlcv:
    `${GT_BASE}/networks/${NETWORK}/pools/${encodeURIComponent(DEDUST_POOL)}` +
    `/ohlcv/minute?aggregate=15&limit=100&currency=token`,
};

function setCors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  res.setHeader("Cache-Control", "public, s-maxage=20, stale-while-revalidate=40");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  if (req.method !== "GET") {
    return res.status(405).json({ error: "method not allowed" });
  }

  const raw = req.query.resource;
  const resource = Array.isArray(raw) ? raw[0] : raw;
  const url = resource ? RESOURCES[resource] : undefined;
  if (!url) {
    return res.status(400).json({
      error: "resource must be pool | token | ohlcv",
    });
  }

  try {
    const upstream = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    const text = await upstream.text();
    res.setHeader("Content-Type", "application/json");
    if (!upstream.ok) {
      return res.status(upstream.status).send(text || JSON.stringify({ error: `gt ${upstream.status}` }));
    }
    return res.status(200).send(text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(502).json({ error: msg });
  }
}
