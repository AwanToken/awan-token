import { Buffer } from "buffer";
import {
  Address,
  beginCell,
  Cell,
  toNano,
  TupleBuilder,
  TupleReader,
  type TupleItem,
} from "@ton/core";
import { TonClient } from "@ton/ton";
import { CLAIM_PERIOD, CLAIM_WINDOW, DECIMALS, MINTER, NETWORK, RPC, TONAPI_BASE } from "../config";

/** Opcodes from compiled AwanToken (same approach as admin/src/lib/ton.ts) */
const OP = {
  ClaimReward: 3185255800,
  DepositTreasury: 1591581524,
} as const;

/** Normalize bounceable / non-bounceable / testnet (0Q/UQ/EQ/kQ) to a canonical friendly form. */
export function normalizeAddress(addr: string | Address): Address {
  return typeof addr === "string" ? Address.parse(addr) : addr;
}

/** Canonical bounceable user-friendly string (checksum-stable across 0Q/UQ/EQ). */
export function toFriendlyAddress(addr: string | Address): string {
  return normalizeAddress(addr).toString({ urlSafe: true, bounceable: true, testOnly: false });
}

const RPC_FALLBACKS: string[] =
  NETWORK === "mainnet"
    ? [RPC, "https://toncenter.com/api/v2/jsonRPC"].filter(
        (u, i, a) => a.indexOf(u) === i,
      )
    : [
        RPC,
        "https://testnet.toncenter.com/api/v2/jsonRPC",
        "https://ton-testnet.gateway.tatum.io/jsonRPC",
      ].filter((u, i, a) => a.indexOf(u) === i);

let cachedClient: TonClient | null = null;
let cachedEndpoint: string | null = null;

export function client(endpoint = RPC): TonClient {
  if (cachedClient && cachedEndpoint === endpoint) return cachedClient;
  cachedClient = new TonClient({ endpoint });
  cachedEndpoint = endpoint;
  return cachedClient;
}

function resetClientCache() {
  cachedClient = null;
  cachedEndpoint = null;
}

type TonapiStackItem = {
  type: string;
  num?: string;
  cell?: string;
  slice?: string;
};

type TonapiMethodResult = {
  success: boolean;
  exit_code: number;
  stack: TonapiStackItem[];
  decoded?: Record<string, unknown>;
};

function hexToCell(hex: string): Cell {
  const clean = hex.replace(/^0x/i, "");
  return Cell.fromBoc(Buffer.from(clean, "hex"))[0]!;
}

/** tonapi returns hex ints like "0x1" / "-0x1" — BigInt("-0x1") throws in JS. */
function parseTonapiNum(num: string): bigint {
  const s = num.trim();
  if (/^-0x/i.test(s)) return -BigInt(s.slice(1));
  return BigInt(s);
}

/** Map tonapi stack items → @ton/core TupleItem for TupleReader. */
function tonapiStackToTuple(stack: TonapiStackItem[]): TupleItem[] {
  return stack.map((item): TupleItem => {
    if (item.type === "num" && item.num != null) {
      return { type: "int", value: parseTonapiNum(item.num) };
    }
    if (item.type === "null") {
      return { type: "null" };
    }
    if ((item.type === "cell" || item.type === "slice") && (item.cell || item.slice)) {
      const cell = hexToCell((item.cell || item.slice)!);
      // Contract getters usually return addresses as slices on the stack.
      return { type: "slice", cell };
    }
    throw new Error(`Unsupported tonapi stack item: ${item.type}`);
  });
}

async function tonapiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${TONAPI_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`tonapi ${res.status}: ${text.slice(0, 160) || res.statusText}`);
  }
  return (await res.json()) as T;
}

/** Run a get-method via tonapi (CORS-friendly). Prefer this in the browser. */
async function runMethodTonapi(
  account: string,
  method: string,
  args?: { type: string; value: string }[],
): Promise<TupleReader> {
  const friendly = toFriendlyAddress(account);
  let data: TonapiMethodResult;
  if (args && args.length > 0) {
    data = await tonapiFetch<TonapiMethodResult>(
      `/blockchain/accounts/${encodeURIComponent(friendly)}/methods/${encodeURIComponent(method)}`,
      { method: "POST", body: JSON.stringify({ args }) },
    );
  } else {
    data = await tonapiFetch<TonapiMethodResult>(
      `/blockchain/accounts/${encodeURIComponent(friendly)}/methods/${encodeURIComponent(method)}`,
    );
  }
  if (!data.success && data.exit_code !== 0) {
    throw new Error(`tonapi ${method} exit ${data.exit_code}`);
  }
  return new TupleReader(tonapiStackToTuple(data.stack ?? []));
}

