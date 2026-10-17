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
import { DECIMALS, MINTER, RPC, TONAPI_BASE } from "../config";

/** Opcodes from compiled AwanToken */
const OP = {
  EnableTrading: 1455545190,
  SetSellEnabled: 3304390616,
  SetDexLimitsEnabled: 2892774684,
  SetBuyLimitBp: 589831199,
  SetSellLimitBp: 790228406,
  SetMaxSellAbsolute: 875762341,
  SetSellTaxBp: 1144337993,
  SetBlacklist: 2072896655,
  PushWalletConfig: 677324105,
  DepositTreasury: 1591581524,
  ForceOpenClaimWindow: 3457960893,
  ForceCloseClaimWindow: 3626164904,
  SetClaimPeriodDays: 3597104292,
  SetClaimProgramActive: 402150479,
  SweepTaxJettons: 874055634,
  ChangeOwner: 2174598809,
  JettonTransfer: 260734629,
  BatchTransfer: 4166427418,
} as const;

export function client() {
  return new TonClient({ endpoint: RPC });
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

function storeOp(op: number) {
  return beginCell().storeUint(op, 32).storeUint(nextQ(), 64);
}

export function bodyEnableTrading(): Cell {
  return storeOp(OP.EnableTrading).endCell();
}

export function bodySetSell(enabled: boolean): Cell {
  return storeOp(OP.SetSellEnabled).storeBit(enabled).endCell();
}

export function bodyDexLimits(enabled: boolean): Cell {
  return storeOp(OP.SetDexLimitsEnabled).storeBit(enabled).endCell();
}

/** Owner-only: max buy per tx as bp of vault JW AWN (1..10000). */
export function bodySetBuyLimitBp(bp: number): Cell {
  if (!Number.isInteger(bp) || bp <= 0 || bp > 10_000) {
    throw new Error("Buy limit bp must be 1..10000");
  }
  return storeOp(OP.SetBuyLimitBp).storeUint(bp, 16).endCell();
}

/** Owner-only: max sell per tx as bp of pool AWN (1..10000). */
export function bodySetSellLimitBp(bp: number): Cell {
  if (!Number.isInteger(bp) || bp <= 0 || bp > 10_000) {
    throw new Error("Sell limit bp must be 1..10000");
  }
  return storeOp(OP.SetSellLimitBp).storeUint(bp, 16).endCell();
}

/**
 * Owner-only: hard ceiling of $AWN sold into pool per tx (raw 9-dec units).
 * Pass 0n to disable the absolute cap (bp / possession limits still apply).
 * Requires redeployed minter that includes SetMaxSellAbsolute.
 */
export function bodySetMaxSellAbsolute(rawAmount: bigint): Cell {
  if (rawAmount < 0n) {
    throw new Error("Absolute sell amount must be >= 0");
  }
  return storeOp(OP.SetMaxSellAbsolute).storeCoins(rawAmount).endCell();
}

/**
 * Owner-only: sell tax in bp of sold $AWN (0..1000 = 0..10%).
 * Tax lands on minter JW → keeper swaps to TON → DepositTreasury (treasury funding).
 */
export function bodySetSellTaxBp(bp: number): Cell {
  if (!Number.isInteger(bp) || bp < 0 || bp > 1000) {
    throw new Error("Sell tax bp must be integer 0..1000");
  }
  return storeOp(OP.SetSellTaxBp).storeUint(bp, 16).endCell();
}

export function bodyBlacklist(account: string, blocked: boolean): Cell {
  return storeOp(OP.SetBlacklist)
    .storeAddress(Address.parse(account))
    .storeBit(blocked)
    .endCell();
}

export function bodyPushConfig(walletOwner: string): Cell {
  return storeOp(OP.PushWalletConfig)
    .storeAddress(Address.parse(walletOwner))
    .endCell();
}

export function bodyDepositTreasury(): Cell {
  return storeOp(OP.DepositTreasury).endCell();
}

/** Owner-only: open 24h claim window now (snapshot = treasury). */
export function bodyForceOpenClaimWindow(): Cell {
  return storeOp(OP.ForceOpenClaimWindow).endCell();
}

/** Owner-only: close claim window early. */
export function bodyForceCloseClaimWindow(): Cell {
  return storeOp(OP.ForceCloseClaimWindow).endCell();
}

/** Owner-only: accrual period 1 / 3 / 5 / 7 days. */
export function bodySetClaimPeriodDays(days: 1 | 3 | 5 | 7): Cell {
  return storeOp(OP.SetClaimPeriodDays).storeUint(days, 8).endCell();
}

/** Owner-only: arm / disarm claim program. */
export function bodySetClaimProgramActive(enabled: boolean): Cell {
  return storeOp(OP.SetClaimProgramActive).storeBit(enabled).endCell();
}

/** amount = 0n → contract sweeps all pendingTaxJettons */
export function bodySweepTaxJettons(destination: string, amount: bigint): Cell {
  return storeOp(OP.SweepTaxJettons)
    .storeAddress(Address.parse(destination))
    .storeCoins(amount)
    .endCell();
}

export function bodyChangeOwner(newOwner: string): Cell {
  return storeOp(OP.ChangeOwner)
    .storeAddress(Address.parse(newOwner))
    .endCell();
}

export function bodyJettonTransfer(
  amount: bigint,
  destination: string,
  response: string,
): Cell {
  return beginCell()
    .storeUint(OP.JettonTransfer, 32)
    .storeUint(nextQ(), 64)
    .storeCoins(amount)
    .storeAddress(Address.parse(destination))
    .storeAddress(Address.parse(response))
    .storeBit(false) // customPayload null
    .storeCoins(toNano("0.01"))
    .storeBit(false) // forward payload as empty slice in-cell
    .endCell();
}

export function bodyBatchTransfer(items: { to: string; amount: bigint }[]): Cell {
  if (items.length < 1 || items.length > 150) throw new Error("Batch 1..150");
  let payload = beginCell().storeUint(items.length, 8);
  for (const it of items) {
    payload = payload.storeAddress(Address.parse(it.to)).storeCoins(it.amount);
  }
  return storeOp(OP.BatchTransfer).storeRef(payload.endCell()).endCell();
}

export type LiveState = {
  isTradingEnabled: boolean;
  isSellEnabled: boolean;
  isDexLimitsEnabled: boolean;
  dexPool: string | null;
  maxBuyLimitBp: number;
  maxSellLimitBp: number;
  sellTaxBp: number;
  poolJettonBalance: bigint;
  treasury: bigint;
  pendingTaxJettons: bigint;
  totalSupply: bigint;
  cycleStart: number;
  claimWindowOpen: boolean;
  claimProgramActive: boolean;
  cycleId: number;
  claimWindowEnd: number;
};

/** @ton/ton v15+ may return TupleReader already; older returns raw stack. */
function asReader(stack: unknown): TupleReader {
  if (stack instanceof TupleReader) return stack;
  if (stack && typeof stack === "object" && "items" in (stack as object)) {
    return new TupleReader(stack as never);
  }
  if (Array.isArray(stack)) return new TupleReader(stack as never);
  const nested = stack && typeof stack === "object" ? (stack as { stack?: unknown }).stack : undefined;
  if (nested instanceof TupleReader) return nested;
  if (nested) return asReader(nested);
  throw new Error("items is not iterable");
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
};

function toFriendly(addr: string | Address): string {
  const a = typeof addr === "string" ? Address.parse(addr) : addr;
  return a.toString({ urlSafe: true, bounceable: true, testOnly: false });
}

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
      return { type: "slice", cell };
    }
    throw new Error(`Unsupported tonapi stack item: ${item.type}`);
  });
}

