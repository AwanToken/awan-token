# $AWN — stato progetto

Aggiornato: 2026-10-16

## Mainnet LIVE (launch chiuso)

Deploy mainnet completato. **Trading, vendite e claim sono OFF** finché l’Owner non li abilita on-chain (`EnableTrading` è irreversibile).

| Voce | Valore |
|------|--------|
| Deployed | 2026-10-16 (vedi `deployments/mainnet.json`) |
| Minter | `EQA2T-nreKcnBzZmQfAJfEXCBdx8qPGVi8zGIUhFMtYi1vPs` |
| Explorer | https://tonviewer.com/EQA2T-nreKcnBzZmQfAJfEXCBdx8qPGVi8zGIUhFMtYi1vPs |
| Owner | `EQA1G4lmw34UsL4P30mvW4k8WSCs1RHUkjXcp1DjE66L1pb4` |
| Owner (UQ…) | `UQA1G4lmw34UsL4P30mvW4k8WSCs1RHUkjXcp1DjE66L1ss9` |
| Owner jetton wallet | `EQBQvDCDbXzvdiPplAVP4qqf7iZZX8fmZiucYTNJkZa9q2tm` |
| Supply | **1B** $AWN, **9** decimali |
| Logo | https://awn-miniapp-vercel.vercel.app/awn-logo.png |
| Miniapp prod | https://awn-miniapp-vercel.vercel.app |
| **Trading** | **OFF** (`isTradingEnabled: false`) |
| **Vendite** | **OFF** (`isSellEnabled: false`) |
| **Claim** | **OFF** |
| DEX limits | ON |
| Pool (sim) | `EQATJFmSr5Jd8cP62mHuvcnqqPjFqRyxT5dgpOGkO6hlTl2-` — 25% AWN (250M) in pool; 75% sul wallet Owner |

Post-deploy eseguito con trading non abilitato (`launchFlags` / `SKIP_ENABLE_TRADING=1`). Prossimi passi Owner (ordine tipico):

1. Verificare metadata/logo on-chain e miniapp Vercel  
2. (Opzionale) LP reale su DEX + TON liquidità  
3. `EnableTrading` quando pronti ad aprire **solo acquisti**  
4. Più tardi: vendite, treasury/claim  

---

## Testnet (riferimento — pre-mainnet)

| Voce | Valore |
|------|--------|
| Minter | `EQADGDeL2zKGYiOC99K-aBxuPXWo8mBqM6drPsjNPZ5MnfBV` |
| Explorer | https://testnet.tonviewer.com/EQADGDeL2zKGYiOC99K-aBxuPXWo8mBqM6drPsjNPZ5MnfBV |
| Trading testnet | ON (test irreversibile) |
| Vendite / claim testnet | OFF |

### Nota npm

`postdeploy:testnet` → `ops:postdeploy:testnet`. Per mainnet chiuso: `SKIP_ENABLE_TRADING=1 npm run ops:postdeploy:mainnet`.

---

## Miniapp / Command Deck

- **Produzione:** Vercel — https://awn-miniapp-vercel.vercel.app (minter mainnet in config/env build).  
- **Deck:** `cd admin && npm run admin` → collegare wallet **Owner del minter mainnet**.
