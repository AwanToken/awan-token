export type Lang = "it" | "en" | "ru" | "zh";

export const LANGS: { id: Lang; label: string; flag: string }[] = [
  { id: "it", label: "IT", flag: "IT" },
  { id: "en", label: "EN", flag: "EN" },
  { id: "ru", label: "RU", flag: "RU" },
  { id: "zh", label: "中文", flag: "中文" },
];

export type Dict = {
  brandSub: string;
  nav: {
    home: string;
    claim: string;
    hangar: string;
    games: string;
    board: string;
    wallet: string;
    roadmap: string;
  };
  wallet: {
    eyebrow: string;
    title: string;
    lede: string;
    connectLede: string;
    connect: string;
    network: string;
    claimPool: string;
    poolYes: string;
    poolNo: string;
    claimedCycle: string;
    estClaim: string;
    eligibility: string;
    fullReward: string;
    halfReward: string;
    dex: string;
    dexPool: string;
    earnings: string;
    earningsHint: string;
    history: string;
    historyEmpty: string;
    cycle: string;
    refresh: string;
    /** Dual deposit paths — no external links (Telegram-safe). */
    dualFlowsTitle: string;
    dualFlowsBody: string;
  };
  walletGate: {
    title: string;
    hint: string;
    connect: string;
  };
  home: {
    eyebrow: string;
    buy: string;
    sell: string;
    network: string;
    minter: string;
    rpc: string;
    hint: string;
    chartCaption: string;
    feedFail: string;
    limitTitle: string;
    limitBody: string;
    limitDanger: string;
    dedustBadge: string;
    taxReminder: string;
    limitMeta: string;
    limitLoadFail: string;
    buyConfirmTitle: string;
    buyConfirmBody: string;
    buyConfirmWarn: string;
    swapLoading: string;
    swapFallback: string;
    openStonFi: string;
  };
  claim: {
    eyebrow: string;
    title: string;
    lede: string;
    program: string;
    inactive: string;
    inactiveHint: string;
    accrual: string;
    accrualHint: string;
    windowOpen: string;
    windowPhase: string;
    closesIn: string;
    windowOpenHint: string;
    windowClosedHint: string;
    between: string;
    refreshing: string;
    cycle: string;
    treasury: string;
    poolSnap: string;
    refresh: string;
    connectClaim: string;
    signing: string;
    claimReward: string;
    windowClosedNote: string;
    alreadyClaimed: string;
    alreadyClaimedHint: string;
    alreadyClaimedNote: string;
    ownerNoClaim: string;
    ownerNoClaimHint: string;
    viewMinter: string;
    connectHint: string;
    submitted: string;
    dualFlowsHint: string;
  };
  hangar: {
    eyebrow: string;
    title: string;
    lede: string;
    awnHint: string;
    launch: string;
  };
  games: {
    eyebrow: string;
    title: string;
    lede: string;
    siegeSub: string;
    runSub: string;
    economyHint: string;
    runLede: string;
    starterHint: string;
    powerShop: string;
    powerPickupHint: string;
    livesShop: string;
    livesLede: string;
    livesLabel: string;
    livesBuy: string;
    livesBought: string;
    livesDailyCap: string;
    livesNeedBuy: string;
    livesNone: string;
    runLevelsHint: string;
    runHintScore: string;
    runPause: string;
    runResume: string;
    runPauseTitle: string;
    runBossNeedFire: string;
    runShopAwn: string;
    runShopAwnHint: string;
    runShopTon: string;
    runShopTonHint: string;
    runShopBought: string;
    runShopBoughtTon: string;
    runBtnJump: string;
    runBtnFire: string;
    runBtnLeaf: string;
    runBtnPower: string;
    firstPowerHint: string;
    siegeUpgrades: string;
    playRun: string;
    tokenMenu: string;
    spendable: string;
    minedPending: string;
    gold: string;
    minedPendingHint: string;
    claimMined: string;
    claimNeedMore: string;
    claimNeedWallet: string;
    claimQueued: string;
    ownerClaim: string;
    ownerClaimHint: string;
    queueMined: string;
    queued: string;
    ownerSettle: string;
    comingSoon: string;
    comingSoonBadge: string;
    backLive: string;
    ownerStatus: string;
    ownerStatusHint: string;
    statusGlobal: string;
    statusSiege: string;
    statusRun: string;
    setAllComing: string;
    setAllLive: string;
    clearOverrides: string;
    overrideActive: string;
    globalUpdating: string;
    ownerWallet: string;
    ownerTelegram: string;
    ownerTelegramUnknown: string;
    ownerSessionPlayer: string;
  };
  shop: {
    eyebrow: string;
    title: string;
    lede: string;
    owned: string;
    buy: string;
    connect: string;
    acquired: string;
  };
  board: {
    eyebrow: string;
    title: string;
    lede: string;
    empty: string;
    prize: string;
    prizeHint: string;
    exportBtn: string;
    exportCopied: string;
    exportEmpty: string;
    exportNeedWallet: string;
  };
  game: {
    lastRun: string;
    playAgain: string;
    siegeHint: string;
    bombBuy: string;
    bombDetonate: string;
    bombArmed: string;
    bombAlready: string;
    bombFailed: string;
  };
  audio: {
    spotifyTitle: string;
    pasteLink: string;
    muteGame: string;
    muteSpotify: string;
    openSpotify: string;
    close: string;
    playingBg: string;
  };
  roadmap: {
    eyebrow: string;
    title: string;
    lede: string;
    viewContract: string;
    badgeLive: string;
    badgeNext: string;
    badgeLater: string;
    p1Title: string;
    p1Body: string;
    p1b1: string;
    p1b2: string;
    p1b3: string;
    p2Title: string;
    p2Body: string;
    p2b1: string;
    p2b2: string;
    p2b3: string;
    p3Title: string;
    p3Body: string;
    p3b1: string;
    p3b2: string;
    p3b3: string;
    p4Title: string;
    p4Body: string;
    p4b1: string;
    p4b2: string;
    p4b3: string;
    p5Title: string;
    p5Body: string;
    p5b1: string;
    p5b2: string;
    p5b3: string;
    p6Title: string;
    p6Body: string;
    p6b1: string;
    p6b2: string;
    p6b3: string;
    specTitle: string;
    specBuy: string;
    specSell: string;
    specTax: string;
    specClaim: string;
    specGames: string;
    specNetwork: string;
    specOfPool: string;
    specOfHold: string;
    specTaxDest: string;
    specGamesVal: string;
    disclaimer: string;
    openFromGames: string;
  };
};

