/**
 * Mock $AWN/TON candle/area feed.
 * Swap `fetchRealDexQuote` later for a real DEX API (DeDust / STON.fi).
 */

export type CandlePoint = {
  t: string;
  price: number;
  volume: number;
};

let seed = 0.0042;
let history: CandlePoint[] = [];

function pushPoint() {
  const drift = (Math.random() - 0.48) * 0.00018;
  const spike = Math.random() > 0.92 ? (Math.random() - 0.5) * 0.0005 : 0;
  seed = Math.max(0.0008, seed + drift + spike);
  const now = new Date();
  history.push({
    t: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    price: Number(seed.toFixed(6)),
    volume: Math.round(40 + Math.random() * 220),
  });
  if (history.length > 48) history = history.slice(-48);
}

export function bootstrapFeed(n = 24): CandlePoint[] {
  if (history.length === 0) {
    for (let i = 0; i < n; i++) pushPoint();
  }
  return [...history];
}

export function tickFeed(): CandlePoint[] {
  pushPoint();
  return [...history];
}

/** Placeholder hook point for live DEX pricing */
export async function fetchRealDexQuote(): Promise<number | null> {
  // TODO: call DeDust/STON.fi pool quote and return mid price
  return null;
}
