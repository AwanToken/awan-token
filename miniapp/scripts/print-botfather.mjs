#!/usr/bin/env node
/**
 * Prints BotFather + TonConnect steps for publishing the Mini App.
 * Usage: node scripts/print-botfather.mjs [https://your-public-url]
 */
const url = (process.argv[2] || "https://YOUR-TUNNEL-OR-DOMAIN").replace(/\/$/, "");

console.log(`
═══════════════════════════════════════════════════════════
  $AWN Mini App — go live (Telegram + TonConnect)
═══════════════════════════════════════════════════════════

Public URL:  ${url}
Manifest:    ${url}/tonconnect-manifest.json
Icon:        ${url}/awn-logo.png

── 1) Tunnel / domain ─────────────────────────────────────
  Dev (HTTPS tunnel → local Vite :5174):
    npm run tunnel   (from miniapp/)
  Or production host: deploy miniapp/dist to HTTPS domain.

── 2) @BotFather ──────────────────────────────────────────
  1. Open Telegram → @BotFather
  2. /newbot  (or use an existing bot)
  3. /setmenubutton  → choose bot → Web App
       URL = ${url}
  4. Optional Main Mini App:
       /setname … /mybots → Bot Settings → Configure Mini App
       URL = ${url}
  5. Direct link for users:
       https://t.me/YOUR_BOT_USERNAME?startapp

── 3) TonConnect ──────────────────────────────────────────
  Wallets fetch: ${url}/tonconnect-manifest.json
  After changing host, hard-refresh the Mini App (⋮ → Reload).
  Tonkeeper: enable TESTNET for this phase.

── 4) Env (optional, production build) ────────────────────
  miniapp/.env :
    VITE_NETWORK=testnet
    VITE_MINTER=EQBeUwYSlqxeo1lBGIeStqXPHvyNkZkz8VcykAdPLVF10hzW
    VITE_MANIFEST_URL=${url}/tonconnect-manifest.json

── 5) Do NOT yet ──────────────────────────────────────────
  • Mainnet
  • TON into DEX pool (owner will tell you when)

═══════════════════════════════════════════════════════════
`);
