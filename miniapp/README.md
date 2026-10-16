# $AWN Mini App — Neon Siege

Telegram Mini App scaffold for **$AWN**: Trade chart, weekly claim, Hangar + **AWN: Neon Siege** (original vertical shmup), upgrades shop, and local leaderboard.

Visual inspiration for pacing only: classic vertical shooters (“classic shmup pacing”). No third-party sprites or names.

## Run locally

```bash
cd miniapp
npm install
npm run dev
```

Or from repo root: `npm run miniapp` (port **5174**).

Open `http://localhost:5174` in a browser, or tunnel (ngrok/cloudflared) and set that HTTPS URL as the BotFather Web App URL.

## Telegram (BotFather)

1. Create a bot with [@BotFather](https://t.me/BotFather).
2. `/newapp` → pick the bot → set Web App URL to your HTTPS tunnel (or hosted URL).
3. Manifest: `public/tonconnect-manifest.json` — update `url` / `iconUrl` to the public origin.
4. Optional: set `VITE_MANIFEST_URL` to the absolute manifest URL.

The app calls `Telegram.WebApp.ready()` + `expand()` when opened inside Telegram.

## TonConnect

- Uses `@tonconnect/ui-react` (Tonkeeper, etc.).
- Connect button is in the header on every tab.
- Network defaults to **testnet** via `VITE_NETWORK`.

Copy `.env.example` → `.env` and adjust:

| Variable | Purpose |
|----------|---------|
| `VITE_MINTER` | Jetton minter (ClaimReward target) |
| `VITE_NETWORK` | `testnet` / `mainnet` |
| `VITE_RPC` | toncenter JSON-RPC |
| `VITE_TREASURY_OR_KEEPER` | Upgrade shop TON destination |
| `VITE_MANIFEST_URL` | Optional absolute TonConnect manifest |

## Claim flow

1. Reads `get_claim_status` / `get_holder_info` from the minter (same RPC pattern as `admin/src/lib/ton.ts`).
2. Shows **7d accrual** + **24h window** countdown even when the window is closed.
3. **Claim Reward** builds opcode `ClaimReward` (`3185255800`) + `queryId` and sends via TonConnect to `VITE_MINTER` with ~0.08 TON gas.
4. On-chain claim only succeeds while the contract window is open and the holder is eligible.

## Upgrades

Shop items send plain TON to `VITE_TREASURY_OR_KEEPER`. Owned upgrades are stored in `localStorage` keyed by wallet and applied to fire rate / damage / shields / speed in-game.

## Leaderboard & prizes

Scores: Top 20 in `localStorage` (+ in-memory session mirror).

**Prize $AWN events** are not paid by this Mini App. After a tournament window, export top wallets and use **Command Deck** (`admin/`) **BatchTransfer** to airdrop prizes. Stub note is shown on the Ranks screen.

## What works vs stubs

| Feature | Status |
|---------|--------|
| UI + cyber HUD + logo | Working |
| TonConnect connect | Working |
| Mock $AWN/TON chart | Working (interval mock; DEX API stub) |
| Buy/Sell buttons | Open explorer (swap intent stub) |
| Claim countdown + body | Working against testnet RPC |
| Hangar + Neon Siege game | Playable canvas loop |
| Upgrades purchase | TonConnect sendTransaction + local inventory |
| Leaderboard | Local only |
| Prize airdrops | Admin BatchTransfer (documented) |

## Scripts

- `npm run dev` — Vite
- `npm run build` — production build
- Root: `npm run miniapp` / `npm run miniapp:build`
