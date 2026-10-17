/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NETWORK?: "testnet" | "mainnet";
  readonly VITE_MINTER?: string;
  readonly VITE_OWNER_JETTON_WALLET?: string;
  readonly VITE_RPC?: string;
  readonly VITE_HOLDERS_ENDPOINT?: string;
  readonly VITE_MINED_QUEUE_ENDPOINT?: string;
  readonly VITE_TONAPI?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
