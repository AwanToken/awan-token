/** Live admin defaults — mainnet */
export const NETWORK = (import.meta.env.VITE_NETWORK as "testnet" | "mainnet") || "mainnet";

export const MINTER =
  import.meta.env.VITE_MINTER ||
  "EQA2T-nreKcnBzZmQfAJfEXCBdx8qPGVi8zGIUhFMtYi1vPs";

export const OWNER_JETTON_WALLET =
  import.meta.env.VITE_OWNER_JETTON_WALLET ||
  "EQBQvDCDbXzvdiPplAVP4qqf7iZZX8fmZiucYTNJkZa9q2tm";

export const RPC =
  import.meta.env.VITE_RPC ||
  (NETWORK === "mainnet"
    ? "https://toncenter.com/api/v2/jsonRPC"
    : "https://testnet.toncenter.com/api/v2/jsonRPC");

/** CORS-friendly TonAPI REST — preferred for browser get-methods (toncenter 429s). */
export const TONAPI_BASE =
  import.meta.env.VITE_TONAPI ||
  (NETWORK === "mainnet" ? "https://tonapi.io/v2" : "https://testnet.tonapi.io/v2");

export const EXPLORER =
  NETWORK === "mainnet"
    ? "https://tonviewer.com"
    : "https://testnet.tonviewer.com";

export const CLAIM_PERIOD = 604800;
export const CLAIM_WINDOW = 86400;
export const DECIMALS = 9n;

export const MAINNET_WALLETS = {
  owner: "UQA1G4lmw34UsL4P30mvW4k8WSCs1RHUkjXcp1DjE66L1ss9",
  ownerBounceable: "EQA1G4lmw34UsL4P30mvW4k8WSCs1RHUkjXcp1DjE66L1pb4",
  keeper: "UQCKBs_vJoZzhIrcz46G4KieMA1xRPTA7ALT0KOnz-PhRou6",
  /** DeDust AWN vault (SetDexPool / LP liquidity). */
  dedustAwnVault: "EQArKCfnuryYlSR5J8Dx6VeKEwjZjpkLUdb-JioOOuyPQbP-",
  /** Simulated pool owner that still holds LP-side AWN. */
  poolOwner: "EQATJFmSr5Jd8cP62mHuvcnqqPjFqRyxT5dgpOGkO6hlTl2-",
  dedustPool: "EQDRwZaP6FX2J-VMQxVRydeTAWDKrVomkai5G-Iwji43X8oo",
};

export const TOTAL_SUPPLY_AWN = 1_000_000_000;

/** Special wallets labeled on the holders table (where tokens sit). */
export const KNOWN_AWN_WALLETS: {
  address: string;
  role:
    | "owner"
    | "liquidity_vault"
    | "lp_pool_owner"
    | "dedust_pool"
    | "keeper";
}[] = [
  { address: MAINNET_WALLETS.owner, role: "owner" },
  { address: MAINNET_WALLETS.ownerBounceable, role: "owner" },
  { address: MAINNET_WALLETS.dedustAwnVault, role: "liquidity_vault" },
  { address: MAINNET_WALLETS.poolOwner, role: "lp_pool_owner" },
  { address: MAINNET_WALLETS.dedustPool, role: "dedust_pool" },
  { address: MAINNET_WALLETS.keeper, role: "keeper" },
];

/** Default Keeper destination for SweepTaxJettons (editable in UI). */
export const DEFAULT_KEEPER = MAINNET_WALLETS.keeper;

/**
 * Dead / burn address for ownership renounce (ChangeOwner).
 * TON zero address — irreversible once confirmed on-chain.
 */
export const DEAD_OWNER = "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c";

/** Shared miniapp holders registry (wallet · @tg · $AWN). */
export const HOLDERS_API_URL =
  import.meta.env.VITE_HOLDERS_ENDPOINT ||
  "https://awn-miniapp-vercel.vercel.app/api/holders";

/** Shared mined-$AWN claim queue (players ≥100 → Owner BatchTransfer). */
export const MINED_QUEUE_API_URL =
  import.meta.env.VITE_MINED_QUEUE_ENDPOINT ||
  "https://awn-miniapp-vercel.vercel.app/api/mined-queue";
