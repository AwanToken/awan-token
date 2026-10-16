/** Mini App defaults — mainnet live minter */
export const NETWORK = (import.meta.env.VITE_NETWORK as "testnet" | "mainnet") || "mainnet";

export const MINTER =
  import.meta.env.VITE_MINTER ||
  "EQA2T-nreKcnBzZmQfAJfEXCBdx8qPGVi8zGIUhFMtYi1vPs";

/** Minter owner — cannot ClaimReward (holds residual / launch supply). */
export const TOKEN_OWNER =
  import.meta.env.VITE_TOKEN_OWNER ||
  "EQA1G4lmw34UsL4P30mvW4k8WSCs1RHUkjXcp1DjE66L1pb4";

/**
 * JSON-RPC fallback (TonClient). toncenter often 429s / is flaky from browsers;
 * primary reads go through TONAPI_BASE instead.
 */
export const RPC =
  import.meta.env.VITE_RPC ||
  (NETWORK === "mainnet"
    ? "https://toncenter.com/api/v2/jsonRPC"
    : "https://testnet.toncenter.com/api/v2/jsonRPC");

/** CORS-friendly TonAPI REST base used for balances + get-methods in the browser. */
export const TONAPI_BASE =
  import.meta.env.VITE_TONAPI ||
  (NETWORK === "mainnet" ? "https://tonapi.io/v2" : "https://testnet.tonapi.io/v2");

export const EXPLORER =
  NETWORK === "mainnet"
    ? "https://tonviewer.com"
    : "https://testnet.tonviewer.com";

/** Keeper / treasury receiving upgrade shop TON payments (configurable). */
export const TREASURY_OR_KEEPER =
  import.meta.env.VITE_TREASURY_OR_KEEPER ||
  "UQCKBs_vJoZzhIrcz46G4KieMA1xRPTA7ALT0KOnz-PhRou6";

export const MANIFEST_URL =
  import.meta.env.VITE_MANIFEST_URL ||
  `${typeof window !== "undefined" ? window.location.origin : ""}/tonconnect-manifest.json`;

/** Match contract: 7d accrual + 24h claim window */
export const CLAIM_PERIOD = 604800;
export const CLAIM_WINDOW = 86400;
export const DECIMALS = 9n;

export const PAIR_LABEL = "$AWN / TON";

/** DeDust volatile pool (mainnet) — used for on-chain buy-limit reserve quotes only. */
export const DEDUST_POOL =
  import.meta.env.VITE_DEDUST_POOL ||
  "EQDRwZaP6FX2J-VMQxVRydeTAWDKrVomkai5G-Iwji43X8oo";

/**
 * Ston.fi swap deep-links (primary CTA). Prefer Ston over DeDust so over-limit
 * buys fail early instead of stranding TON in the pool (DeDust bounce 10374).
 * @see https://guide.ston.fi — `ft` / `tt` = TON symbol or jetton master.
 */
export const STON_FI_BUY_URL =
  import.meta.env.VITE_STON_FI_BUY_URL ||
  `https://app.ston.fi/swap?ft=TON&tt=${MINTER}`;

export const STON_FI_SELL_URL =
  import.meta.env.VITE_STON_FI_SELL_URL ||
  `https://app.ston.fi/swap?ft=${MINTER}&tt=TON`;

/** @deprecated Prefer STON_FI_BUY_URL — kept for env overrides / legacy. */
export const DEDUST_SWAP_URL =
  import.meta.env.VITE_DEDUST_SWAP_URL || STON_FI_BUY_URL;

/**
 * Off-chain game-mined $AWN threshold before a player can queue a claim.
 * Settlement is owner BatchTransfer from claim-pool path — not free mint.
 */
export const MINED_CLAIM_THRESHOLD = 100;
