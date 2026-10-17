/**
 * GeckoTerminal market snapshot + OHLCV for $AWN (info/chart only).
 * Falls back to DeDust mid price if GT is unreachable.
 */
import { MINTER, TONAPI_BASE } from "../config";
import { fetchDedustMidPrice } from "./priceFeed";

/** Deployed CORS proxy — used when same-origin /api/gecko is missing (Vite local/tunnel). */
const PROD_GECKO_PROXY = "https://awn-miniapp-vercel.vercel.app/api/gecko";

type GeckoResource = "pool" | "token" | "ohlcv";

/** Same-origin first, then production proxy (Vite has no serverless /api/*). */
function geckoProxyUrls(resource: GeckoResource): string[] {
  const q = `?resource=${resource}`;
  const urls: string[] = [];
  if (typeof window !== "undefined" && window.location?.origin) {
    urls.push(`${window.location.origin}/api/gecko${q}`);
  } else {
    urls.push(`${PROD_GECKO_PROXY}${q}`);
  }
  const prod = `${PROD_GECKO_PROXY}${q}`;
  if (!urls.includes(prod)) urls.push(prod);
  return urls;
}

async function fetchGeckoResource<T>(resource: GeckoResource): Promise<T> {
  let lastErr: unknown;
  for (const url of geckoProxyUrls(resource)) {
    try {
      return await fetchJson<T>(url);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`gt ${resource} unreachable`);
}

export type MarketCandle = {
  t: string;
  ts: number;
  price: number;
  high: number;
  low: number;
  volume: number;
};

export type Extremum = {
  price: number;
  ts: number;
  label: string;
};

export type MarketSnapshot = {
  priceUsd: number;
  priceNative: number;
  change24hPct: number | null;
  fdvUsd: number | null;
  marketCapUsd: number | null;
  totalSupply: number | null;
  circulatingSupply: number | null;
  volume24hUsd: number | null;
  buys24h: number;
  sells24h: number;
  liquidityUsd: number | null;
  holders: number | null;
  ath: Extremum | null;
  atl: Extremum | null;
  poolCreatedAt: string | null;
  ageLabel: string;
  contract: string;
  candles: MarketCandle[];
  source: "geckoterminal" | "dedust";
};

function num(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}

function formatAge(iso: string | null): string {
  if (!iso) return "—";
  const created = Date.parse(iso);
  if (!Number.isFinite(created)) return "—";
  const sec = Math.max(0, Math.floor((Date.now() - created) / 1000));
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  if (d >= 30) {
    const mo = Math.floor(d / 30);
    return `${mo}mo ${d % 30}d`;
  }
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatDay(tsSec: number): string {
  try {
    return new Date(tsSec * 1000).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function candleTimeLabel(tsSec: number): string {
  try {
    const d = new Date(tsSec * 1000);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`gt ${res.status}`);
  const ct = res.headers.get("content-type") || "";
  // Vite/SPA hosts often 200 HTML for unknown /api/* — treat as failure so we fall back.
  if (ct && !ct.includes("application/json")) {
    throw new Error(`gt non-json`);
  }
  return (await res.json()) as T;
}

async function fetchHoldersCount(): Promise<number | null> {
  try {
    const url = `${TONAPI_BASE}/jettons/${encodeURIComponent(MINTER)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = (await res.json()) as { holders_count?: number };
    return typeof data.holders_count === "number" ? data.holders_count : null;
  } catch {
    return null;
  }
}

type GtPoolAttrs = {
  base_token_price_usd?: string;
  base_token_price_native_currency?: string;
  fdv_usd?: string;
  market_cap_usd?: string | null;
  reserve_in_usd?: string;
  pool_created_at?: string;
  price_change_percentage?: { h24?: string };
  transactions?: { h24?: { buys?: number; sells?: number } };
  volume_usd?: { h24?: string };
};

type GtTokenAttrs = {
  price_usd?: string;
  fdv_usd?: string;
  market_cap_usd?: string | null;
  normalized_total_supply?: string;
  total_reserve_in_usd?: string;
  volume_usd?: { h24?: string };
};

type OhlcvRow = [number, number, number, number, number, number];

function parseOhlcv(list: OhlcvRow[]): MarketCandle[] {
  const rows = list
    .filter((r) => Array.isArray(r) && r.length >= 5)
    .map((r) => {
      const ts = Number(r[0]);
      const open = Number(r[1]);
      const high = Number(r[2]);
      const low = Number(r[3]);
      const close = Number(r[4]);
      const volume = Number(r[5] ?? 0);
      return {
        t: candleTimeLabel(ts),
        ts,
        price: close,
        high,
        low,
        volume: Number.isFinite(volume) ? volume : 0,
      } satisfies MarketCandle;
    })
    .filter((c) => Number.isFinite(c.price) && c.price > 0)
    .sort((a, b) => a.ts - b.ts);
  return rows;
}

function extremesFromCandles(candles: MarketCandle[]): {
  ath: Extremum | null;
  atl: Extremum | null;
} {
  if (!candles.length) return { ath: null, atl: null };
  let athPrice = -Infinity;
  let athTs = 0;
  let atlPrice = Infinity;
  let atlTs = 0;
  for (const c of candles) {
    if (c.high > athPrice) {
      athPrice = c.high;
      athTs = c.ts;
    }
    if (c.low > 0 && c.low < atlPrice) {
      atlPrice = c.low;
      atlTs = c.ts;
    }
  }
  return {
    ath:
      Number.isFinite(athPrice) && athPrice > 0
        ? {
            price: athPrice,
            ts: athTs,
            label: `Chart high · ${formatDay(athTs)}`,
          }
        : null,
    atl:
      Number.isFinite(atlPrice) && atlPrice > 0 && atlPrice < Infinity
        ? {
            price: atlPrice,
            ts: atlTs,
            label: `Chart low · ${formatDay(atlTs)}`,
          }
        : null,
  };
}

async function fetchGeckoSnapshot(): Promise<MarketSnapshot> {
  // allSettled: one failing GT resource must not wipe the whole panel to Dedust dashes
  const [poolSettled, tokenSettled, ohlcvSettled, holders] = await Promise.all([
    fetchGeckoResource<{ data?: { attributes?: GtPoolAttrs } }>("pool").then(
      (v) => ({ ok: true as const, v }),
      () => ({ ok: false as const, v: null }),
    ),
    fetchGeckoResource<{ data?: { attributes?: GtTokenAttrs } }>("token").then(
      (v) => ({ ok: true as const, v }),
      () => ({ ok: false as const, v: null }),
    ),
    fetchGeckoResource<{ data?: { attributes?: { ohlcv_list?: OhlcvRow[] } } }>(
      "ohlcv",
    ).then(
      (v) => ({ ok: true as const, v }),
      () => ({ ok: false as const, v: null }),
    ),
    fetchHoldersCount(),
  ]);

  if (!poolSettled.ok && !tokenSettled.ok && !ohlcvSettled.ok) {
    throw new Error("gecko unreachable");
  }

  const pool = poolSettled.v?.data?.attributes ?? {};
  const token = tokenSettled.v?.data?.attributes ?? {};
  const candles = parseOhlcv(
    ohlcvSettled.v?.data?.attributes?.ohlcv_list ?? [],
  );
  const { ath, atl } = extremesFromCandles(candles);

  const priceNative =
    num(pool.base_token_price_native_currency) ??
    candles[candles.length - 1]?.price ??
    0;
  const priceUsd =
    num(pool.base_token_price_usd) ?? num(token.price_usd) ?? 0;
  const totalSupply = num(token.normalized_total_supply);
  const fdvUsd = num(pool.fdv_usd) ?? num(token.fdv_usd);
  const marketCapUsd = num(pool.market_cap_usd) ?? num(token.market_cap_usd);
  const volume24hUsd = num(pool.volume_usd?.h24) ?? num(token.volume_usd?.h24);
  const liquidityUsd = num(pool.reserve_in_usd) ?? num(token.total_reserve_in_usd);
  const change24hPct = num(pool.price_change_percentage?.h24);
  const buys24h = pool.transactions?.h24?.buys ?? 0;
  const sells24h = pool.transactions?.h24?.sells ?? 0;
  const poolCreatedAt = pool.pool_created_at ?? null;

  // Circulating not published by GT for this token — show total when MC missing.
  const circulatingSupply =
    marketCapUsd != null && priceUsd > 0
      ? marketCapUsd / priceUsd
      : totalSupply;

  return {
    priceUsd,
    priceNative,
    change24hPct,
    fdvUsd,
    marketCapUsd,
    totalSupply,
    circulatingSupply,
    volume24hUsd,
    buys24h,
    sells24h,
    liquidityUsd,
    holders,
    ath,
    atl,
    poolCreatedAt,
    ageLabel: formatAge(poolCreatedAt),
    contract: MINTER,
    candles,
    source: "geckoterminal",
  };
}

async function fetchDedustFallback(): Promise<MarketSnapshot> {
  const q = await fetchDedustMidPrice();
  const priceNative = q?.price ?? 0;
  const now = Math.floor(Date.now() / 1000);
  const candles: MarketCandle[] =
    priceNative > 0
      ? [
          {
            t: candleTimeLabel(now),
            ts: now,
            price: priceNative,
            high: priceNative,
            low: priceNative,
            volume: q?.tonReserve ?? 0,
          },
        ]
      : [];
  const holders = await fetchHoldersCount();
  return {
    priceUsd: 0,
    priceNative,
    change24hPct: null,
    fdvUsd: null,
    marketCapUsd: null,
    totalSupply: null,
    circulatingSupply: null,
    volume24hUsd: null,
    buys24h: 0,
    sells24h: 0,
    liquidityUsd: q ? q.tonReserve * 2 : null,
    holders,
    ath: null,
    atl: null,
    poolCreatedAt: null,
    ageLabel: "—",
    contract: MINTER,
    candles,
    source: "dedust",
  };
}

/** Full market + OHLCV poll. Prefer GT; soft-fallback to DeDust mid. */
export async function fetchMarketSnapshot(): Promise<MarketSnapshot> {
  try {
    return await fetchGeckoSnapshot();
  } catch {
    return fetchDedustFallback();
  }
}

/** Y-domain with padding so ~2e-7 → 2.7e-7 is visibly non-flat. */
export function chartYDomain(candles: MarketCandle[]): [number, number] {
  const prices = candles.map((c) => c.price).filter((p) => p > 0);
  if (!prices.length) return [0, 1];
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === max) {
    const pad = min * 0.05 || 1e-12;
    return [min - pad, max + pad];
  }
  const pad = (max - min) * 0.1;
  return [Math.max(0, min - pad), max + pad];
}
