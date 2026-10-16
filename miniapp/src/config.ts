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
