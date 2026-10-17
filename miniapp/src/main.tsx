import "./polyfills";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TonConnectUIProvider } from "@tonconnect/ui-react";
import App from "./App";
import { I18nProvider } from "./i18n/I18nContext";
import { initTelegram } from "./lib/telegram";
import "./index.css";

initTelegram();

/**
 * TonConnect wallets (Keeper, etc.) need a public HTTPS manifest.
 * Localhost / http previews cannot complete the handshake — use production manifest
 * and open the live Telegram Mini App / Vercel URL to connect.
 */
const PROD_ORIGIN = "https://awn-miniapp-vercel.vercel.app";
const pageOrigin = window.location.origin;
const isLocalHttp =
  pageOrigin.startsWith("http://localhost") ||
  pageOrigin.startsWith("http://127.") ||
  pageOrigin.startsWith("http://192.168.") ||
  pageOrigin.startsWith("http://10.");
const manifestUrl = isLocalHttp
  ? `${PROD_ORIGIN}/tonconnect-manifest.json`
  : `${pageOrigin}/tonconnect-manifest.json`;

/** Prefer Telegram Mini App deep-link return when available. */
const tg = window.Telegram?.WebApp;
const twaReturnUrl = (
  isLocalHttp
    ? PROD_ORIGIN
    : (tg as { initDataUnsafe?: unknown } | undefined)?.initDataUnsafe
      ? window.location.href
      : pageOrigin
) as `${string}://${string}`;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TonConnectUIProvider
      manifestUrl={manifestUrl}
      actionsConfiguration={{
        returnStrategy: "back",
        twaReturnUrl,
      }}
    >
      <I18nProvider>
        <App />
      </I18nProvider>
    </TonConnectUIProvider>
  </StrictMode>,
);