async function runMethodTonapi(
  account: string,
  method: string,
  addressArg?: string,
): Promise<TupleReader> {
  const friendly = toFriendly(account);
  const url = `${TONAPI_BASE}/blockchain/accounts/${encodeURIComponent(friendly)}/methods/${encodeURIComponent(method)}`;
  const init: RequestInit | undefined = addressArg
    ? {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ args: [{ type: "slice", value: toFriendly(addressArg) }] }),
      }
    : { headers: { Accept: "application/json" } };
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`tonapi ${res.status}: ${text.slice(0, 160) || res.statusText}`);
  }
  const data = (await res.json()) as TonapiMethodResult;
  if (!data.success && data.exit_code !== 0) {
    throw new Error(`tonapi ${method} exit ${data.exit_code}`);
  }
  return new TupleReader(tonapiStackToTuple(data.stack ?? []));
}

/** Browser-safe get-method: TonAPI first (toncenter CORS/429), then JSON-RPC. */
async function runGetMethod(
  account: string,
  method: string,
  addressArg?: string,
): Promise<TupleReader> {
  try {
    return await runMethodTonapi(account, method, addressArg);
  } catch (tonapiErr) {
    try {
      const c = client();
      const tb = addressArg ? new TupleBuilder() : undefined;
      if (tb && addressArg) tb.writeAddress(Address.parse(addressArg));
      const res = await c.runMethod(
        Address.parse(account),
        method,
        tb?.build(),
      );
      return asReader(res.stack);
    } catch (rpcErr) {
      const a = tonapiErr instanceof Error ? tonapiErr.message : String(tonapiErr);
      const b = rpcErr instanceof Error ? rpcErr.message : String(rpcErr);
      throw new Error(`${a} · ${b}`);
    }
  }
}