async function runMethodTonClient(
  account: string,
  method: string,
  args?: ReturnType<TupleBuilder["build"]>,
): Promise<TupleReader> {
  const errors: string[] = [];
  for (const endpoint of RPC_FALLBACKS) {
    try {
      const c = client(endpoint);
      const res = await c.runMethod(normalizeAddress(account), method, args);
      return asReader(res.stack);
    } catch (e) {
      errors.push(`${endpoint}: ${e instanceof Error ? e.message : String(e)}`);
      resetClientCache();
    }
  }
  throw new Error(`RPC failed for ${method}: ${errors.join(" | ")}`);
}

/**
 * Browser-safe get-method: tonapi first (avoids toncenter CORS/429), then JSON-RPC fallbacks.
 */
async function runGetMethod(
  account: string,
  method: string,
  addressArg?: string,
): Promise<TupleReader> {
  const tonapiArgs = addressArg
    ? [{ type: "slice", value: toFriendlyAddress(addressArg) }]
    : undefined;

  try {
    return await runMethodTonapi(account, method, tonapiArgs);
  } catch (tonapiErr) {
    // Fall back to TonClient / toncenter-style JSON-RPC
    let args: ReturnType<TupleBuilder["build"]> | undefined;
    if (addressArg) {
      const tb = new TupleBuilder();
      tb.writeAddress(normalizeAddress(addressArg));
      args = tb.build();
    }
    try {
      return await runMethodTonClient(account, method, args);
    } catch (rpcErr) {
      const a = tonapiErr instanceof Error ? tonapiErr.message : String(tonapiErr);
      const b = rpcErr instanceof Error ? rpcErr.message : String(rpcErr);
      throw new Error(`${a} · ${b}`);
    }
  }
}

export function toUnits(amount: string | number): bigint {
  const [i, f = ""] = String(amount).trim().split(".");
  const frac = (f + "000000000").slice(0, Number(DECIMALS));
  return BigInt(i || "0") * 10n ** DECIMALS + BigInt(frac || "0");
}

