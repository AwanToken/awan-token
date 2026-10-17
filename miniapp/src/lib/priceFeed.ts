/**
 * Live $AWN/TON mid price from DeDust pool reserves (info/chart only).
 * Buy/Sell stay on Ston.fi to avoid DeDust bounce losses.
 */
import { DEDUST_POOL, TONAPI_BASE } from "../config";

export type CandlePoint = {
  t: string;
  price: number;
  volume: number;
};

const MAX_POINTS = 48;
let history: CandlePoint[] = [];
let lastPrice = 0;

function push(price: number, volume = 0) {
  if (!Number.isFinite(price) || price <= 0) return;
  lastPrice = price;
  const now = new Date();
  history.push({
    t: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    price: Number(price.toFixed(8)),
    volume,
  });
  if (history.length > MAX_POINTS) history = history.slice(-MAX_POINTS);
}

/** Mid price TON per 1 $AWN from DeDust volatile pool reserves. */
export async function fetchDedustMidPrice(): Promise<{
  price: number;
  tonReserve: number;
  awnReserve: number;
} | null> {
  const url = `${TONAPI_BASE}/blockchain/accounts/${encodeURIComponent(DEDUST_POOL)}/methods/get_reserves`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`dedust reserves ${res.status}`);
  const data = (await res.json()) as {
    success?: boolean;
    stack?: { type: string; num?: string }[];
  };
  const stack = data.stack ?? [];
  if (stack.length < 2 || !stack[0]?.num || !stack[1]?.num) return null;

  const parseNum = (raw: string): bigint => {
    const s = raw.trim();
    if (/^-0x/i.test(s)) return -BigInt(s.slice(1));
    return BigInt(s);
  };

  // DeDust volatile: reserve0 = TON (nano), reserve1 = AWN (9 decimals) for our pool.
  const tonNano = parseNum(stack[0].num);
  const awnUnits = parseNum(stack[1].num);
  if (tonNano <= 0n || awnUnits <= 0n) return null;

  const ton = Number(tonNano) / 1e9;
  const awn = Number(awnUnits) / 1e9;
  if (!Number.isFinite(ton) || !Number.isFinite(awn) || awn <= 0) return null;

  return { price: ton / awn, tonReserve: ton, awnReserve: awn };
}

export function bootstrapFeed(): CandlePoint[] {
  return [...history];
}

export function getLastPrice(): number {
  return lastPrice;
}

/** Poll DeDust and append a candle. Returns updated history. */
export async function tickDedustFeed(): Promise<CandlePoint[]> {
  try {
    const q = await fetchDedustMidPrice();
    if (q) push(q.price, q.tonReserve);
  } catch {
    /* keep last history on transient errors */
  }
  return [...history];
}

/** Seed chart with one live point (or keep empty until first poll). */
export async function bootstrapDedustFeed(): Promise<CandlePoint[]> {
  if (history.length === 0) {
    await tickDedustFeed();
  }
  return [...history];
}
