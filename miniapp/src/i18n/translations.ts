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
    siegeUpgrades: string;
    playRun: string;
    tokenMenu: string;
    spendable: string;
    minedPending: string;
    gold: string;
    minedPendingHint: string;
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
  };
  game: {
    lastRun: string;
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
      games: "Games",
      board: "Classifica",
      wallet: "Wallet",
      roadmap: "Roadmap",
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
    },
    walletGate: {
      title: "Wallet richiesto",
      hint: "Collega il wallet per sbloccare claim, giochi e il resto dell’app. Il grafico resta visibile.",
      connect: "Collega wallet",
    },
    home: {
      eyebrow: "Feed live · DEX mock",
      buy: "Compra",
      sell: "Vendi",
      network: "Rete",
      minter: "Minter",
      rpc: "RPC",
      hint: "Grafico mock locale (refresh 2.5s). Collega DeDust/STON.fi dopo. Compra/Vendi apre l’explorer.",
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
    },
    hangar: {
      eyebrow: "Flotta Void Courier",
      title: "Hangar",
      lede: "Scegli una silhouette neon, poi entra in AWN: Neon Siege.",
      awnHint:
        "Boss e velivoli elite possono minare $AWN (piccole quantità, chance legata alla difficoltà).",
      launch: "Lancia Neon Siege",
    },
    games: {
      eyebrow: "Sala giochi · stile Mario",
      title: "Games",
      lede: "Scegli Neon Siege o AWN Run. Oro per divertimento, monete logo $AWN minate per claim futuro.",
      siegeSub: "Shooter vertical neon · navi e upgrade",
      runSub: "Platformer · monete oro + $AWN (~14%)",
      economyHint:
        "I $AWN minati in gioco sono in attesa (held). Solo l'owner attiva il claim nascosto: il settlement arriva dal claim pool — non sono mint gratis.",
      runLede: "Corri, salta, raccogli. Il giocatore è il logo $AWN.",
      starterHint: "Prima partita: +10 $AWN spendibili per fungo, fiore, stella, foglia.",
      powerShop: "Power-up Mario-like",
      siegeUpgrades: "Potenziamenti",
      playRun: "Gioca AWN Run",
      tokenMenu: "Wallet giochi · $AWN",
      spendable: "Spendibili",
      minedPending: "Minati in attesa",
      gold: "Oro",
      minedPendingHint:
        "Neon Siege + AWN Run condividono lo stesso saldo minato. In claim si scambiano dal pool, non si mintano.",
      ownerClaim: "Owner · coda claim minati (nascosto)",
      ownerClaimHint:
        "PIN OWNER. Accoda tutti i $AWN minati per settlement futuro dal claim pool (BatchTransfer) — non regala token on-chain.",
      queueMined: "Accoda minati per claim pool",
      queued: "Minati accodati per settlement owner dal claim pool.",
      ownerSettle: "Settlement on-chain solo dal Command Deck / claim pool — non da questa UI.",
      comingSoon: "In arrivo",
      comingSoonBadge: "IN ARRIVO",
      backLive: "Live (in circolo)",
      ownerStatus: "Owner · stato app (Coming Soon / Live)",
      ownerStatusHint:
        "PIN OWNER. I toggle valgono subito su questo browser (localStorage). Per tutti gli utenti aggiorna public/app-status.json.",
      statusGlobal: "Tutta la miniapp",
      statusSiege: "Neon Siege",
      statusRun: "AWN Run",
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
        "Esporta i top wallet → BatchTransfer dal Command Deck per premi in $AWN. Vedi README.",
    },
    game: { lastRun: "Ultima run inviata" },
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
      p2b1: "Buy max 0,5% del saldo AWN in pool",
      p2b2: "Sell = min(0,5% pool, 0,5% del tuo possesso)",
      p2b3: "Oltre il limite la tx viene rifiutata",
      p3Title: "3 · Sell tax 3%",
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
    },
    walletGate: {
      title: "Wallet required",
      hint: "Connect your wallet to unlock claim, games, and the rest of the app. The chart stays visible.",
      connect: "Connect wallet",
    },
    home: {
      eyebrow: "Live feed · mock DEX",
      buy: "Buy",
      sell: "Sell",
      network: "Network",
      minter: "Minter",
      rpc: "RPC",
      hint: "Local mock chart (2.5s refresh). Hook DeDust/STON.fi later. Buy/Sell opens explorer.",
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
    },
    hangar: {
      eyebrow: "Void Courier fleet",
      title: "Hangar",
      lede: "Choose a neon silhouette, then enter AWN: Neon Siege.",
      awnHint:
        "Bosses & elite craft can mine $AWN (small amounts; chance scales with difficulty).",
      launch: "Launch Neon Siege",
    },
    games: {
      eyebrow: "Arcade · Mario-style hub",
      title: "Games",
      lede: "Pick Neon Siege or AWN Run. Gold for fun, logo $AWN coins mined for a future claim.",
      siegeSub: "Neon vertical shooter · ships & upgrades",
      runSub: "Platformer · gold + $AWN coins (~14%)",
      economyHint:
        "Game-mined $AWN are held pending. Only the owner activates the hidden claim; settlement comes from the claim pool — not free mint.",
      runLede: "Run, jump, collect. You are the $AWN logo.",
      starterHint: "First play: +10 spendable $AWN for mushroom, flower, star, leaf.",
      powerShop: "Mario-like power-ups",
      siegeUpgrades: "Upgrades",
      playRun: "Play AWN Run",
      tokenMenu: "Games wallet · $AWN",
      spendable: "Spendable",
      minedPending: "Mined pending",
      gold: "Gold",
      minedPendingHint:
        "Neon Siege + AWN Run share one mined balance. At claim they settle from the pool — not minted.",
      ownerClaim: "Owner · mined claim queue (hidden)",
      ownerClaimHint:
        "PIN OWNER. Queue all mined $AWN for later claim-pool settlement (BatchTransfer) — does not gift on-chain tokens.",
      queueMined: "Queue mined for claim pool",
      queued: "Mined tokens queued for owner settlement from claim pool.",
      ownerSettle: "On-chain settlement only via Command Deck / claim pool — not from this UI.",
      comingSoon: "Coming soon",
      comingSoonBadge: "COMING SOON",
      backLive: "Live (in circulation)",
      ownerStatus: "Owner · app status (Coming Soon / Live)",
      ownerStatusHint:
        "PIN OWNER. Toggles apply immediately on this browser (localStorage). For all users, update public/app-status.json.",
      statusGlobal: "Whole miniapp",
      statusSiege: "Neon Siege",
      statusRun: "AWN Run",
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
      prizeHint: "Export top wallets → Command Deck BatchTransfer for $AWN prizes. See README.",
    },
    game: { lastRun: "Last run submitted" },
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
      p2b1: "Buy max 0.5% of pool AWN balance",
      p2b2: "Sell = min(0.5% pool, 0.5% of your holdings)",
      p2b3: "Over-limit transfers are rejected",
      p3Title: "3 · 3% sell tax",
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
    },
    walletGate: {
      title: "Нужен кошелёк",
      hint: "Подключите кошелёк, чтобы открыть клейм, игры и остальное. График остаётся видимым.",
      connect: "Подключить",
    },
    home: {
      eyebrow: "Лайв фид · mock DEX",
      buy: "Купить",
      sell: "Продать",
      network: "Сеть",
      minter: "Минтер",
      rpc: "RPC",
      hint: "Локальный mock-график (2.5с). Позже DeDust/STON.fi. Купить/Продать — explorer.",
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
    },
    hangar: {
      eyebrow: "Флот Void Courier",
      title: "Ангар",
      lede: "Выберите неон-силуэт и войдите в AWN: Neon Siege.",
      awnHint:
        "Боссы и элитные корабли могут майнить $AWN (мало; шанс растёт с сложностью).",
      launch: "Запуск Neon Siege",
    },
    games: {
      eyebrow: "Аркада · в стиле Mario",
      title: "Игры",
      lede: "Neon Siege или AWN Run. Золото — для веселья, монеты-логотип $AWN — майнинг к будущему клейму.",
      siegeSub: "Вертикальный шутер · корабли и апгрейды",
      runSub: "Платформер · золото + $AWN (~14%)",
      economyHint:
        "Добытые в играх $AWN удерживаются (pending). Только owner активирует скрытый claim; settlement из claim pool — не бесплатный минт.",
      runLede: "Беги, прыгай, собирай. Игрок — логотип $AWN.",
      starterHint: "Первый запуск: +10 spendable $AWN на гриб, цветок, звезду, лист.",
      powerShop: "Пауэр-апы как в Mario",
      siegeUpgrades: "Апгрейды",
      playRun: "Играть AWN Run",
      tokenMenu: "Кошелёк игр · $AWN",
      spendable: "Spendable",
      minedPending: "Mined в ожидании",
      gold: "Золото",
      minedPendingHint:
        "Neon Siege + AWN Run делят один mined-баланс. При claim — обмен из пула, не минт.",
      ownerClaim: "Owner · очередь mined claim (скрыто)",
      ownerClaimHint:
        "PIN OWNER. В очередь весь mined $AWN для позднего settlement из claim pool (BatchTransfer) — не дарит on-chain токены.",
      queueMined: "В очередь mined → claim pool",
      queued: "Mined поставлены в очередь для settlement из claim pool.",
      ownerSettle: "On-chain settlement только через Command Deck / claim pool — не из этого UI.",
      comingSoon: "Скоро",
      comingSoonBadge: "СКОРО",
      backLive: "Live (в обороте)",
      ownerStatus: "Owner · статус приложения (Coming Soon / Live)",
      ownerStatusHint:
        "PIN OWNER. Переключатели сразу на этом браузере (localStorage). Для всех пользователей обновите public/app-status.json.",
      statusGlobal: "Всё мини-приложение",
      statusSiege: "Neon Siege",
      statusRun: "AWN Run",
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
      prizeHint: "Экспорт топ-кошельков → BatchTransfer в Command Deck ($AWN).",
    },
    game: { lastRun: "Последний забег отправлен" },
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
      p2b1: "Buy max 0,5% AWN в пуле",
      p2b2: "Sell = min(0,5% пула, 0,5% вашего баланса)",
      p2b3: "Сверх лимита tx отклоняется",
      p3Title: "3 · Sell tax 3%",
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
    },
    walletGate: {
      title: "需要连接钱包",
      hint: "连接钱包后可使用领取、游戏及其他功能。图表始终可见。",
      connect: "连接钱包",
    },
    home: {
      eyebrow: "实时行情 · 模拟 DEX",
      buy: "买入",
      sell: "卖出",
      network: "网络",
      minter: "铸造合约",
      rpc: "RPC",
      hint: "本地模拟图表（2.5秒刷新）。稍后可接 DeDust/STON.fi。买卖打开浏览器。",
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
    },
    hangar: {
      eyebrow: "Void Courier 舰队",
      title: "机库",
      lede: "选择霓虹机型，进入 AWN: Neon Siege。",
      awnHint: "击败 Boss 与精英战机可挖矿 $AWN（少量；概率随难度温和提升）。",
      launch: "启动 Neon Siege",
    },
    games: {
      eyebrow: "街机 · 马里奥风格大厅",
      title: "游戏",
      lede: "选择 Neon Siege 或 AWN Run。金币仅娱乐，Logo $AWN 币计入未来领取。",
      siegeSub: "霓虹竖版射击 · 战机与升级",
      runSub: "平台跑酷 · 金币 + $AWN（约 14%）",
      economyHint:
        "游戏挖到的 $AWN 为待领取持有。仅 owner 可激活隐藏领取；结算来自领取池 — 非免费铸造。",
      runLede: "奔跑跳跃收集。玩家角色是 $AWN Logo。",
      starterHint: "首次游戏：+10 可花费 $AWN，用于蘑菇、火花、星星、叶子。",
      powerShop: "马里奥风格道具",
      siegeUpgrades: "升级",
      playRun: "开始 AWN Run",
      tokenMenu: "游戏钱包 · $AWN",
      spendable: "可花费",
      minedPending: "已挖待领",
      gold: "金币",
      minedPendingHint:
        "Neon Siege 与 AWN Run 共用同一已挖余额。领取时从池兑换，不铸造。",
      ownerClaim: "Owner · 已挖领取队列（隐藏）",
      ownerClaimHint:
        "PIN 输入 OWNER。将全部已挖 $AWN 排队，供日后从领取池 BatchTransfer 结算 — 不会赠送链上代币。",
      queueMined: "将已挖加入领取池队列",
      queued: "已挖代币已加入 owner 领取池结算队列。",
      ownerSettle: "链上结算仅通过 Command Deck / 领取池 — 不在此界面完成。",
      comingSoon: "即将上线",
      comingSoonBadge: "即将上线",
      backLive: "上线（流通中）",
      ownerStatus: "Owner · 应用状态（即将上线 / 上线）",
      ownerStatusHint:
        "PIN 输入 OWNER。开关仅立即作用于本浏览器（localStorage）。面向所有用户请更新 public/app-status.json。",
      statusGlobal: "整个小程序",
      statusSiege: "Neon Siege",
      statusRun: "AWN Run",
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
      prizeHint: "导出前排钱包 → Command Deck BatchTransfer 发放 $AWN。见 README。",
    },
    game: { lastRun: "本局分数已提交" },
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
      p2b1: "买入最多为池内 AWN 的 0.5%",
      p2b2: "卖出 = min(池 0.5%, 持仓 0.5%)",
      p2b3: "超限交易会被拒绝",
      p3Title: "3 · 卖出税 3%",
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