export function fromUnits(v: bigint): string {
  const neg = v < 0n;
  const x = neg ? -v : v;
  const base = 10n ** DECIMALS;
  const whole = x / base;
  const frac = (x % base).toString().padStart(Number(DECIMALS), "0").replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole}${frac ? "." + frac : ""}`;
}

let qid = BigInt(Date.now() % 1_000_000);
function nextQ() {
  qid += 1n;
  return qid;
}

/** Build ClaimReward message body for TonConnect sendTransaction */
export function bodyClaimReward(queryId?: bigint): Cell {
  return beginCell()
    .storeUint(OP.ClaimReward, 32)
    .storeUint(queryId ?? nextQ(), 64)
    .endCell();
}

export function bodyDepositTreasury(): Cell {
  return beginCell()
    .storeUint(OP.DepositTreasury, 32)
    .storeUint(nextQ(), 64)
    .endCell();
}

export type ClaimStatus = {
  cycleId: number;
  cycleStart: number;
  claimWindowOpen: boolean;
  claimWindowEnd: number;
  treasury: bigint;
  claimPoolSnapshot: bigint;
  sellsEnabled: boolean;
  claimProgramActive: boolean;
};

function asReader(stack: unknown): TupleReader {
  if (stack instanceof TupleReader) return stack;
  // @ton/ton v16 may already return TupleReader; older returns TupleItem[]
  return new TupleReader(stack as never);
}

export async function fetchClaimStatus(): Promise<ClaimStatus> {
  const cr = await runGetMethod(MINTER, "get_claim_status");
  return {
    cycleId: Number(cr.readNumber()),
    cycleStart: Number(cr.readNumber()),
    claimWindowOpen: cr.readBoolean(),
    claimWindowEnd: Number(cr.readNumber()),
    treasury: cr.readBigNumber(),
    claimPoolSnapshot: cr.readBigNumber(),
    sellsEnabled: cr.readBoolean(),
    claimProgramActive: cr.readBoolean(),
  };
}

export async function fetchHolder(addr: string) {
  const r = await runGetMethod(MINTER, "get_holder_info", addr);
  return {
    balance: r.readBigNumber(),
    lastUpdate: Number(r.readNumber()),
    minBalancePeriod: r.readBigNumber(),
    periodStartBalance: r.readBigNumber(),
    claimedCycleId: Number(r.readNumber()),
  };
}

export async function fetchJettonSupply(): Promise<bigint> {
  const jd = await runGetMethod(MINTER, "get_jetton_data");
  return jd.readBigNumber();
}

/** Jetton wallet address for an owner (TEP-74 getter on minter). */
export async function fetchJettonWalletAddress(owner: string): Promise<string> {
  const res = await runGetMethod(MINTER, "get_wallet_address", owner);
  const addr = res.readAddress();
  return toFriendlyAddress(addr);
}

export async function fetchTonBalance(addr: string): Promise<bigint> {
  const friendly = toFriendlyAddress(addr);
  try {
    const data = await tonapiFetch<{ balance: number | string }>(
      `/accounts/${encodeURIComponent(friendly)}`,
    );
    return BigInt(data.balance);
  } catch (tonapiErr) {
    const errors: string[] = [
      tonapiErr instanceof Error ? tonapiErr.message : String(tonapiErr),
    ];
    for (const endpoint of RPC_FALLBACKS) {
      try {
        const c = client(endpoint);
        return await c.getBalance(normalizeAddress(addr));
      } catch (e) {
        errors.push(`${endpoint}: ${e instanceof Error ? e.message : String(e)}`);
        resetClientCache();
      }
    }
    throw new Error(`TON balance failed: ${errors.join(" · ")}`);
  }
}

export type TradingSnap = {
  isTradingEnabled: boolean;
  isSellEnabled: boolean;
  isDexLimitsEnabled: boolean;
  dexPool: string | null;
  poolJettonBalance: bigint;
};

export async function fetchTradingSnap(): Promise<TradingSnap> {
  const tr = await runGetMethod(MINTER, "get_trading_state");
  const isTradingEnabled = tr.readBoolean();
  const isSellEnabled = tr.readBoolean();
  const isDexLimitsEnabled = tr.readBoolean();
  const dexPool = tr.readAddressOpt();
  tr.readNumber(); // maxBuy
  tr.readNumber(); // maxSell
  tr.readNumber(); // possession
  tr.readNumber(); // sellTax
  tr.readBigNumber(); // totalSupply in config
  const poolJettonBalance = tr.readBigNumber();
  return {
    isTradingEnabled,
    isSellEnabled,
    isDexLimitsEnabled,
    dexPool: dexPool ? toFriendlyAddress(dexPool) : null,
    poolJettonBalance,
  };
}

/** Estimate claim payout in nanoTON (same formula as contract, before anti-sniper). */
export function estimateClaimPayout(params: {
  snapshot: bigint;
  balance: bigint;
  totalSupply: bigint;
  minBalancePeriod: bigint;
  periodStartBalance: bigint;
}): { raw: bigint; payout: bigint; fullEligible: boolean } {
  const { snapshot, balance, totalSupply, minBalancePeriod, periodStartBalance } = params;
  if (snapshot <= 0n || balance <= 0n || totalSupply <= 0n) {
    return { raw: 0n, payout: 0n, fullEligible: false };
  }
  const raw = (snapshot * balance) / totalSupply;
  const fullEligible = periodStartBalance > 0n && minBalancePeriod >= periodStartBalance;
  const payout = fullEligible ? raw : (raw * 5000n) / 10000n; // ANTI_SNIPER 50%
  return { raw, payout, fullEligible };
}

export function fromNanoTon(v: bigint): string {
  const neg = v < 0n;
  const x = neg ? -v : v;
  const whole = x / 1_000_000_000n;
  const frac = (x % 1_000_000_000n).toString().padStart(9, "0").replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole}${frac ? "." + frac : ""}`;
}

export type CyclePhase =
  | { kind: "inactive" }
  | { kind: "accrual"; secondsLeft: number }
  | { kind: "window"; secondsLeft: number }
  | { kind: "between"; secondsLeft: number };

/** Derive UI countdown from on-chain cycleStart + period/window constants */
export function deriveCyclePhase(
  status: ClaimStatus,
  nowSec = Math.floor(Date.now() / 1000),
): CyclePhase {
  if (!status.claimProgramActive || status.cycleStart <= 0) {
    return { kind: "inactive" };
  }
  const elapsed = nowSec - status.cycleStart;
  if (status.claimWindowOpen) {
    const end =
      status.claimWindowEnd > 0
        ? status.claimWindowEnd
        : status.cycleStart + CLAIM_PERIOD + CLAIM_WINDOW;
    return { kind: "window", secondsLeft: Math.max(0, end - nowSec) };
  }
  if (elapsed < CLAIM_PERIOD) {
    return { kind: "accrual", secondsLeft: Math.max(0, CLAIM_PERIOD - elapsed) };
  }
  // Past accrual but window not marked open yet (or just closed)
  const windowEnd = status.cycleStart + CLAIM_PERIOD + CLAIM_WINDOW;
  if (nowSec < windowEnd) {
    return { kind: "window", secondsLeft: Math.max(0, windowEnd - nowSec) };
  }
  return { kind: "between", secondsLeft: 0 };
}

export function fmtCountdown(sec: number) {
  if (sec < 0) sec = 0;
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${d}d ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export { toNano, Address, Cell, OP };
