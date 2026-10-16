/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NETWORK?: "testnet" | "mainnet";
  readonly VITE_MINTER?: string;
  readonly VITE_OWNER_JETTON_WALLET?: string;
  readonly VITE_RPC?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