export const translations: Record<Lang, Dict> = {
  it: {
    brandSub: "Games · Mini App",
    nav: {
      home: "Trade",
      claim: "Claim",
      hangar: "Hangar",
      games: "Giochi",
      board: "Top",
      wallet: "Wallet",
      roadmap: "Road",
    },
    wallet: {
      eyebrow: "On-chain · $AWN",
      title: "Il tuo wallet",
      lede: "Saldi, adesione al claim pool e guadagni registrati — mini app e contratto allineati.",
      connectLede: "Collega Tonkeeper per vedere $AWN, stato pool e claim.",
      connect: "Collega wallet",
      network: "Rete",
      claimPool: "Claim pool",
      poolYes: "Aderente — detieni $AWN (peso claim attivo)",
      poolNo: "Non aderente — compra/tieni $AWN per entrare nel pool claim",
      claimedCycle: "già riscattato ciclo",
      estClaim: "Stima claim",
      eligibility: "Eligibilità",
      fullReward: "Reward pieno",
      halfReward: "Penalità 50%",
      dex: "Trading",
      dexPool: "DEX pool",
      earnings: "Totale guadagnato (claim)",
      earningsHint: "Somma dei claim registrati su questo dispositivo dopo ogni ClaimReward.",
      history: "Storico claim",
      historyEmpty: "Nessun claim registrato ancora.",
      cycle: "Ciclo",
      refresh: "Aggiorna on-chain",
      dualFlowsTitle: "Due flussi TON",
      dualFlowsBody:
        "Fee di gioco (vite, bomba, shop) → keeper per le ops. Payout claim holder → tesoreria minter (DepositTreasury). Percorsi separati.",
    },
    walletGate: {
      title: "Wallet richiesto",
      hint: "Collega il wallet per sbloccare claim, giochi e il resto dell’app. Il grafico resta visibile.",
      connect: "Collega wallet",
    },
    home: {
      eyebrow: "Feed live · DeDust pool",
      buy: "Compra $AWN",
      sell: "Vendi $AWN",
      network: "Rete",
      minter: "Minter",
      rpc: "RPC",
      hint: "Prezzo/grafico = mercato live. Buy/Sell = Ston.fi in-app (niente uscita). Resta sotto il max buy.",
      chartCaption: "OHLCV 15m · prezzo TON per 1 $AWN · aggiornamento ogni 25s",
      feedFail: "Feed DeDust temporaneamente non disponibile",
      limitTitle: "Promemoria limiti & tasse",
      limitBody:
        "Buy max ≈ {pct} del vault AWN → circa {maxTon} (≤ {maxAwn}). Sell tax 0% ora; limiti sell restano on-chain.",
      limitDanger:
        "Non usare DeDust per buy/sell: oltre il limite i TON restano nel pool e non ricevi $AWN. Solo Ston.fi.",
      dedustBadge: "NO DEDUST SWAP",
      taxReminder: "Ricorda: limiti buy/sell on-chain · preferisci Ston.fi · post futuri: acquista su Ston.fi.",
      limitMeta: "Buy cap",
      limitLoadFail: "Impossibile leggere il limite buy on-chain — compra con cautela.",
      buyConfirmTitle: "Conferma prima di Ston.fi",
      buyConfirmBody:
        "Limite attuale {pct}: resta sotto ~{maxTon} (max ~{maxAwn} per tx).",
      buyConfirmWarn:
        "Ston.fi valida prima dello swap. Resta sotto il cap per evitare fallimenti.",
      swapLoading: "Carico swap Ston.fi in-app…",
      swapFallback: "Widget non disponibile qui — apri Ston.fi in browser sicuro.",
      openStonFi: "Apri Ston.fi",
    },
    claim: {
      eyebrow: "Claim settimanale ponderato",
      title: "Claim GRAM / TON",
      lede: "7g accumulo · 24h finestra · regole anti-sniper on-chain",
      program: "Programma",
      inactive: "Inattivo",
      inactiveHint: "Il claim parte quando le vendite sono abilitate sul minter.",
      accrual: "Fine accumulo tra",
      accrualHint: "Tieni $AWN nel ciclo. La finestra apre dopo 7 giorni.",
      windowOpen: "Finestra claim aperta",
      windowPhase: "Fase finestra",
      closesIn: "chiude tra",
      windowOpenHint: "Invia ClaimReward al minter mentre la finestra è aperta.",
      windowClosedHint: "La finestra può aprirsi al prossimo DepositTreasury / Claim.",
      between: "Transizione ciclo",
      refreshing: "Aggiornamento…",
      cycle: "Ciclo",
      treasury: "Tesoreria",
      poolSnap: "Pool snap",
      refresh: "Aggiorna",
      connectClaim: "Collega & Claim",
      signing: "Firma…",
      claimReward: "Riscuoti reward",
      windowClosedNote: "Pulsante disabilitato a finestra chiusa; il countdown resta attivo.",
      alreadyClaimed: "Già riscattato",
      alreadyClaimedHint:
        "Hai già riscattato il ciclo #{cycle}. Per te la finestra claim è chiusa — niente fee inutili.",
      alreadyClaimedNote:
        "Claim già fatto in questo ciclo: il pulsante resta bloccato. Gli altri holder possono ancora riscuotere.",
      ownerNoClaim: "Owner escluso",
      ownerNoClaimHint:
        "Il wallet Owner non può riscuotere dal claim pool (possesso elevato / liquidità di lancio).",
      viewMinter: "Vedi minter su explorer →",
      connectHint: "Collega il wallet per verificare l’idoneità.",
      submitted: "Claim inviato — attendi conferma, poi aggiorna.",
      dualFlowsHint:
        "I payout di questa schermata escono dalla tesoreria minter. Le fee di gioco (vite, bomba, shop) vanno al keeper — percorso separato.",
    },
    hangar: {
      eyebrow: "Flotta Void Courier",
      title: "Hangar",
      lede: "Scegli una silhouette neon, poi entra in AWN: Neon Siege.",
      awnHint:
        "4 livelli · miniboss +5 $AWN · superboss +10 · bomba 2 TON → keeper (+20 $AWN, 1/partita). Nemici più resistenti con armi potenziate.",
      launch: "Lancia Neon Siege",
    },
    games: {
      eyebrow: "Sala giochi · $AWN",
      title: "Games",
      lede: "Scegli Neon Siege o RunAwan. Monete logo $AWN minate per claim futuro.",
      siegeSub: "4 livelli · bomba · armi a tier · superboss",
      runSub: "4 livelli lunghi · mattoni · boss · joypad",
      economyHint:
        "I $AWN minati (≥100) si accodano al claim pool. Settlement on-chain = BatchTransfer Owner — non mint gratis.",
      runLede:
        "Platformer: salta sui mattoni, rompili per power-up, affronta il boss di fine livello (solo fiore di fuoco).",
      starterHint:
        "Prima partita: +15 $AWN spendibili (copre il primo power-up del giorno). Poi acquisti dal saldo gioco.",
      powerShop: "Negozio $AWN (lobby)",
      powerPickupHint:
        "In corsa: rompi mattoni ? per fungo/fiore/stella/foglia. Boss: solo fuoco. Pausa = shop di emergenza.",
      livesShop: "Vite / partite",
      livesLede:
        "3 vite gratis al giorno. Extra: 1 TON → keeper (max 10 acquisti/giorno). Solo RunAwan.",
      livesLabel: "Vite",
      livesBuy: "Compra 1 vita · 1 TON",
      livesBought: "+1 vita accreditata",
      livesDailyCap: "Limite giornaliero raggiunto (10/giorno)",
      livesNeedBuy: "Niente vite — compra sotto",
      livesNone: "Serve almeno 1 vita per giocare",
      runLevelsHint:
        "L1 Piovra · L2 Lupo mannaro · L3 Medusa · L4 Minotauro — livelli 2–3× più lunghi",
      runHintScore: "Score",
      runPause: "Pausa",
      runResume: "Continua",
      runPauseTitle: "Pausa · Power-up",
      runBossNeedFire:
        "Boss attivo: senza fiore di fuoco non puoi ferirlo. Compra sotto (TON emergenza o $AWN).",
      runShopAwn: "Negozio $AWN (saldo gioco)",
      runShopAwnHint: "Primo del giorno 15 $AWN · poi prezzi catalogo",
      runShopTon: "Shop emergenza TON (pausa / boss)",
      runShopTonHint: "1 TON ciascuno → keeper via TonConnect. Ideale se ti manca il fiore al boss.",
      runShopBought: "Power-up acquistato con $AWN",
      runShopBoughtTon: "Power-up sbloccato · 1 TON inviato",
      runBtnJump: "SALTO",
      runBtnFire: "FUOCO",
      runBtnLeaf: "FOGLIA",
      runBtnPower: "POTERE",
      firstPowerHint: "Primo power-up oggi: 15 $AWN",
      siegeUpgrades: "Potenziamenti",
      playRun: "Gioca RunAwan",
      tokenMenu: "Wallet giochi · $AWN",
      spendable: "Spendibili",
      minedPending: "Minati in attesa",
      gold: "Oro",
      minedPendingHint:
        "Neon Siege + RunAwan condividono il saldo minato. A ≥100 $AWN puoi claimare verso il claim pool.",
      claimMined: "Claim → claim pool",
      claimNeedMore: "Serve ≥{n} $AWN minati",
      claimNeedWallet: "Collega wallet per claim",
      claimQueued:
        "Accodati {amount} $AWN — Owner li vede in Command Deck e li liquida con BatchTransfer.",
      ownerClaim: "Owner · coda claim minati (nascosto)",
      ownerClaimHint:
        "PIN OWNER. Accoda tutti i $AWN minati per settlement futuro dal claim pool (BatchTransfer) — non regala token on-chain.",
      queueMined: "Accoda minati per claim pool",
      queued: "Minati accodati per settlement owner dal claim pool.",
      ownerSettle:
        "Dopo il queue, l’Owner liquida da Command Deck (Sync coda → Prefill BatchTransfer). Non mint on-chain da qui.",
      comingSoon: "In arrivo",
      comingSoonBadge: "IN ARRIVO",
      backLive: "Live (in circolo)",
      ownerStatus: "Owner · stato app (Coming Soon / Live)",
      ownerStatusHint:
        "PIN OWNER. I toggle valgono subito su questo browser (localStorage). Per tutti gli utenti aggiorna public/app-status.json.",
      statusGlobal: "Tutta la miniapp",
      statusSiege: "Neon Siege",
      statusRun: "RunAwan",
      setAllComing: "Tutto in arrivo",
      setAllLive: "Tutto live",
      clearOverrides: "Pulisci override (usa JSON)",
      overrideActive: "Override attivo su questo dispositivo",
      globalUpdating: "App in aggiornamento",
      ownerWallet: "Wallet",
      ownerTelegram: "Telegram",
      ownerTelegramUnknown: "Telegram non disponibile",
      ownerSessionPlayer: "Sessione attuale (wallet + Telegram) — solo owner",
    },
    shop: {
      eyebrow: "Baia pezzi",
      title: "Upgrade",
      lede: "Paga in TON al keeper via TonConnect. Gli upgrade restano sul wallet.",
      owned: "Posseduto",
      buy: "Compra",
      connect: "Collega wallet",
      acquired: "Acquisito. Statistiche al prossimo lancio.",
    },
    board: {
      eyebrow: "Ranking segnale",
      title: "Classifica",
      lede: "Top 20 punteggi Neon Siege (locale + sessione).",
      empty: "Nessun punteggio — lancia da Games.",
      prize: "Eventi premio",
      prizeHint:
        "Copia JSON top wallet (con importi premio) → Command Deck → Import leaderboard → Prefill BatchTransfer.",
      exportBtn: "Copia JSON premi (top 10)",
      exportCopied: "JSON copiato",
      exportEmpty: "Nessun wallet esportabile in classifica.",
      exportNeedWallet: "Serve almeno un punteggio con wallet collegato.",
    },
    game: {
      lastRun: "Ultima run inviata",
      playAgain: "Rigioca",
      siegeHint: "Trascina sul canvas · auto-fuoco · B = bomba",
      bombBuy: "BOMBA {ton} TON",
      bombDetonate: "DETONA",
      bombArmed: "Bomba armata — tocca DETONA",
      bombAlready: "Bomba già usata / acquistata in questa partita",
      bombFailed: "Pagamento bomba annullato",
    },
    audio: {
      spotifyTitle: "Spotify",
      pasteLink: "Incolla link Spotify…",
      muteGame: "Mute gioco",
      muteSpotify: "Mute Spotify",
      openSpotify: "Apri Spotify",
      close: "Chiudi",
      playingBg: "Musica in background",
    },
    roadmap: {
      eyebrow: "Smart contract",
      title: "Roadmap $AWN",
      lede: "Come funziona il token on-chain e cosa arriva dopo — trasparente per tutti i giocatori.",
      viewContract: "Apri contratto su explorer",
      badgeLive: "LIVE",
      badgeNext: "NEXT",
      badgeLater: "LATER",
      p1Title: "1 · Jetton $AWN",
      p1Body: "Token TEP-74 su TON con owner, trading switch e blacklist.",
      p1b1: "Supply fissa mintata all’owner al deploy",
      p1b2: "Trading e vendite attivabili dall’owner",
      p1b3: "Blacklist per wallet abusivi",
      p2Title: "2 · Limiti DEX",
      p2Body: "Protezione anti-whale: buy e sell con tetti sulla pool e sul possesso.",
      p2b1: "Buy max = % del saldo AWN nel vault DEX (on-chain)",
      p2b2: "Sell = min(% pool, % del tuo possesso) quando le vendite sono ON",
      p2b3: "Su DeDust oltre il limite: TON resta nel pool (no refund automatico)",
      p3Title: "3 · Sell tax",
      p3Body: "Su ogni vendita verso la pool resta il 3% in $AWN come tax.",
      p3b1: "Tax accumulata su pendingTaxJettons",
      p3b2: "Owner → SweepTax verso Keeper",
      p3b3: "Keeper può convertire e DepositTreasury",
      p4Title: "4 · Claim settimanale",
      p4Body: "Tesoreria TON redistribuita in modo pesato ai holder idonei.",
      p4b1: "Periodo accrual 7 giorni",
      p4b2: "Finestra claim 24 ore",
      p4b3: "Peso legato al saldo e alla stabilità di holding",
      p5Title: "5 · Games & mine",
      p5Body: "I giochi divertono e minano $AWN off-chain per un claim futuro dalla pool.",
      p5b1: "Non mintano token gratis on-chain",
      p5b2: "Drop rari (boss / monete logo) → mined pending",
      p5b3: "Owner attiva il claim dalla pool quando è pronto",
      p6Title: "6 · Mainnet",
      p6Body: "Deploy pubblico, pool con liquidità TON+$AWN, Keeper e claim live.",
      p6b1: "Solo dopo testnet stabile",
      p6b2: "Pool TON: l’owner annuncerà quando depositare",
      p6b3: "Renounce ownership quando il prodotto è maturo",
      specTitle: "Scheda tecnica (live)",
      specBuy: "Limite buy",
      specSell: "Limite sell",
      specTax: "Sell tax",
      specClaim: "Claim cycle",
      specGames: "Game rewards",
      specNetwork: "Network",
      specOfPool: "della pool",
      specOfHold: "del possesso",
      specTaxDest: "Keeper / treasury",
      specGamesVal: "Off-chain → claim pool",
      disclaimer:
        "I giochi non regalano $AWN on-chain. I token minati restano in coda fino al claim owner dalla pool. Sempre verifica il contratto sull’explorer.",
      openFromGames: "Apri roadmap smart contract",
    },
  },
  en: {
    brandSub: "Games · Mini App",
    nav: {
      home: "Trade",
      claim: "Claim",
      hangar: "Hangar",
      games: "Games",
      board: "Ranks",
      wallet: "Wallet",
      roadmap: "Roadmap",
    },
    wallet: {
      eyebrow: "On-chain · $AWN",
      title: "Your wallet",
      lede: "Balances, claim-pool membership and recorded earnings — mini app linked to the contract.",
      connectLede: "Connect Tonkeeper to see $AWN, pool status and claims.",
      connect: "Connect wallet",
      network: "Network",
      claimPool: "Claim pool",
      poolYes: "Joined — you hold $AWN (claim weight active)",
      poolNo: "Not joined — buy/hold $AWN to enter the claim pool",
      claimedCycle: "already claimed cycle",
      estClaim: "Est. claim",
      eligibility: "Eligibility",
      fullReward: "Full reward",
      halfReward: "50% penalty",
      dex: "Trading",
      dexPool: "DEX pool",
      earnings: "Total earned (claims)",
      earningsHint: "Sum of claims logged on this device after each ClaimReward.",
      history: "Claim history",
      historyEmpty: "No claims recorded yet.",
      cycle: "Cycle",
      refresh: "Refresh on-chain",
      dualFlowsTitle: "Two TON paths",
      dualFlowsBody:
        "Game fees (lives, bomb, shop) → keeper for ops. Holder claim payouts → minter treasury (DepositTreasury). Separate destinations.",
    },
    walletGate: {
      title: "Wallet required",
      hint: "Connect your wallet to unlock claim, games, and the rest of the app. The chart stays visible.",
      connect: "Connect wallet",
    },
    home: {
      eyebrow: "Live feed · DeDust pool",
      buy: "Buy $AWN",
      sell: "Sell $AWN",
      network: "Network",
      minter: "Minter",
      rpc: "RPC",
      hint: "Price/chart = live market. Buy/Sell = in-app Ston.fi. Stay under max buy.",
      chartCaption: "OHLCV 15m · TON per 1 $AWN · refresh every 25s",
      feedFail: "DeDust feed temporarily unavailable",
      limitTitle: "Limits & tax reminder",
      limitBody:
        "Buy max ≈ {pct} of vault AWN → about {maxTon} (≤ {maxAwn}). Sell tax 0% now; sell limits stay on-chain.",
      limitDanger:
        "Do not swap on DeDust: over the limit, TON stays in the pool and you get no $AWN. Use Ston.fi only.",
      dedustBadge: "NO DEDUST SWAP",
      taxReminder: "Remember: on-chain buy/sell caps · prefer Ston.fi · future posts: buy on Ston.fi.",
      limitMeta: "Buy cap",
      limitLoadFail: "Could not read on-chain buy limit — buy carefully.",
      buyConfirmTitle: "Confirm before Ston.fi",
      buyConfirmBody:
        "Current limit {pct}: stay under ~{maxTon} (max ~{maxAwn} per tx).",
      buyConfirmWarn:
        "Ston.fi validates before the swap. Stay under the cap to avoid failed trades.",
      swapLoading: "Loading in-app Ston.fi swap…",
      swapFallback: "Widget unavailable here — open Ston.fi safely.",
      openStonFi: "Open Ston.fi",
    },
    claim: {
      eyebrow: "Weekly weighted claim",
      title: "Claim GRAM / TON",
      lede: "7d accrual · 24h claim window · on-chain anti-sniper rules",
      program: "Program",
      inactive: "Inactive",
      inactiveHint: "Claim starts when sells are enabled on the minter.",
      accrual: "Accrual ends in",
      accrualHint: "Hold $AWN through the cycle. Window opens after 7 days.",
      windowOpen: "Claim window open",
      windowPhase: "Window phase",
      closesIn: "closes in",
      windowOpenHint: "Send ClaimReward to the minter while the window is open.",
      windowClosedHint: "Window may open on next DepositTreasury / Claim touch.",
      between: "Cycle transition",
      refreshing: "Refreshing…",
      cycle: "Cycle",
      treasury: "Treasury",
      poolSnap: "Pool snap",
      refresh: "Refresh",
      connectClaim: "Connect & Claim",
      signing: "Signing…",
      claimReward: "Claim Reward",
      windowClosedNote: "Button disabled while window closed; countdown stays live.",
      alreadyClaimed: "Already claimed",
      alreadyClaimedHint:
        "You already claimed cycle #{cycle}. Claim is closed for you — no extra fees.",
      alreadyClaimedNote:
        "You already claimed this cycle: button stays locked. Other holders can still claim.",
      ownerNoClaim: "Owner excluded",
      ownerNoClaimHint:
        "The Owner wallet cannot claim from the pool (large residual / launch holdings).",
      viewMinter: "View minter on explorer →",
      connectHint: "Connect wallet to check holder eligibility.",
      submitted: "Claim submitted — wait for confirmation, then refresh.",
      dualFlowsHint:
        "Payouts on this screen come from the minter treasury. Game fees (lives, bomb, shop) go to the keeper — a separate path.",
    },
    hangar: {
      eyebrow: "Void Courier fleet",
      title: "Hangar",
      lede: "Choose a neon silhouette, then enter AWN: Neon Siege.",
      awnHint:
        "4 levels · miniboss +5 $AWN · superboss +10 · bomb 2 TON → keeper (+20 $AWN, 1/match). Enemies toughen with powered weapons.",
      launch: "Launch Neon Siege",
    },
    games: {
      eyebrow: "Arcade · Mario-style hub",
      title: "Games",
      lede: "Pick Neon Siege or RunAwan. Gold for fun, logo $AWN coins mined for a future claim.",
      siegeSub: "4 levels · bomb · weapon tiers · superboss",
      runSub: "4 long levels · bricks · bosses · joypad",
      economyHint:
        "Mined $AWN (≥100) queue to the claim pool. On-chain settlement = Owner BatchTransfer — not free mint.",
      runLede:
        "Platformer: climb bricks, smash for power-ups, beat the end boss (fire flower only).",
      starterHint:
        "First play: +15 spendable $AWN (covers the first power-up of the day). Later buys from game balance.",
      powerShop: "$AWN shop (lobby)",
      powerPickupHint:
        "In-run: smash ? bricks for mushroom/fire/star/leaf. Bosses need fire. Pause = emergency shop.",
      livesShop: "Lives / plays",
      livesLede:
        "3 free lives per day. Extra: 1 TON → keeper (max 10 buys/day). RunAwan only.",
      livesLabel: "Lives",
      livesBuy: "Buy 1 life · 1 TON",
      livesBought: "+1 life credited",
      livesDailyCap: "Daily purchase cap reached (10/day)",
      livesNeedBuy: "No lives — buy below",
      livesNone: "Need at least 1 life to play",
      runLevelsHint:
        "L1 Octopus · L2 Werewolf · L3 Medusa · L4 Minotaur — maps 2–3× longer",
      runHintScore: "Score",
      runPause: "Pause",
      runResume: "Resume",
      runPauseTitle: "Pause · Power-ups",
      runBossNeedFire:
        "Boss fight: without a fire flower you cannot damage it. Buy below (TON emergency or $AWN).",
      runShopAwn: "$AWN shop (game balance)",
      runShopAwnHint: "First of the day 15 $AWN · then catalog prices",
      runShopTon: "TON emergency shop (pause / boss)",
      runShopTonHint: "1 TON each → keeper via TonConnect. Best when you lack fire at the boss.",
      runShopBought: "Power-up bought with $AWN",
      runShopBoughtTon: "Power-up unlocked · 1 TON sent",
      runBtnJump: "JUMP",
      runBtnFire: "FIRE",
      runBtnLeaf: "LEAF",
      runBtnPower: "POWER",
      firstPowerHint: "First power-up today: 15 $AWN",
      siegeUpgrades: "Upgrades",
      playRun: "Play RunAwan",
      tokenMenu: "Games wallet · $AWN",
      spendable: "Spendable",
      minedPending: "Mined pending",
      gold: "Gold",
      minedPendingHint:
        "Neon Siege + RunAwan share one mined balance. At ≥100 $AWN you can claim toward the claim pool.",
      claimMined: "Claim → claim pool",
      claimNeedMore: "Need ≥{n} mined $AWN",
      claimNeedWallet: "Connect wallet to claim",
      claimQueued:
        "Queued {amount} $AWN — Owner sees it on Command Deck and settles via BatchTransfer.",
      ownerClaim: "Owner · mined claim queue (hidden)",
      ownerClaimHint:
        "PIN OWNER. Queue all mined $AWN for later claim-pool settlement (BatchTransfer) — does not gift on-chain tokens.",
      queueMined: "Queue mined for claim pool",
      queued: "Mined tokens queued for owner settlement from claim pool.",
      ownerSettle:
        "After queue, Owner settles on Command Deck (Sync queue → Prefill BatchTransfer). No on-chain mint here.",
      comingSoon: "Coming soon",
      comingSoonBadge: "COMING SOON",
      backLive: "Live (in circulation)",
      ownerStatus: "Owner · app status (Coming Soon / Live)",
      ownerStatusHint:
        "PIN OWNER. Toggles apply immediately on this browser (localStorage). For all users, update public/app-status.json.",
      statusGlobal: "Whole miniapp",
      statusSiege: "Neon Siege",
      statusRun: "RunAwan",
      setAllComing: "Set all coming",
      setAllLive: "Set all live",
      clearOverrides: "Clear overrides (use JSON)",
      overrideActive: "Override active on this device",
      globalUpdating: "App updating",
      ownerWallet: "Wallet",
      ownerTelegram: "Telegram",
      ownerTelegramUnknown: "Telegram unavailable",
      ownerSessionPlayer: "Current session (wallet + Telegram) — owner only",
    },
    shop: {
      eyebrow: "Parts bay",
      title: "Upgrades",
      lede: "Pay TON to keeper via TonConnect. Upgrades persist per wallet.",
      owned: "Owned",
      buy: "Buy",
      connect: "Connect wallet",
      acquired: "Acquired. Stats apply next launch.",
    },
    board: {
      eyebrow: "Signal ranks",
      title: "Leaderboard",
      lede: "Top 20 Neon Siege scores (device-local + session).",
      empty: "No scores yet — launch from Games.",
      prize: "Prize events",
      prizeHint:
        "Copy top-wallet JSON (with prize amounts) → Command Deck → Import leaderboard → Prefill BatchTransfer.",
      exportBtn: "Copy prize JSON (top 10)",
      exportCopied: "JSON copied",
      exportEmpty: "No exportable wallets on the board.",
      exportNeedWallet: "Need at least one score with a connected wallet.",
    },
    game: {
      lastRun: "Last run submitted",
      playAgain: "Play again",
      siegeHint: "Drag on canvas · auto-fire · B = bomb",
      bombBuy: "BOMB {ton} TON",
      bombDetonate: "DETONATE",
      bombArmed: "Bomb armed — tap DETONATE",
      bombAlready: "Bomb already used / bought this match",
      bombFailed: "Bomb payment cancelled",
    },
    audio: {
      spotifyTitle: "Spotify",
      pasteLink: "Paste Spotify link…",
      muteGame: "Mute game",
      muteSpotify: "Mute Spotify",
      openSpotify: "Open Spotify",
      close: "Close",
      playingBg: "Music in background",
    },
    roadmap: {
      eyebrow: "Smart contract",
      title: "$AWN Roadmap",
      lede: "How the on-chain token works and what’s next — transparent for every player.",
      viewContract: "Open contract on explorer",
      badgeLive: "LIVE",
      badgeNext: "NEXT",
      badgeLater: "LATER",
      p1Title: "1 · $AWN Jetton",
      p1Body: "TEP-74 token on TON with owner controls, trading switch and blacklist.",
      p1b1: "Fixed supply minted to owner at deploy",
      p1b2: "Trading and sells toggled by owner",
      p1b3: "Blacklist for abusive wallets",
      p2Title: "2 · DEX limits",
      p2Body: "Anti-whale caps on buys and sells vs pool and possession.",
      p2b1: "Buy max = % of DEX vault AWN balance (on-chain)",
      p2b2: "Sell = min(% pool, % of your holdings) when sells are ON",
      p2b3: "On DeDust over limit: TON stays in the pool (no auto refund)",
      p3Title: "3 · Sell tax",
      p3Body: "Each sell to the pool keeps 3% as $AWN tax.",
      p3b1: "Tax accrues in pendingTaxJettons",
      p3b2: "Owner SweepTax → Keeper",
      p3b3: "Keeper can swap and DepositTreasury",
      p4Title: "4 · Weekly claim",
      p4Body: "TON treasury redistributed by weighted eligibility.",
      p4b1: "7-day accrual period",
      p4b2: "24-hour claim window",
      p4b3: "Weight from balance and holding stability",
      p5Title: "5 · Games & mining",
      p5Body: "Games entertain and mine off-chain $AWN for a future pool claim.",
      p5b1: "No free on-chain mint from games",
      p5b2: "Rare drops → mined pending ledger",
      p5b3: "Owner activates claim from the pool when ready",
      p6Title: "6 · Mainnet",
      p6Body: "Public deploy, TON+$AWN pool liquidity, Keeper and live claims.",
      p6b1: "Only after stable testnet",
      p6b2: "Pool TON: owner announces when to deposit",
      p6b3: "Ownership renounce when product is mature",
      specTitle: "Live tech sheet",
      specBuy: "Buy limit",
      specSell: "Sell limit",
      specTax: "Sell tax",
      specClaim: "Claim cycle",
      specGames: "Game rewards",
      specNetwork: "Network",
      specOfPool: "of pool",
      specOfHold: "of holdings",
      specTaxDest: "Keeper / treasury",
      specGamesVal: "Off-chain → claim pool",
      disclaimer:
        "Games do not gift on-chain $AWN. Mined tokens stay queued until the owner claim from the pool. Always verify the contract on the explorer.",
      openFromGames: "Open smart-contract roadmap",
    },
  },
  ru: {
    brandSub: "Games · Mini App",
    nav: {
      home: "Торговля",
      claim: "Клейм",
      hangar: "Ангар",
      games: "Игры",
      board: "Топ",
      wallet: "Кошелёк",
      roadmap: "Roadmap",
    },
    wallet: {
      eyebrow: "On-chain · $AWN",
      title: "Ваш кошелёк",
      lede: "Балансы, участие в claim pool и доход — мини-апп связан с контрактом.",
      connectLede: "Подключите Tonkeeper, чтобы видеть $AWN, пул и клеймы.",
      connect: "Подключить",
      network: "Сеть",
      claimPool: "Claim pool",
      poolYes: "Участник — есть $AWN (вес клейма активен)",
      poolNo: "Не участник — купите/держите $AWN",
      claimedCycle: "уже забран цикл",
      estClaim: "Оценка клейма",
      eligibility: "Статус",
      fullReward: "Полная награда",
      halfReward: "Штраф 50%",
      dex: "Торговля",
      dexPool: "DEX pool",
      earnings: "Всего заработано (клеймы)",
      earningsHint: "Сумма клеймов, записанных на устройстве после ClaimReward.",
      history: "История клеймов",
      historyEmpty: "Пока нет записей.",
      cycle: "Цикл",
      refresh: "Обновить on-chain",
      dualFlowsTitle: "Два пути TON",
      dualFlowsBody:
        "Игровые fee (жизни, бомба, shop) → keeper для ops. Выплаты claim holder → treasury минтера (DepositTreasury). Разные назначения.",
    },
    walletGate: {
      title: "Нужен кошелёк",
      hint: "Подключите кошелёк, чтобы открыть клейм, игры и остальное. График остаётся видимым.",
      connect: "Подключить",
    },
    home: {
      eyebrow: "Лайв фид · пул DeDust",
      buy: "Купить $AWN",
      sell: "Продать $AWN",
      network: "Сеть",
      minter: "Минтер",
      rpc: "RPC",
      hint: "Цена/график = live market. Buy/Sell = Ston.fi в приложении. Не превышайте max buy.",
      chartCaption: "OHLCV 15м · TON за 1 $AWN · обновление каждые 25с",
      feedFail: "Фида DeDust временно нет",
      limitTitle: "Лимиты и налог",
      limitBody:
        "Buy max ≈ {pct} AWN vault → около {maxTon} (≤ {maxAwn}). Sell tax 0%; лимиты sell on-chain.",
      limitDanger:
        "Не используйте DeDust для свопа: сверх лимита TON остаётся в пуле без $AWN. Только Ston.fi.",
      dedustBadge: "NO DEDUST SWAP",
      taxReminder: "Помните: лимиты on-chain · Ston.fi · будущие посты: покупайте на Ston.fi.",
      limitMeta: "Buy cap",
      limitLoadFail: "Не удалось прочитать лимит buy — покупайте осторожно.",
      buyConfirmTitle: "Подтвердите перед Ston.fi",
      buyConfirmBody:
        "Текущий лимит {pct}: держитесь ниже ~{maxTon} (макс. ~{maxAwn} за tx).",
      buyConfirmWarn:
        "Ston.fi проверяет до свопа. Держитесь ниже капа, чтобы не получить отказ.",
      swapLoading: "Загрузка Ston.fi…",
      swapFallback: "Виджет недоступен — откройте Ston.fi.",
      openStonFi: "Открыть Ston.fi",
    },
    claim: {
      eyebrow: "Еженедельный взвешенный клейм",
      title: "Клейм GRAM / TON",
      lede: "7д накопление · 24ч окно · анти-снайпер on-chain",
      program: "Программа",
      inactive: "Неактивна",
      inactiveHint: "Клейм стартует, когда продажи включены на минтере.",
      accrual: "Накопление закончится через",
      accrualHint: "Держите $AWN в цикле. Окно откроется через 7 дней.",
      windowOpen: "Окно клейма открыто",
      windowPhase: "Фаза окна",
      closesIn: "закроется через",
      windowOpenHint: "Отправьте ClaimReward на минтер, пока окно открыто.",
      windowClosedHint: "Окно может открыться при DepositTreasury / Claim.",
      between: "Смена цикла",
      refreshing: "Обновление…",
      cycle: "Цикл",
      treasury: "Казна",
      poolSnap: "Снап пула",
      refresh: "Обновить",
      connectClaim: "Подключить и клейм",
      signing: "Подпись…",
      claimReward: "Забрать награду",
      windowClosedNote: "Кнопка выкл. при закрытом окне; таймер идёт.",
      alreadyClaimed: "Уже получено",
      alreadyClaimedHint:
        "Вы уже забрали цикл #{cycle}. Для вас окно закрыто — без лишних комиссий.",
      alreadyClaimedNote:
        "Клейм в этом цикле уже сделан: кнопка заблокирована. Другие holder ещё могут получить.",
      ownerNoClaim: "Owner исключён",
      ownerNoClaimHint:
        "Кошелёк Owner не может клеймить из пула (крупный остаток / ликвидность запуска).",
      viewMinter: "Минтер в explorer →",
      connectHint: "Подключите кошелёк для проверки eligibility.",
      submitted: "Клейм отправлен — дождитесь подтверждения.",
      dualFlowsHint:
        "Выплаты на этом экране из treasury минтера. Игровые fee (жизни, бомба, shop) идут на keeper — отдельный путь.",
    },
    hangar: {
      eyebrow: "Флот Void Courier",
      title: "Ангар",
      lede: "Выберите неон-силуэт и войдите в AWN: Neon Siege.",
      awnHint:
        "4 уровня · минибосс +5 $AWN · супербосс +10 · бомба 2 TON → keeper (+20 $AWN, 1/матч). Враги крепче при усиленном оружии.",
      launch: "Запуск Neon Siege",
    },
    games: {
      eyebrow: "Аркада · в стиле Mario",
      title: "Игры",
      lede: "Neon Siege или RunAwan. Золото — для веселья, монеты-логотип $AWN — майнинг к будущему клейму.",
      siegeSub: "4 уровня · бомба · тиры оружия · супербосс",
      runSub: "4 длинных уровня · блоки · боссы · джойпад",
      economyHint:
        "Mined $AWN (≥100) в очередь claim pool. Settlement on-chain = Owner BatchTransfer — не бесплатный минт.",
      runLede:
        "Платформер: прыгай по блокам, ломай их ради пауэр-апов, босс в конце (только огненный цветок).",
      starterHint:
        "Первый запуск: +10 spendable $AWN. Первый пауэр-ап дня: 15 $AWN; дальше — с игрового баланса.",
      powerShop: "Магазин $AWN (лобби)",
      powerPickupHint:
        "В забеге: ломай ?-блоки. Боссам нужен огонь. Пауза = экстренный магазин.",
      livesShop: "Жизни / партии",
      livesLede:
        "3 бесплатные жизни в день. Доп.: 1 TON → keeper (макс. 10 покупок/день). Только RunAwan.",
      livesLabel: "Жизни",
      livesBuy: "Купить 1 жизнь · 1 TON",
      livesBought: "+1 жизнь зачислена",
      livesDailyCap: "Дневной лимит покупок (10/день)",
      livesNeedBuy: "Нет жизней — купите ниже",
      livesNone: "Нужна хотя бы 1 жизнь",
      runLevelsHint: "L1 Осьминог · L2 Оборотень · L3 Медуза · L4 Минотавр — карты 2–3× длиннее",
      runHintScore: "Счёт",
      runPause: "Пауза",
      runResume: "Продолжить",
      runPauseTitle: "Пауза · Пауэр-апы",
      runBossNeedFire:
        "Босс: без огненного цветка урон не проходит. Купите ниже (TON или $AWN).",
      runShopAwn: "Магазин $AWN (игровой баланс)",
      runShopAwnHint: "Первый за день 15 $AWN · далее цены каталога",
      runShopTon: "Экстренный TON-магазин (пауза / босс)",
      runShopTonHint: "1 TON каждый → keeper через TonConnect.",
      runShopBought: "Пауэр-ап куплен за $AWN",
      runShopBoughtTon: "Пауэр-ап открыт · 1 TON отправлен",
      runBtnJump: "ПРЫЖОК",
      runBtnFire: "ОГОНЬ",
      runBtnLeaf: "ЛИСТ",
      runBtnPower: "СИЛА",
      firstPowerHint: "Первый пауэр-ап сегодня: 15 $AWN",
      siegeUpgrades: "Апгрейды",
      playRun: "Играть RunAwan",
      tokenMenu: "Кошелёк игр · $AWN",
      spendable: "Spendable",
      minedPending: "Mined в ожидании",
      gold: "Золото",
      minedPendingHint:
        "Neon Siege + RunAwan делят mined-баланс. При ≥100 $AWN можно claim в claim pool.",
      claimMined: "Claim → claim pool",
      claimNeedMore: "Нужно ≥{n} mined $AWN",
      claimNeedWallet: "Подключите кошелёк для claim",
      claimQueued:
        "В очередь {amount} $AWN — Owner видит в Command Deck и платит через BatchTransfer.",
      ownerClaim: "Owner · очередь mined claim (скрыто)",
      ownerClaimHint:
        "PIN OWNER. В очередь весь mined $AWN для позднего settlement из claim pool (BatchTransfer) — не дарит on-chain токены.",
      queueMined: "В очередь mined → claim pool",
      queued: "Mined поставлены в очередь для settlement из claim pool.",
      ownerSettle:
        "После очереди Owner платит в Command Deck (Sync → Prefill BatchTransfer). Без mint здесь.",
      comingSoon: "Скоро",
      comingSoonBadge: "СКОРО",
      backLive: "Live (в обороте)",
      ownerStatus: "Owner · статус приложения (Coming Soon / Live)",
      ownerStatusHint:
        "PIN OWNER. Переключатели сразу на этом браузере (localStorage). Для всех пользователей обновите public/app-status.json.",
      statusGlobal: "Всё мини-приложение",
      statusSiege: "Neon Siege",
      statusRun: "RunAwan",
      setAllComing: "Всё в «скоро»",
      setAllLive: "Всё live",
      clearOverrides: "Сбросить override (JSON)",
      overrideActive: "Override активен на этом устройстве",
      globalUpdating: "Приложение обновляется",
      ownerWallet: "Кошелёк",
      ownerTelegram: "Telegram",
      ownerTelegramUnknown: "Telegram недоступен",
      ownerSessionPlayer: "Текущая сессия (кошелёк + Telegram) — только owner",
    },
    shop: {
      eyebrow: "Отсек деталей",
      title: "Апгрейды",
      lede: "Оплата TON keeper через TonConnect. Апгрейды привязаны к кошельку.",
      owned: "Куплено",
      buy: "Купить",
      connect: "Подключить кошелёк",
      acquired: "Куплено. Статы на следующем запуске.",
    },
    board: {
      eyebrow: "Рейтинг сигнала",
      title: "Таблица лидеров",
      lede: "Топ-20 счётов Neon Siege (локально + сессия).",
      empty: "Пока нет очков — запустите из Игр.",
      prize: "Призовые ивенты",
      prizeHint:
        "Скопируй JSON топ-кошельков → Command Deck → Import leaderboard → Prefill BatchTransfer.",
      exportBtn: "Копировать JSON призов (топ 10)",
      exportCopied: "JSON скопирован",
      exportEmpty: "Нет кошельков для экспорта.",
      exportNeedWallet: "Нужен хотя бы один счёт с подключённым кошельком.",
    },
    game: {
      lastRun: "Последний забег отправлен",
      playAgain: "Ещё раз",
      siegeHint: "Тяни по экрану · автоогонь · B = бомба",
      bombBuy: "БОМБА {ton} TON",
      bombDetonate: "ВЗРЫВ",
      bombArmed: "Бомба готова — нажми ВЗРЫВ",
      bombAlready: "Бомба уже куплена / использована в матче",
      bombFailed: "Оплата бомбы отменена",
    },
    audio: {
      spotifyTitle: "Spotify",
      pasteLink: "Вставьте ссылку Spotify…",
      muteGame: "Без звука игры",
      muteSpotify: "Без звука Spotify",
      openSpotify: "Открыть Spotify",
      close: "Закрыть",
      playingBg: "Музыка в фоне",
    },
    roadmap: {
      eyebrow: "Смарт-контракт",
      title: "Roadmap $AWN",
      lede: "Как работает токен on-chain и что дальше — прозрачно для всех игроков.",
      viewContract: "Открыть контракт в explorer",
      badgeLive: "LIVE",
      badgeNext: "NEXT",
      badgeLater: "LATER",
      p1Title: "1 · Jetton $AWN",
      p1Body: "TEP-74 токен в TON: owner, trading switch и blacklist.",
      p1b1: "Фикс. supply минтится owner при деплое",
      p1b2: "Trading и продажи включает owner",
      p1b3: "Blacklist для злоупотреблений",
      p2Title: "2 · Лимиты DEX",
      p2Body: "Анти-whale: потолки buy/sell по пулу и possession.",
      p2b1: "Buy max = % AWN в DEX vault (on-chain)",
      p2b2: "Sell = min(% пула, % вашего баланса) когда sells ON",
      p2b3: "На DeDust сверх лимита: TON остаётся в пуле (без автовозврата)",
      p3Title: "3 · Sell tax",
      p3Body: "При продаже в пул 3% остаётся как tax в $AWN.",
      p3b1: "Tax в pendingTaxJettons",
      p3b2: "Owner SweepTax → Keeper",
      p3b3: "Keeper может свапнуть и DepositTreasury",
      p4Title: "4 · Недельный claim",
      p4Body: "TON treasury распределяется по весу держателей.",
      p4b1: "Accrual 7 дней",
      p4b2: "Окно claim 24 часа",
      p4b3: "Вес от баланса и стабильности холда",
      p5Title: "5 · Игры и mining",
      p5Body: "Игры развлекают и копят off-chain $AWN для будущего claim из пула.",
      p5b1: "Без бесплатного on-chain минта из игр",
      p5b2: "Редкие дропы → mined pending",
      p5b3: "Owner активирует claim из пула",
      p6Title: "6 · Mainnet",
      p6Body: "Публичный деплой, пул TON+$AWN, Keeper и live claim.",
      p6b1: "Только после стабильного testnet",
      p6b2: "TON в пул: owner объявит когда",
      p6b3: "Renounce ownership при зрелом продукте",
      specTitle: "Техлист (live)",
      specBuy: "Лимит buy",
      specSell: "Лимит sell",
      specTax: "Sell tax",
      specClaim: "Claim cycle",
      specGames: "Награды игр",
      specNetwork: "Сеть",
      specOfPool: "пула",
      specOfHold: "холда",
      specTaxDest: "Keeper / treasury",
      specGamesVal: "Off-chain → claim pool",
      disclaimer:
        "Игры не дарят on-chain $AWN. Mined токены в очереди до claim owner из пула. Всегда проверяйте контракт в explorer.",
      openFromGames: "Открыть roadmap смарт-контракта",
    },
  },
  zh: {
    brandSub: "Games · 小程序",
    nav: {
      home: "交易",
      claim: "领取",
      hangar: "机库",
      games: "游戏",
      board: "排行",
      wallet: "钱包",
      roadmap: "路线图",
    },
    wallet: {
      eyebrow: "链上 · $AWN",
      title: "你的钱包",
      lede: "余额、领取池资格与收益记录 — 小程序与合约打通。",
      connectLede: "连接 Tonkeeper 查看 $AWN、池状态与领取。",
      connect: "连接钱包",
      network: "网络",
      claimPool: "领取池",
      poolYes: "已参与 — 持有 $AWN（领取权重生效）",
      poolNo: "未参与 — 买入/持有 $AWN 进入领取池",
      claimedCycle: "已领取周期",
      estClaim: "预估领取",
      eligibility: "资格",
      fullReward: "全额奖励",
      halfReward: "50% 惩罚",
      dex: "交易",
      dexPool: "DEX 池",
      earnings: "累计领取收益",
      earningsHint: "本设备在每次 ClaimReward 后记录的领取合计。",
      history: "领取记录",
      historyEmpty: "暂无记录。",
      cycle: "周期",
      refresh: "刷新链上数据",
      dualFlowsTitle: "两条 TON 路径",
      dualFlowsBody:
        "游戏费用（生命、炸弹、商店）→ Keeper 运营。持有者领取 → 铸造合约金库（DepositTreasury）。目的地不同。",
    },
    walletGate: {
      title: "需要连接钱包",
      hint: "连接钱包后可使用领取、游戏及其他功能。图表始终可见。",
      connect: "连接钱包",
    },
    home: {
      eyebrow: "实时行情 · DeDust 池",
      buy: "买入 $AWN",
      sell: "卖出 $AWN",
      network: "网络",
      minter: "铸造合约",
      rpc: "RPC",
      hint: "价格/图表 = 实时行情。买卖 = 应用内 Ston.fi。勿超过 max buy。",
      chartCaption: "OHLCV 15m · 每 1 $AWN 的 TON · 每 25 秒刷新",
      feedFail: "DeDust 行情暂时不可用",
      limitTitle: "限额与税费提醒",
      limitBody:
        "买入上限 ≈ vault AWN 的 {pct} → 约 {maxTon}（≤ {maxAwn}）。当前卖出税 0%。",
      limitDanger:
        "请勿在 DeDust 买卖：超限后 TON 留在池中且无 $AWN。请只用 Ston.fi。",
      dedustBadge: "NO DEDUST SWAP",
      taxReminder: "记住：链上限额 · 优先 Ston.fi · 后续宣传：在 Ston.fi 购买。",
      limitMeta: "Buy cap",
      limitLoadFail: "无法读取链上买入限额 — 请谨慎购买。",
      buyConfirmTitle: "打开 Ston.fi 前确认",
      buyConfirmBody:
        "当前限额 {pct}：请保持在 ~{maxTon} 以下（每笔最多 ~{maxAwn}）。",
      buyConfirmWarn:
        "Ston.fi 在成交前校验。请保持在限额内以免交易失败。",
      swapLoading: "正在加载 Ston.fi…",
      swapFallback: "组件不可用 — 请打开 Ston.fi。",
      openStonFi: "打开 Ston.fi",
    },
    claim: {
      eyebrow: "每周加权领取",
      title: "领取 GRAM / TON",
      lede: "7天累积 · 24小时窗口 · 链上防狙击规则",
      program: "计划",
      inactive: "未激活",
      inactiveHint: "铸造合约开启卖出后，领取计划才会启动。",
      accrual: "累积结束于",
      accrualHint: "周期内持有 $AWN。7天后打开领取窗口。",
      windowOpen: "领取窗口已开",
      windowPhase: "窗口阶段",
      closesIn: "关闭倒计时",
      windowOpenHint: "窗口开启时向铸造合约发送 ClaimReward。",
      windowClosedHint: "下次 DepositTreasury / Claim 可能打开窗口。",
      between: "周期切换",
      refreshing: "刷新中…",
      cycle: "周期",
      treasury: "金库",
      poolSnap: "池快照",
      refresh: "刷新",
      connectClaim: "连接并领取",
      signing: "签名中…",
      claimReward: "领取奖励",
      windowClosedNote: "窗口关闭时按钮禁用；倒计时仍运行。",
      alreadyClaimed: "已领取",
      alreadyClaimedHint: "本周期 #{cycle} 已领取。对你窗口已关闭 — 不再产生手续费。",
      alreadyClaimedNote: "本周期已领取：按钮保持锁定。其他持有人仍可领取。",
      ownerNoClaim: "Owner 不可领取",
      ownerNoClaimHint: "Owner 钱包不能从领取池领取（剩余供应 / 启动流动性占比过高）。",
      viewMinter: "在浏览器查看铸造合约 →",
      connectHint: "连接钱包以检查资格。",
      submitted: "已提交领取 — 等待确认后刷新。",
      dualFlowsHint:
        "本页领取来自铸造合约金库。游戏费用（生命、炸弹、商店）进入 Keeper — 另一条路径。",
    },
    hangar: {
      eyebrow: "Void Courier 舰队",
      title: "机库",
      lede: "选择霓虹机型，进入 AWN: Neon Siege。",
      awnHint:
        "4 关 · 小 Boss +5 $AWN · 超级 Boss +10 · 炸弹 2 TON → Keeper（+20 $AWN，每局 1 次）。武器越强敌人越硬。",
      launch: "启动 Neon Siege",
    },
    games: {
      eyebrow: "街机 · 马里奥风格大厅",
      title: "游戏",
      lede: "选择 Neon Siege 或 RunAwan。金币仅娱乐，Logo $AWN 币计入未来领取。",
      siegeSub: "4 关 · 炸弹 · 武器等级 · 超级 Boss",
      runSub: "4 长关 · 砖块 · Boss · 虚拟摇杆",
      economyHint:
        "已挖 $AWN（≥100）进入领取池队列。链上结算 = Owner BatchTransfer — 非免费铸造。",
      runLede: "平台跳跃：踩砖、砸砖开道具，关底 Boss（仅火花可伤）。",
      starterHint: "首次：+10 可花费 $AWN。当日首个道具 15 $AWN；之后从游戏余额扣。",
      powerShop: "$AWN 商店（大厅）",
      powerPickupHint: "关内砸 ? 砖获蘑菇/火花/星星/叶子。Boss 需火花。暂停=应急商店。",
      livesShop: "生命 / 次数",
      livesLede: "每日 3 次免费。额外：1 TON → Keeper（每天最多买 10 次）。仅 RunAwan。",
      livesLabel: "生命",
      livesBuy: "购买 1 生命 · 1 TON",
      livesBought: "+1 生命已到账",
      livesDailyCap: "已达每日购买上限（10/天）",
      livesNeedBuy: "没有生命 — 请在下方购买",
      livesNone: "至少需要 1 点生命才能开始",
      runLevelsHint: "L1 章鱼 · L2 狼人 · L3 美杜莎 · L4 弥诺陶 — 地图长约 2–3 倍",
      runHintScore: "分数",
      runPause: "暂停",
      runResume: "继续",
      runPauseTitle: "暂停 · 道具",
      runBossNeedFire: "Boss 战：没有火花无法造成伤害。请在下方购买（TON 应急或 $AWN）。",
      runShopAwn: "$AWN 商店（游戏余额）",
      runShopAwnHint: "当日首次 15 $AWN · 之后按目录价",
      runShopTon: "TON 应急店（暂停 / Boss）",
      runShopTonHint: "每个 1 TON → 经 TonConnect 付给 Keeper。",
      runShopBought: "已用 $AWN 购买道具",
      runShopBoughtTon: "道具已解锁 · 已发送 1 TON",
      runBtnJump: "跳",
      runBtnFire: "火",
      runBtnLeaf: "叶",
      runBtnPower: "技",
      firstPowerHint: "今日首个道具：15 $AWN",
      siegeUpgrades: "升级",
      playRun: "开始 RunAwan",
      tokenMenu: "游戏钱包 · $AWN",
      spendable: "可花费",
      minedPending: "已挖待领",
      gold: "金币",
      minedPendingHint:
        "Neon Siege 与 RunAwan 共用已挖余额。达到 ≥100 $AWN 可向领取池领取。",
      claimMined: "领取 → 领取池",
      claimNeedMore: "需要 ≥{n} 已挖 $AWN",
      claimNeedWallet: "连接钱包后领取",
      claimQueued: "已将 {amount} $AWN 排队 — Owner 在 Command Deck 可见并用 BatchTransfer 结算。",
      ownerClaim: "Owner · 已挖领取队列（隐藏）",
      ownerClaimHint:
        "PIN 输入 OWNER。将全部已挖 $AWN 排队，供日后从领取池 BatchTransfer 结算 — 不会赠送链上代币。",
      queueMined: "将已挖加入领取池队列",
      queued: "已挖代币已加入 owner 领取池结算队列。",
      ownerSettle:
        "排队后由 Owner 在 Command Deck 结算（同步队列 → Prefill BatchTransfer）。此处不铸币。",
      comingSoon: "即将上线",
      comingSoonBadge: "即将上线",
      backLive: "上线（流通中）",
      ownerStatus: "Owner · 应用状态（即将上线 / 上线）",
      ownerStatusHint:
        "PIN 输入 OWNER。开关仅立即作用于本浏览器（localStorage）。面向所有用户请更新 public/app-status.json。",
      statusGlobal: "整个小程序",
      statusSiege: "Neon Siege",
      statusRun: "RunAwan",
      setAllComing: "全部即将上线",
      setAllLive: "全部上线",
      clearOverrides: "清除覆盖（使用 JSON）",
      overrideActive: "本设备覆盖已启用",
      globalUpdating: "应用更新中",
      ownerWallet: "钱包",
      ownerTelegram: "Telegram",
      ownerTelegramUnknown: "无 Telegram",
      ownerSessionPlayer: "当前会话（钱包 + Telegram）— 仅 owner",
    },
    shop: {
      eyebrow: "零件舱",
      title: "升级",
      lede: "通过 TonConnect 向 Keeper 支付 TON。升级按钱包保存。",
      owned: "已拥有",
      buy: "购买",
      connect: "连接钱包",
      acquired: "已获得。下次启动生效。",
    },
    board: {
      eyebrow: "信号排行",
      title: "排行榜",
      lede: "Neon Siege 前20名（本机 + 会话）。",
      empty: "暂无分数 — 从游戏开始。",
      prize: "奖励活动",
      prizeHint:
        "复制前排钱包 JSON → Command Deck → Import leaderboard → Prefill BatchTransfer。",
      exportBtn: "复制奖励 JSON（前10）",
      exportCopied: "已复制 JSON",
      exportEmpty: "排行榜无可导出钱包。",
      exportNeedWallet: "至少需要一条已连接钱包的成绩。",
    },
    game: {
      lastRun: "本局分数已提交",
      playAgain: "再玩",
      siegeHint: "拖动画布 · 自动开火 · B = 炸弹",
      bombBuy: "炸弹 {ton} TON",
      bombDetonate: "引爆",
      bombArmed: "炸弹已就绪 — 点引爆",
      bombAlready: "本局已购买/使用过炸弹",
      bombFailed: "炸弹支付已取消",
    },
    audio: {
      spotifyTitle: "Spotify",
      pasteLink: "粘贴 Spotify 链接…",
      muteGame: "静音游戏",
      muteSpotify: "静音 Spotify",
      openSpotify: "打开 Spotify",
      close: "关闭",
      playingBg: "后台播放中",
    },
    roadmap: {
      eyebrow: "智能合约",
      title: "$AWN 路线图",
      lede: "链上代币如何运作、下一步是什么 — 对所有玩家透明。",
      viewContract: "在浏览器打开合约",
      badgeLive: "LIVE",
      badgeNext: "NEXT",
      badgeLater: "LATER",
      p1Title: "1 · $AWN Jetton",
      p1Body: "TON 上的 TEP-74 代币：owner、交易开关与黑名单。",
      p1b1: "部署时向 owner 铸造固定供应量",
      p1b2: "交易与卖出由 owner 开关",
      p1b3: "滥用地址可进黑名单",
      p2Title: "2 · DEX 限额",
      p2Body: "防巨鲸：买卖相对池与持仓设上限。",
      p2b1: "买入上限 = DEX vault AWN 的链上 %",
      p2b2: "卖出开启后 = min(池 %, 持仓 %)",
      p2b3: "DeDust 超限：TON 留在池中（无自动退款）",
      p3Title: "3 · 卖出税",
      p3Body: "向池卖出时保留 3% 为 $AWN 税。",
      p3b1: "税累计在 pendingTaxJettons",
      p3b2: "Owner SweepTax → Keeper",
      p3b3: "Keeper 可兑换并 DepositTreasury",
      p4Title: "4 · 每周领取",
      p4Body: "TON 金库按权重分给合格持有者。",
      p4b1: "累计期 7 天",
      p4b2: "领取窗口 24 小时",
      p4b3: "权重来自余额与持有稳定性",
      p5Title: "5 · 游戏与挖矿",
      p5Body: "游戏娱乐并链下挖矿 $AWN，供未来从池领取。",
      p5b1: "游戏不会免费链上铸造",
      p5b2: "稀有掉落 → 待领取账本",
      p5b3: "Owner 就绪后从池激活领取",
      p6Title: "6 · 主网",
      p6Body: "公开部署、TON+$AWN 池流动性、Keeper 与正式领取。",
      p6b1: "仅在测试网稳定后",
      p6b2: "池 TON：由 owner 宣布何时存入",
      p6b3: "产品成熟后放弃 ownership",
      specTitle: "技术卡片（当前）",
      specBuy: "买入限额",
      specSell: "卖出限额",
      specTax: "卖出税",
      specClaim: "领取周期",
      specGames: "游戏奖励",
      specNetwork: "网络",
      specOfPool: "池占比",
      specOfHold: "持仓占比",
      specTaxDest: "Keeper / 金库",
      specGamesVal: "链下 → 领取池",
      disclaimer:
        "游戏不会赠送链上 $AWN。已挖代币排队至 owner 从池领取。请始终在浏览器核对合约。",
      openFromGames: "打开智能合约路线图",
    },
  },
};
