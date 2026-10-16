import {
  Address,
  beginCell,
  Cell,
  toNano,
  TupleBuilder,
  TupleReader,
} from "@ton/core";
import { TonClient } from "@ton/ton";
import { DECIMALS, MINTER, RPC } from "../config";

/** Opcodes from compiled AwanToken */
const OP = {
  EnableTrading: 1455545190,
  SetSellEnabled: 3304390616,
  SetDexLimitsEnabled: 2892774684,
  SetBuyLimitBp: 589831199,
  SetSellLimitBp: 790228406,
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
  // Some clients nest as { stack: TupleReader | items }
  const nested = stack && typeof stack === "object" ? (stack as { stack?: unknown }).stack : undefined;
  if (nested instanceof TupleReader) return nested;
  if (nested) return asReader(nested);
  throw new Error("items is not iterable");
}

export async function fetchLiveState(): Promise<LiveState> {
  const c = client();
  const minter = Address.parse(MINTER);

  const trading = await c.runMethod(minter, "get_trading_state");
  const tr = asReader(trading.stack);
  // AwanConfig: bools, dexPool, buy/sell/possession bp, sellTax, supply, poolBal, maxBatch, admin
  const isTradingEnabled = tr.readBoolean();
  const isSellEnabled = tr.readBoolean();
  const isDexLimitsEnabled = tr.readBoolean();
  const dexPool = tr.readAddressOpt();
  const maxBuyLimitBp = Number(tr.readNumber());
  const maxSellLimitBp = Number(tr.readNumber());
  tr.readNumber(); // possessionLimitBp
  const sellTaxBp = Number(tr.readNumber());
  tr.readBigNumber(); // totalSupply
  const poolJettonBalance = tr.readBigNumber();
  tr.readBigNumber(); // maxBatchTransferAmount
  tr.readAddress(); // admin

  const claim = await c.runMethod(minter, "get_claim_status");
  const cr = asReader(claim.stack);
  const cycleId = Number(cr.readNumber());
  const cycleStart = Number(cr.readNumber());
  const claimWindowOpen = cr.readBoolean();
  const claimWindowEnd = Number(cr.readNumber());
  cr.readBigNumber(); // treasury in claim status
  cr.readBigNumber(); // snapshot
  cr.readBoolean(); // sells
  const claimProgramActive = cr.readBoolean();

  const treas = await c.runMethod(minter, "get_treasury_balance");
  const treasury = asReader(treas.stack).readBigNumber();

  const tax = await c.runMethod(minter, "get_pending_tax_jettons");
  const pendingTaxJettons = asReader(tax.stack).readBigNumber();

  const jd = await c.runMethod(minter, "get_jetton_data");
  const jr = asReader(jd.stack);
  const totalSupply = jr.readBigNumber();

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
  const c = client();
  const tb = new TupleBuilder();
  tb.writeAddress(Address.parse(addr));
  const res = await c.runMethod(Address.parse(MINTER), "get_holder_info", tb.build());
  const r = asReader(res.stack);
  return {
    balance: r.readBigNumber(),
    lastUpdate: Number(r.readNumber()),
    minBalancePeriod: r.readBigNumber(),
    periodStartBalance: r.readBigNumber(),
    claimedCycleId: Number(r.readNumber()),
  };
}

export async function isBlacklisted(addr: string) {
  const c = client();
  const tb = new TupleBuilder();
  tb.writeAddress(Address.parse(addr));
  const res = await c.runMethod(Address.parse(MINTER), "is_blacklisted", tb.build());
  return asReader(res.stack).readBoolean();
}

export { toNano, Address, Cell };
