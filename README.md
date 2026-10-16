<p align="center">
  <img src="assets/awn-logo.png" alt="AwanToken ($AWN) logo" width="160" />
</p>

# AwanToken ($AWN)

Fixed-supply TON jetton (Tact) with DEX limits, sell-tax treasury, and weekly claim. **Mainnet minter is deployed**; public trading, sells, and claim remain **OFF** at launch until the Owner enables them on-chain.

Canonical deployment record: [`deployments/mainnet.json`](deployments/mainnet.json).

## Mainnet (live)

| | |
|---|---|
| **Network** | TON mainnet |
| **Symbol** | `$AWN` (AwanToken) |
| **Decimals** | 9 |
| **Total supply** | 1,000,000,000 $AWN (minted to Owner at deploy) |
| **Minter** | `EQA2T-nreKcnBzZmQfAJfEXCBdx8qPGVi8zGIUhFMtYi1vPs` |
| **Explorer** | [tonviewer.com — minter](https://tonviewer.com/EQA2T-nreKcnBzZmQfAJfEXCBdx8qPGVi8zGIUhFMtYi1vPs) |
| **Owner (bounceable)** | `EQA1G4lmw34UsL4P30mvW4k8WSCs1RHUkjXcp1DjE66L1pb4` |
| **Owner (non-bounceable)** | `UQA1G4lmw34UsL4P30mvW4k8WSCs1RHUkjXcp1DjE66L1ss9` |
| **Owner jetton wallet** | `EQBQvDCDbXzvdiPplAVP4qqf7iZZX8fmZiucYTNJkZa9q2tm` |
| **Logo (metadata)** | https://awn-miniapp-vercel.vercel.app/awn-logo.png |

### Launch flags (on-chain)

| Flag | Status |
|------|--------|
| Trading (`EnableTrading`) | **OFF** — one-way; not enabled at deploy |
| Sells | **OFF** |
| Claim program | **OFF** |
| DEX limits | **ON** |

Simulated pool: **25%** of supply (250M $AWN) seeded per `deployments/mainnet.json`. Real DEX LP (e.g. DeDust / STON.fi) and `SetDexPool` to the vault are later Owner steps.

**Do not call `EnableTrading` from automation** unless you intend to open trading irreversibly. Post-deploy mainnet ops use `SKIP_ENABLE_TRADING=1` with `npm run ops:postdeploy:mainnet` when keeping launch closed.

## Miniapp (production)

- **URL:** https://awn-miniapp-vercel.vercel.app  
- **Telegram:** configure bot / manifest to point at the Vercel origin and mainnet minter.

Local dev: `npm run miniapp` (see [`miniapp/README.md`](miniapp/README.md)).

## Repository layout

| Path | Role |
|------|------|
| `contracts/` | Tact jetton (minter + wallets) |
| `scripts/` | Deploy, pool setup, ops |
| `deployments/` | Public addresses (`mainnet.json`, `testnet.json`) — **never** commit `*-pool.json`, mnemonics, or `.env` |
| `miniapp/` | Telegram Mini App (Vite + React + TonConnect) |
| `admin/` | Owner Command Deck (local) |

Build contracts: `npm run build`. Mainnet deploy (Owner wallet + env): `npm run deploy:mainnet`.

## Testnet

Previous launch-like testnet minter and flags are documented in [`PROJECT_STATUS.md`](PROJECT_STATUS.md) and [`deployments/testnet.json`](deployments/testnet.json).

## Security

- Never commit `.env`, wallet seeds, or `deployments/*-pool.json` / `*-buyer.json`.  
- `.gitignore` is configured accordingly; verify with `git status` before every push.