/** TonAPI account balance in nanotons (for Keeper wallet display). */
export async function fetchAccountTonBalance(address: string): Promise<bigint> {
  const url = `${TONAPI_BASE}/accounts/${encodeURIComponent(address)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`tonapi account ${res.status}`);
  const data = (await res.json()) as { balance?: number | string };
  return BigInt(data.balance ?? 0);
}

export function fromNanoTon(n: bigint): string {
  const neg = n < 0n;
  const v = neg ? -n : n;
  const whole = v / 1_000_000_000n;
  const frac = v % 1_000_000_000n;
  const fracStr = frac.toString().padStart(9, "0").replace(/0+$/, "");
  const s = fracStr ? `${whole}.${fracStr}` : whole.toString();
  return neg ? `-${s}` : s;
}

export async function fetchLiveState(): Promise<LiveState> {
  const tr = await runGetMethod(MINTER, "get_trading_state");
  const isTradingEnabled = tr.readBoolean();
  const isSellEnabled = tr.readBoolean();
  const isDexLimitsEnabled = tr.readBoolean();
  const dexPool = tr.readAddressOpt();
  const maxBuyLimitBp = Number(tr.readNumber());
  const maxSellLimitBp = Number(tr.readNumber());
  tr.readNumber(); // possessionLimitBp
  const sellTaxBp = Number(tr.readNumber());
  tr.readBigNumber(); // totalSupply (also in get_jetton_data)
  const poolJettonBalance = tr.readBigNumber();
  tr.readBigNumber(); // maxBatchTransferAmount
  tr.readAddress(); // admin
  // Skip optional trailing maxSellAbsolute if present (deck does not surface it).
  try {
    tr.readBigNumber();
  } catch {
    /* pre-redeploy minters omit the field */
  }

  const cr = await runGetMethod(MINTER, "get_claim_status");
  const cycleId = Number(cr.readNumber());
  const cycleStart = Number(cr.readNumber());
  const claimWindowOpen = cr.readBoolean();
  const claimWindowEnd = Number(cr.readNumber());
  cr.readBigNumber(); // treasury
  cr.readBigNumber(); // snapshot
  cr.readBoolean(); // sells
  const claimProgramActive = cr.readBoolean();

  const treasury = (await runGetMethod(MINTER, "get_treasury_balance")).readBigNumber();
  const pendingTaxJettons = (
    await runGetMethod(MINTER, "get_pending_tax_jettons")
  ).readBigNumber();
  const totalSupply = (await runGetMethod(MINTER, "get_jetton_data")).readBigNumber();

  return {
    isTradingEnabled,
    isSellEnabled,
    isDexLimitsEnabled,
    dexPool: dexPool ? dexPool.toString() : null,
    maxBuyLimitBp,
    maxSellLimitBp,
    sellTaxBp,
    poolJettonBalance,
    treasury,
    pendingTaxJettons,
    totalSupply,
    cycleStart,
    claimWindowOpen,
    claimProgramActive,
    cycleId,
    claimWindowEnd,
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

export async function isBlacklisted(addr: string) {
  return (await runGetMethod(MINTER, "is_blacklisted", addr)).readBoolean();
}

export { toNano, Address, Cell };
