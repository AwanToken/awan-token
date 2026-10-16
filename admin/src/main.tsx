import "./polyfills";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TonConnectUIProvider } from "@tonconnect/ui-react";
import App from "./App";
import "./index.css";

/**
 * TonConnect requires a publicly reachable HTTPS manifest.
 * Localhost URLs fail when the wallet (Tonkeeper, etc.) tries to fetch them.
 * Hosted on the miniapp Netlify origin so Connect works from admin on :5173.
 */
/** Prefer dedicated deck manifest; fall back to live miniapp manifest (already on Netlify HTTPS). */
const manifestUrl =
  (import.meta.env.VITE_TONCONNECT_MANIFEST as string | undefined) ||
  "https://awantoken.netlify.app/tonconnect-manifest.json";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TonConnectUIProvider
      manifestUrl={manifestUrl}
      actionsConfiguration={{
        returnStrategy: "back",
        twaReturnUrl: "https://awantoken.netlify.app" as `${string}://${string}`,
      }}
    >
      <App />
    </TonConnectUIProvider>
  </StrictMode>,
);
