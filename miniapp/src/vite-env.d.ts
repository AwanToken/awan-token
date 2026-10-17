/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NETWORK?: string;
  readonly VITE_MINTER?: string;
  readonly VITE_RPC?: string;
  readonly VITE_TONAPI?: string;
  readonly VITE_TREASURY_OR_KEEPER?: string;
  readonly VITE_MANIFEST_URL?: string;
  readonly VITE_HOLDERS_ENDPOINT?: string;
  readonly VITE_MINED_QUEUE_ENDPOINT?: string;
  readonly VITE_STON_FI_BUY_URL?: string;
  readonly VITE_STON_FI_SELL_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  close: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  MainButton: {
    text: string;
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  };
  themeParams: Record<string, string>;
  colorScheme: "light" | "dark";
  initDataUnsafe?: { user?: { id: number; first_name?: string; username?: string } };
  HapticFeedback?: {
    impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
  };
  openLink?: (url: string) => void;
  openTelegramLink?: (url: string) => void;
}

interface Window {
  Telegram?: { WebApp: TelegramWebApp };
}
