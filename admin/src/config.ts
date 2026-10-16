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

export const EXPLORER =
  NETWORK === "mainnet"
    ? "https://tonviewer.com"
    : "https://testnet.tonviewer.com";

export const CLAIM_PERIOD = 604800;
export const CLAIM_WINDOW = 86400;
export const DECIMALS = 9n;

export const MAINNET_WALLETS = {
  owner: "UQA1G4lmw34UsL4P30mvW4k8WSCs1RHUkjXcp1DjE66L1ss9",
  keeper: "UQCKBs_vJoZzhIrcz46G4KieMA1xRPTA7ALT0KOnz-PhRou6",
};

/** Default Keeper destination for SweepTaxJettons (editable in UI). */
export const DEFAULT_KEEPER = MAINNET_WALLETS.keeper;

/**
 * Dead / burn address for ownership renounce (ChangeOwner).
 * TON zero address — irreversible once confirmed on-chain.
 */
export const DEAD_OWNER = "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c";
