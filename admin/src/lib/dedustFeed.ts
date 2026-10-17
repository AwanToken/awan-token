import { TONAPI_BASE } from "../config";

/** DeDust volatile pool used for live mid-price chart (info only). */
export const DEDUST_POOL =
  import.meta.env.VITE_DEDUST_POOL ||
  "EQDRwZaP6FX2J-VMQxVRydeTAWDKrVomkai5G-Iwji43X8oo";

export type DedustPoint = {
  t: string;
  price: number;
  ton: number;
  awn: number;
};

function parseNum(raw: string): bigint {
  const s = raw.trim();
  if (/^-0x/i.test(s)) return -BigInt(s.slice(1));
  return BigInt(s);
}

export async function fetchDedustMid(): Promise<DedustPoint | null> {
  const url = `${TONAPI_BASE}/blockchain/accounts/${encodeURIComponent(DEDUST_POOL)}/methods/get_reserves`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`dedust ${res.status}`);
  const data = (await res.json()) as {
    stack?: { type: string; num?: string }[];
  };
  const stack = data.stack ?? [];
  if (stack.length < 2 || !stack[0]?.num || !stack[1]?.num) return null;
  const tonNano = parseNum(stack[0].num);
  const awnUnits = parseNum(stack[1].num);
  if (tonNano <= 0n || awnUnits <= 0n) return null;
  const ton = Number(tonNano) / 1e9;
  const awn = Number(awnUnits) / 1e9;
  if (!Number.isFinite(ton) || !Number.isFinite(awn) || awn <= 0) return null;
  return {
    t: new Date().toLocaleTimeString(),
    price: ton / awn,
    ton,
    awn,
  };
}
