import "./polyfills";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TonConnectUIProvider } from "@tonconnect/ui-react";
import App from "./App";
import { I18nProvider } from "./i18n/I18nContext";
import { initTelegram } from "./lib/telegram";
import "./index.css";

initTelegram();

/** Live origin — works on localhost, LAN IP, ngrok, and Telegram WebView hosts. */
const manifestUrl = `${window.location.origin}/tonconnect-manifest.json`;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TonConnectUIProvider
      manifestUrl={manifestUrl}
      actionsConfiguration={{
        returnStrategy: "back",
        twaReturnUrl: window.location.href as `${string}://${string}`,
      }}
    >
      <I18nProvider>
        <App />
      </I18nProvider>
    </TonConnectUIProvider>
  </StrictMode>,
);
