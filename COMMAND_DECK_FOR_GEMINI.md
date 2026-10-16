# $AWN Command Deck — guida Owner (per Gemini)

**Cosa è:** UI admin locale (`admin/`) per operare sul minter `$AWN` su TON. **Non** è la miniapp pubblica. Solo il wallet **Owner** del contratto può firmare le azioni on-chain.

**Come aprirlo:** `cd admin && npm run dev` → http://127.0.0.1:5173/  
TonConnect usa il manifest HTTPS della miniapp Vercel (`awn-miniapp-vercel.vercel.app`), altrimenti i wallet mobile non connettono.

**Network:** **mainnet** live — minter `EQA2T-nreKcnBzZmQfAJfEXCBdx8qPGVi8zGIUhFMtYi1vPs`. Trading/sell/claim ancora OFF fino a EnableTrading Owner.

---

## Panoramica pannelli

| Pannello | Cosa fa | On-chain? |
|----------|---------|-----------|
| Live telemetry | Treasury TON, supply, DEX pool, trading/sell/claim flags, grafico | Solo lettura |
| Claim (Owner) | Timer ciclo, deposit treasury, apri/chiudi finestra, periodo 1/3/5/7g | Sì (Owner) |
| Miniapp Coming Soon / Live | Draft JSON `app-status.json` (global + giochi) | No — copia/incolla + redeploy file |
| Start / Stop scambi | EnableTrading, sell ON/OFF, limiti DEX, PushWalletConfig | Sì |
| Holders | Tabella wallet · @Telegram · $AWN (import JSON miniapp). Regola: 1 TG = 1 wallet; solo Owner può avere più wallet con lo stesso @username | Lettura / refresh balance |
| Blacklist | Block / unblock address | Sì |
| Invio token / Batch airdrop | Transfer / BatchTransfer da jetton wallet Owner | Sì |
| Sweep tax → Keeper | Sposta `$AWN` tax pending dal minter al Keeper | Sì |
| Deposit treasury | Invia TON al minter → claim pool | Sì |
| Renounce | ChangeOwner → dead address (irreversibile) | Sì |

---

## Flusso economico (Owner)

```
Vendite holder → sell tax 3% ($AWN sul minter)
       ↓
Sweep tax → Keeper          (Command Deck)
       ↓
Keeper swap $AWN → TON      (manuale / off-deck)
       ↓
Deposit treasury            (TON sul minter = claim pool)
       ↓
Finestra claim aperta       (ForceOpen o dopo accrual)
       ↓
Holder ClaimReward          (proporzionale al balance; Owner escluso)
```

---

## Claim — comandi Owner

- **Claim ON / OFF** → `SetClaimProgramActive`: attiva o spegne tutto il programma claim (OFF chiude anche la finestra).
- **1g / 3g / 5g / 7g** → `SetClaimPeriodDays`: **una sola tx** imposta i giorni di accrual **e chiude** la finestra claim (niente `ForceClose` extra → meno gas).
- **Deposit treasury** → `DepositTreasury` (valore TON nel messaggio).
- **Apri finestra** → `ForceOpenClaimWindow` (snapshot = treasury attuale, finestra 24h).
- **Chiudi finestra** → `ForceCloseClaimWindow` (solo se serve chiudere senza cambiare periodo; TON non claimati restano in treasury).

**Regola:** il wallet Owner **non può** `ClaimReward` (possesso elevato / liquidità di lancio).

---

## Miniapp vs Deck

| | Miniapp (Netlify / Telegram) | Command Deck |
|--|------------------------------|--------------|
| Pubblico | Sì | No (localhost) |
| Claim / wallet / giochi | Utenti | — |
| Trading / tax / claim window / blacklist / airdrop | — | Owner |
| Coming Soon | Legge `app-status.json` | Genera JSON da copiare |

Giochi: mined `$AWN` off-chain; premi reali solo via **Batch airdrop** dal Deck.

---

## Sicurezza operativa

1. Collega solo il wallet **Owner del minter** (non un altro “mainnet owner” di appunti).
2. Non usare Renounce se non sei sicuro al 100%.
3. Dopo ogni redeploy minter: aggiorna `MINTER` / jetton wallet in admin + miniapp + Netlify Drop.
4. Mainnet solo con conferma esplicita «vai mainnet».

---

## Stack tecnico

- React + Vite + TonConnect UI  
- Opcode / body builder in `admin/src/lib/ton.ts`  
- Config: `admin/src/config.ts` (`VITE_MINTER`, network, RPC)  
- Holders registry key condivisa concettualmente con miniapp: `awn_holder_registry_v1`
