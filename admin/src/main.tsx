import "./polyfills";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TonConnectUIProvider } from "@tonconnect/ui-react";
import App from "./App";
import "./index.css";

/**
 * TonConnect requires a publicly reachable HTTPS manifest.
 * Localhost URLs fail when the wallet (Tonkeeper, etc.) tries to fetch them.
 * Hosted on the miniapp Vercel origin (Netlify awantoken.netlify.app is dead/404).
 */
const VERCEL_ORIGIN = "https://awn-miniapp-vercel.vercel.app";
/** Live HTTPS manifest (Netlify is 404). command-deck-manifest is on Vercel prod. */
const manifestUrl =
  (import.meta.env.VITE_TONCONNECT_MANIFEST as string | undefined) ||
  `${VERCEL_ORIGIN}/command-deck-manifest.json`;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TonConnectUIProvider
      manifestUrl={manifestUrl}
      actionsConfiguration={{
        returnStrategy: "back",
        twaReturnUrl: VERCEL_ORIGIN as `${string}://${string}`,
      }}
    >
      <App />
    </TonConnectUIProvider>
  </StrictMode>,
);
