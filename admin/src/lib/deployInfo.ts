/**
 * Deploy snapshot + address book for Command Deck status lights.
 * Source of truth for addresses: deployments/mainnet.json (+ config MAINNET_WALLETS).
 */
import mainnet from "../../../deployments/mainnet.json";
import {
  DEFAULT_KEEPER,
  EXPLORER,
  MAINNET_WALLETS,
  MINTER,
  NETWORK,
  OWNER_JETTON_WALLET,
  TONAPI_BASE,
} from "../config";

export type DeploySnapshot = {
  network: string;
  deployedAt: string;
  minter: string;
  owner: string;
  ownerJettonWallet: string;
  keeper: string;
  dexPoolVault: string;
  dedustPool: string;
  poolOwner: string;
  explorer: string;
  launchFlags: {
    trading: boolean;
    sells: boolean;
    claim: boolean;
    note?: string;
  };
  tradingFlags?: {
    isTradingEnabled?: boolean;
    isSellEnabled?: boolean;
    maxBuyLimitBp?: number;
    maxSellLimitBp?: number;
    sellTaxBp?: number;
    note?: string;
  };
  dexLimits?: {
    maxBuyLimitBp?: number;
    maxSellLimitBp?: number;
    sellTaxBp?: number;
    isDexLimitsEnabled?: boolean;
  };
  lpCreatedAt?: string;
  liquidityAmount?: string;
};

export const DEPLOY: DeploySnapshot = {
  network: (mainnet as { network?: string }).network || NETWORK,
  deployedAt: (mainnet as { deployedAt?: string }).deployedAt || "—",
  minter: (mainnet as { minter?: string }).minter || MINTER,
  owner:
    (mainnet as { owner?: string }).owner || MAINNET_WALLETS.ownerBounceable,
  ownerJettonWallet:
    (mainnet as { ownerJettonWallet?: string }).ownerJettonWallet ||
    OWNER_JETTON_WALLET,
  keeper: DEFAULT_KEEPER,
  dexPoolVault:
    (mainnet as { dedustAwnVault?: string }).dedustAwnVault ||
    (mainnet as { dexPool?: string }).dexPool ||
    MAINNET_WALLETS.dedustAwnVault,
  dedustPool:
    (mainnet as { dedustPool?: string }).dedustPool || MAINNET_WALLETS.dedustPool,
  poolOwner:
    (mainnet as { poolOwner?: string }).poolOwner ||
    (mainnet as { simulatedPoolOwner?: string }).simulatedPoolOwner ||
    MAINNET_WALLETS.poolOwner,
  explorer: (mainnet as { explorer?: string }).explorer || `${EXPLORER}/${MINTER}`,
  launchFlags: (mainnet as { launchFlags?: DeploySnapshot["launchFlags"] })
    .launchFlags || {
    trading: false,
    sells: false,
    claim: false,
  },
  tradingFlags: (mainnet as { tradingFlags?: DeploySnapshot["tradingFlags"] })
    .tradingFlags,
  dexLimits: (mainnet as { dexLimits?: DeploySnapshot["dexLimits"] }).dexLimits,
  lpCreatedAt: (mainnet as { lpCreatedAt?: string }).lpCreatedAt,
  liquidityAmount: (mainnet as { liquidityAmount?: string }).liquidityAmount,
};

export type AddrBookRow = {
  key: string;
  label: string;
  address: string;
};

export function deployAddressBook(): AddrBookRow[] {
  return [
    { key: "minter", label: "Minter", address: DEPLOY.minter },
    { key: "owner", label: "Owner", address: DEPLOY.owner },
    {
      key: "ownerJw",
      label: "Owner JW",
      address: DEPLOY.ownerJettonWallet,
    },
    { key: "vault", label: "DeDust vault", address: DEPLOY.dexPoolVault },
    { key: "pool", label: "DeDust pool", address: DEPLOY.dedustPool },
    { key: "lpOwner", label: "LP / pool side", address: DEPLOY.poolOwner },
    { key: "keeper", label: "Keeper", address: DEPLOY.keeper },
  ];
}

export function shortAddr(addr: string, head = 6, tail = 4): string {
  if (!addr || addr.length < head + tail + 2) return addr || "—";
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

export type AccountHealth = "active" | "uninit" | "nonexist" | "unknown" | "error";

export async function fetchAccountHealth(
  address: string,
): Promise<AccountHealth> {
  try {
    const url = `${TONAPI_BASE}/accounts/${encodeURIComponent(address)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return "error";
    const data = (await res.json()) as { status?: string };
    const st = (data.status || "").toLowerCase();
    if (st === "active") return "active";
    if (st === "uninit" || st === "uninitialized") return "uninit";
    if (st === "nonexist") return "nonexist";
    return st ? (st as AccountHealth) : "unknown";
  } catch {
    return "error";
  }
}

export async function fetchDeployHealthMap(
  addresses: AddrBookRow[],
): Promise<Record<string, AccountHealth>> {
  const entries = await Promise.all(
    addresses.map(async (row) => {
      const health = await fetchAccountHealth(row.address);
      return [row.key, health] as const;
    }),
  );
  return Object.fromEntries(entries);
}
