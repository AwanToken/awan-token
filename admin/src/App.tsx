import { useCallback, useEffect, useMemo, useState } from "react";
import { TonConnectButton, useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DeployStatusPanel } from "./components/DeployStatusPanel";
import { TokenMarketPanel } from "./components/TokenMarketPanel";
import {
  CLAIM_PERIOD,
  CLAIM_WINDOW,
  DEAD_OWNER,
  DEFAULT_KEEPER,
  EXPLORER,
  MINTER,
  NETWORK,
  OWNER_JETTON_WALLET,
} from "./config";
import { DEDUST_POOL } from "./lib/dedustFeed";
import {
  fetchMarketSnapshot,
  type MarketSnapshot,
} from "./lib/geckoMarket";
import { formatTinyPrice } from "./lib/formatTinyPrice";
import {
  HOLDERS_LS_KEY,
  formatAwnDisplay,
  importHolderRegistryJson,
  loadHolderRegistry,
  saveHolderRegistry,
  summarizeTokenLocation,
  syncHoldersFromNetwork,
  type HolderRow,
} from "./lib/holders";
import {
  importLeaderboardPrizeJson,
  leaderboardPrizesToBatchText,
  totalPrizeAwn,
} from "./lib/leaderboardPrizes";
import {
  MINED_QUEUE_LS_KEY,
  clearRemoteMinedQueue,
  fetchRemoteMinedQueue,
  importMinedQueueJson,
  loadLocalMinedQueue,
  mergeMinedQueues,
  minedQueueToBatchText,
  minedQueueTopHint,
  saveLocalMinedQueue,
  telegramLabel,
  totalMinedQueued,
  type MinedQueueEntry,
} from "./lib/minedQueue";
import {
  bodyBlacklist,
  bodyBatchTransfer,
  bodyChangeOwner,
  bodyDepositTreasury,
  bodyDexLimits,
  bodyEnableTrading,
  bodySetBuyLimitBp,
  bodySetSellLimitBp,
  bodySetSellTaxBp,
  bodyForceCloseClaimWindow,
  bodyForceOpenClaimWindow,
  bodyJettonTransfer,
  bodyPushConfig,
  bodySetClaimPeriodDays,
  bodySetClaimProgramActive,
  bodySetSell,
  bodySweepTaxJettons,
  fetchAccountTonBalance,
  fetchLiveState,
  fromNanoTon,
  fromUnits,
  isBlacklisted,
  toNano,
  toUnits,
} from "./lib/ton";

type LogItem = { t: string; msg: string; kind?: "ok" | "err" };
type ChartPoint = { t: string; buy: number; sell: number; treasury: number };

const LS_CHART = "awn_admin_chart";
const LS_MINIAPP = "awn_admin_miniapp_status";
const LS_CLAIM_PERIOD = "awn_admin_claim_period_sec";
const LS_CLAIM_TEST_1M = "awn_admin_claim_test_1m";
/** Deck-only ops test accrual (UI countdown). On-chain still 1/3/5/7d via SetClaimPeriodDays. */
const CLAIM_TEST_PERIOD_SEC = 60;

type MiniStatus = "live" | "coming";
type MiniappStatusDraft = {
  global: MiniStatus;
  games: { siege: MiniStatus; run: MiniStatus };
  message: { it: string; en: string; ru: string; zh: string };
};

const DEFAULT_MINIAPP: MiniappStatusDraft = {
  global: "live",
  games: { siege: "live", run: "live" },
  message: {
    it: "Stiamo aggiornando l'app. Torna a breve — in arrivo!",
    en: "We're updating the app. Back soon — coming soon!",
    ru: "Мы обновляем приложение. Скоро вернёмся — скоро!",
    zh: "应用升级中，稍后再来 — 即将上线！",
  },
};

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function fmtCountdown(sec: number) {
  if (sec < 0) sec = 0;
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${d}d ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function App() {
  const wallet = useTonAddress();
  const [tonConnectUI] = useTonConnectUI();

  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [tradingOn, setTradingOn] = useState(false);
  const [sellOn, setSellOn] = useState(false);
  const [limitsOn, setLimitsOn] = useState(true);
  const [maxBuyBp, setMaxBuyBp] = useState(300);
  const [maxSellBp, setMaxSellBp] = useState(300);
  const [buyBpDraft, setBuyBpDraft] = useState("1500");
  const [sellBpDraft, setSellBpDraft] = useState("300");
  const [taxBpDraft, setTaxBpDraft] = useState("300");
  const [treasury, setTreasury] = useState("0");
  const [pendingTax, setPendingTax] = useState("0");
  const [pendingTaxRaw, setPendingTaxRaw] = useState(0n);
  const [supply, setSupply] = useState("0");
  const [dexPool, setDexPool] = useState<string | null>(null);
  const [cycleStart, setCycleStart] = useState(0);
  const [claimWindowEnd, setClaimWindowEnd] = useState(0);
  const [claimWindowOpen, setClaimWindowOpen] = useState(false);
  const [claimActive, setClaimActive] = useState(false);
  const [claimPeriodSec, setClaimPeriodSec] = useState(() =>
    loadJson(LS_CLAIM_PERIOD, CLAIM_PERIOD),
  );
  const [claimTest1m, setClaimTest1m] = useState(() =>
    loadJson(LS_CLAIM_TEST_1M, false),
  );
  /** Local accrual start for TEST 1m UI countdown (not written on-chain). */
  const [claimTestCycleStart, setClaimTestCycleStart] = useState<number | null>(
    null,
  );
  const [sellTaxBp, setSellTaxBp] = useState(0);
  const [liveSyncOk, setLiveSyncOk] = useState(false);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  const [holders, setHolders] = useState<HolderRow[]>(() => loadHolderRegistry());
  const [holdersImport, setHoldersImport] = useState("");

  const [blAddr, setBlAddr] = useState("");
  const [blStatus, setBlStatus] = useState("");

  const [sendTo, setSendTo] = useState("");
  const [sendAmt, setSendAmt] = useState("1000");
  const [batchText, setBatchText] = useState("EQ...\n1000\nEQ...\n500");
  const [depositTon, setDepositTon] = useState("0.1");

  const [keeperDest, setKeeperDest] = useState(DEFAULT_KEEPER);
  const [sweepAmt, setSweepAmt] = useState("");
  const [keeperDepositTon, setKeeperDepositTon] = useState("0.1");

  const [renounceTo, setRenounceTo] = useState(DEAD_OWNER);
  const [renounceConfirm, setRenounceConfirm] = useState("");

  const [chart, setChart] = useState<ChartPoint[]>(() =>
    loadJson(LS_CHART, [] as ChartPoint[]),
  );
  const [market, setMarket] = useState<MarketSnapshot | null>(null);
  const [marketErr, setMarketErr] = useState("");
  const [keeperCopied, setKeeperCopied] = useState(false);
  const [keeperTonBal, setKeeperTonBal] = useState<string>("—");
  const [minedQueue, setMinedQueue] = useState<MinedQueueEntry[]>(() =>
    loadLocalMinedQueue(),
  );
  const [minedImport, setMinedImport] = useState("");
  const [minedBusy, setMinedBusy] = useState(false);
  const [lbImport, setLbImport] = useState("");
  const [mini, setMini] = useState<MiniappStatusDraft>(() =>
    loadJson(LS_MINIAPP, DEFAULT_MINIAPP),
  );
  const [miniCopied, setMiniCopied] = useState(false);

  useEffect(() => {
    localStorage.setItem(LS_MINIAPP, JSON.stringify(mini));
  }, [mini]);

  const miniJson = useMemo(
    () =>
      JSON.stringify(
        {
          _comment:
            "Runtime Coming Soon / Live. Paste into miniapp/public/app-status.json and redeploy that asset for all users.",
          global: mini.global,
          games: mini.games,
          message: mini.message,
        },
        null,
        2,
      ),
    [mini],
  );

  function setMiniStatus(
    key: "global" | "siege" | "run",
    value: MiniStatus,
  ) {
    setMini((prev) => {
      if (key === "global") return { ...prev, global: value };
      return { ...prev, games: { ...prev.games, [key]: value } };
    });
  }

  function setAllMini(value: MiniStatus) {
    setMini((prev) => ({
      ...prev,
      global: value,
      games: { siege: value, run: value },
    }));
  }

  async function copyMiniJson() {
    try {
      await navigator.clipboard.writeText(miniJson);
      setMiniCopied(true);
      log("app-status.json copiato negli appunti", "ok");
      window.setTimeout(() => setMiniCopied(false), 2000);
    } catch (e) {
      log(String(e), "err");
    }
  }

  const log = useCallback((msg: string, kind?: "ok" | "err") => {
    setLogs((prev) => [
      { t: new Date().toLocaleTimeString(), msg, kind },
      ...prev.slice(0, 80),
    ]);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const st = await fetchLiveState();
      setTradingOn(st.isTradingEnabled);
      setSellOn(st.isSellEnabled);
      setLimitsOn(st.isDexLimitsEnabled);
      setMaxBuyBp(st.maxBuyLimitBp);
      setMaxSellBp(st.maxSellLimitBp);
      setSellTaxBp(st.sellTaxBp);
      setDexPool(st.dexPool);
      setTreasury(fromUnits(st.treasury));
      setPendingTax(fromUnits(st.pendingTaxJettons));
      setPendingTaxRaw(st.pendingTaxJettons);
      setSupply(fromUnits(st.totalSupply));
      setCycleStart(st.cycleStart);
      setClaimWindowEnd(st.claimWindowEnd);
      setClaimWindowOpen(st.claimWindowOpen);
      setClaimActive(st.claimProgramActive);
      setLiveSyncOk(true);

      const point: ChartPoint = {
        t: new Date().toLocaleTimeString(),
        buy: st.isTradingEnabled ? 1 : 0,
        sell: st.isSellEnabled ? 1 : 0,
        treasury: Number(fromUnits(st.treasury)) || 0,
      };
      setChart((prev) => {
        const next = [...prev, point].slice(-24);
        localStorage.setItem(LS_CHART, JSON.stringify(next));
        return next;
      });
      log("Sync on-chain OK", "ok");
    } catch (e) {
      setLiveSyncOk(false);
      log(`Sync fail: ${e instanceof Error ? e.message : String(e)}`, "err");
    }
  }, [log]);

  useEffect(() => {
    void refresh();
    const a = setInterval(() => void refresh(), 20000);
    const b = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => {
      clearInterval(a);
      clearInterval(b);
    };
  }, [refresh]);

  useEffect(() => {
    saveHolderRegistry(holders);
  }, [holders]);

  useEffect(() => {
    saveLocalMinedQueue(minedQueue);
  }, [minedQueue]);

  useEffect(() => {
    let cancelled = false;
    const loadKeeperBal = async () => {
      try {
        const nano = await fetchAccountTonBalance(keeperDest.trim() || DEFAULT_KEEPER);
        if (!cancelled) setKeeperTonBal(fromNanoTon(nano));
      } catch {
        if (!cancelled) setKeeperTonBal("—");
      }
    };
    void loadKeeperBal();
    const t = setInterval(() => void loadKeeperBal(), 30000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [keeperDest]);

  const syncHolders = useCallback(async () => {
    setBusy(true);
    try {
      const rows = await syncHoldersFromNetwork(loadHolderRegistry());
      setHolders(rows);
      const loc = summarizeTokenLocation(rows);
      const withTg = rows.filter((r) => r.telegram && r.telegram !== "—").length;
      log(
        `Holders sync · ${loc.holderCount} on-chain · ${withTg} con @Telegram · Owner ${formatAwnDisplay(String(loc.owner))} · Vault LP ${formatAwnDisplay(String(loc.liquidityVault))}`,
        "ok",
      );
    } catch (e) {
      log(`Holders sync fail: ${e instanceof Error ? e.message : String(e)}`, "err");
    } finally {
      setBusy(false);
    }
  }, [log]);

  const tokenLocation = useMemo(() => summarizeTokenLocation(holders), [holders]);
  const minedTotal = useMemo(() => totalMinedQueued(minedQueue), [minedQueue]);
  const minedAlert = minedQueue.length > 0 || minedTotal > 0;
  const minedHint = useMemo(() => minedQueueTopHint(minedQueue), [minedQueue]);

  const syncMinedQueue = useCallback(async () => {
    setMinedBusy(true);
    try {
      const remote = await fetchRemoteMinedQueue();
      const merged = mergeMinedQueues(loadLocalMinedQueue(), remote);
      setMinedQueue(merged);
      log(
        `Coda mined sync · ${merged.length} voci · ${totalMinedQueued(merged)} $AWN`,
        "ok",
      );
    } catch (e) {
      log(`Mined queue sync fail: ${e instanceof Error ? e.message : String(e)}`, "err");
    } finally {
      setMinedBusy(false);
    }
  }, [log]);

  const importMinedQueue = useCallback(() => {
    try {
      const imported = importMinedQueueJson(minedImport);
      const merged = mergeMinedQueues(minedQueue, imported);
      setMinedQueue(merged);
      setMinedImport("");
      log(`Import coda mined · ${imported.length} voci`, "ok");
    } catch (e) {
      log(`Import mined fail: ${e instanceof Error ? e.message : String(e)}`, "err");
    }
  }, [minedImport, minedQueue, log]);

  const importLeaderboardPrizes = useCallback(() => {
    try {
      const rows = importLeaderboardPrizeJson(lbImport);
      if (rows.length === 0) throw new Error("Nessun wallet/premio valido");
      setBatchText(leaderboardPrizesToBatchText(rows));
      setLbImport("");
      log(
        `Leaderboard prefill · ${rows.length} premi · ${totalPrizeAwn(rows)} $AWN`,
        "ok",
      );
    } catch (e) {
      log(
        `Import leaderboard fail: ${e instanceof Error ? e.message : String(e)}`,
        "err",
      );
    }
  }, [lbImport, log]);

  const scrollToMinedQueue = useCallback(() => {
    document.getElementById("mined-queue")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  useEffect(() => {
    void syncHolders();
    const id = setInterval(() => void syncHolders(), 60_000);
    return () => clearInterval(id);
  }, [syncHolders]);

  /** Auto-sync mined claim queue while Command Deck is open (same cadence family as holders). */
  useEffect(() => {
    void syncMinedQueue();
    const id = setInterval(() => void syncMinedQueue(), 45_000);
    return () => clearInterval(id);
  }, [syncMinedQueue]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const snap = await fetchMarketSnapshot();
        if (cancelled) return;
        setMarket(snap);
        setMarketErr("");
      } catch (e) {
        if (!cancelled) {
          setMarketErr(e instanceof Error ? e.message : String(e));
        }
      }
    };
    void tick();
    const id = setInterval(() => void tick(), 25_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(LS_CLAIM_PERIOD, JSON.stringify(claimPeriodSec));
  }, [claimPeriodSec]);

  useEffect(() => {
    localStorage.setItem(LS_CLAIM_TEST_1M, JSON.stringify(claimTest1m));
  }, [claimTest1m]);

  const claimPeriodDays = Math.max(1, Math.round(claimPeriodSec / 86400));
  const effectiveClaimPeriodSec = claimTest1m
    ? CLAIM_TEST_PERIOD_SEC
    : claimPeriodSec;

  const claimTimer = useMemo(() => {
    if (claimTest1m) {
      if (claimTestCycleStart == null) {
        return {
          label: "TEST 1m — premi Avvia timer",
          value: "0d 00:01:00",
        };
      }
      const unlock = claimTestCycleStart + CLAIM_TEST_PERIOD_SEC;
      if (now < unlock) {
        return {
          label: "TEST · sblocco claim tra",
          value: fmtCountdown(unlock - now),
        };
      }
      return {
        label: "TEST · accrual OK — Apri finestra on-chain se serve",
        value: "0d 00:00:00",
      };
    }
    if (!claimActive || !cycleStart) {
      return { label: "Claim non attivo", value: "--" };
    }
    const unlock = cycleStart + effectiveClaimPeriodSec;
    const end = claimWindowEnd || unlock + CLAIM_WINDOW;
    if (claimWindowOpen || (now >= unlock && now <= end)) {
      return {
        label: "FINESTRA CLAIM APERTA — chiude tra",
        value: fmtCountdown(Math.max(0, end - now)),
      };
    }
    if (now < unlock) {
      return { label: "Sblocco claim tra", value: fmtCountdown(unlock - now) };
    }
    return { label: "Finestra scaduta — prossimo ciclo", value: fmtCountdown(0) };
  }, [
    claimTest1m,
    claimTestCycleStart,
    claimActive,
    cycleStart,
    effectiveClaimPeriodSec,
    claimWindowEnd,
    claimWindowOpen,
    now,
  ]);

  async function onImportHolders() {
    try {
      const imported = importHolderRegistryJson(holdersImport);
      setHoldersImport("");
      // Import only adds @Telegram tags — then re-sync on-chain balances.
      const mergedLocal = [...holders, ...imported];
      saveHolderRegistry(mergedLocal);
      const rows = await syncHoldersFromNetwork(mergedLocal);
      setHolders(rows);
      log(`Import @Telegram · sync on-chain · ${rows.length} holder`, "ok");
    } catch (e) {
      log(String(e), "err");
    }
  }

  async function onRefreshHoldersBalances() {
    setBusy(true);
    try {
      // TonAPI jetton balances only — never get_holder_info (claim map can be stale).
      const rows = await syncHoldersFromNetwork(holders);
      setHolders(rows);
      log(`Balance on-chain aggiornati · ${rows.length} wallet`, "ok");
    } catch (e) {
      log(String(e), "err");
    } finally {
      setBusy(false);
    }
  }

  async function copyHolderWallet(addr: string) {
    try {
      await navigator.clipboard.writeText(addr);
      log(`Wallet copiato · ${addr.slice(0, 8)}…`, "ok");
    } catch (e) {
      log(String(e), "err");
    }
  }

  async function sendBoc(to: string, amount: bigint, body: ReturnType<typeof bodyEnableTrading>, label: string) {
    if (!wallet) {
      log("Collega AWN-Owner con TonConnect", "err");
      return;
    }
    setBusy(true);
    try {
      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [
          {
            address: to,
            amount: amount.toString(),
            payload: body.toBoc().toString("base64"),
          },
        ],
      });
      log(`${label} inviato — conferma in wallet`, "ok");
      setTimeout(() => void refresh(), 8000);
    } catch (e) {
      log(`${label} errore: ${e instanceof Error ? e.message : String(e)}`, "err");
    } finally {
      setBusy(false);
    }
  }

  async function onCheckBl() {
    try {
      const v = await isBlacklisted(blAddr.trim());
      setBlStatus(v ? "BLOCKED" : "clean");
    } catch (e) {
      setBlStatus("error");
      log(String(e), "err");
    }
  }

  function parseBatch(text: string) {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const items: { to: string; amount: bigint }[] = [];
    for (let i = 0; i + 1 < lines.length; i += 2) {
      items.push({ to: lines[i]!, amount: toUnits(lines[i + 1]!) });
    }
    return items;
  }

  return (
    <>
      <div className="scanlines" />
      <div className="app">
        <header className="topbar">
          <div className="brand-block">
            <img
              className="brand-logo"
              src="/awn-logo.png"
              alt="$AWN"
              width={56}
              height={56}
            />
            <div>
              <div className="brand">
                $AWN <span>COMMAND DECK</span>
        </div>
              <div className="muted">
                Solo admin · network <strong>{NETWORK}</strong>
              </div>
            </div>
          </div>
          <div className="btn-row">
            <span className={`badge ${tradingOn ? "on" : "off"}`}>
              TRADING {tradingOn ? "ON" : "OFF"}
            </span>
            <span className={`badge ${sellOn ? "on" : "off"}`}>SELL {sellOn ? "ON" : "OFF"}</span>
            <span className={`badge ${claimActive ? "on" : "off"}`}>
              CLAIM {claimActive ? "ARMED" : "IDLE"}
            </span>
            {claimTest1m ? (
              <span className="badge warn" title="Deck UI accrual test — non cambia il periodo on-chain">
                CLAIM TEST 1m
              </span>
            ) : null}
            <button className="cmd" disabled={busy} onClick={() => void refresh()}>
              Refresh
            </button>
            <div className="tc-wrap">
              <TonConnectButton />
            </div>
          </div>
        </header>

        {minedAlert ? (
          <button
            type="button"
            className="mined-queue-alert"
            onClick={scrollToMinedQueue}
            title="Vai alla coda mined $AWN"
          >
            <span className="mined-queue-alert-main">
              Da liquidare: {minedQueue.length} richieste · {minedTotal} $AWN
            </span>
            {minedHint ? (
              <span className="mined-queue-alert-hint">Prossima: {minedHint}</span>
            ) : null}
            <span className="mined-queue-alert-cta">↓ Coda mined</span>
          </button>
        ) : null}

        <div className="grid">
          <section className="panel span8">
            <h2>Live telemetry</h2>
            <div
              className={`on-air ${tradingOn ? "on" : "off"}`}
              role="status"
              aria-live="polite"
              title={
                tradingOn
                  ? "Trading enabled on-chain (isTradingEnabled)"
                  : "Trading disabled on-chain (isTradingEnabled)"
              }
            >
              <span className="on-air-tag">TRADING</span>
              <span className="on-air-lamp" aria-hidden />
              <span className="on-air-label">{tradingOn ? "ON AIR" : "OFF AIR"}</span>
            </div>
            <div className="stat-row">
              <div className="stat">
                <div className="k">Treasury GRAM</div>
                <div className="v">{treasury}</div>
              </div>
              <div className="stat">
                <div className="k">Supply</div>
                <div className="v">{supply}</div>
              </div>
              <div className="stat">
                <div className="k">Buy limit</div>
                <div className="v">
                  {limitsOn ? "ON" : "OFF"} ·{" "}
                  {(maxBuyBp / 100).toFixed(maxBuyBp % 100 ? 1 : 0)}%
                </div>
              </div>
              <div className="stat">
                <div className="k">Sell limit</div>
                <div className="v">
                  {limitsOn ? "ON" : "OFF"} ·{" "}
                  {(maxSellBp / 100).toFixed(maxSellBp % 100 ? 1 : 0)}%
                </div>
              </div>
              <div className="stat">
                <div className="k">Sell / treasury tax</div>
                <div className="v">
                  {(sellTaxBp / 100).toFixed(sellTaxBp % 100 ? 1 : 0)}%
                </div>
              </div>
              <div className="stat">
                <div className="k">Network</div>
                <div className="v">{NETWORK}</div>
              </div>
            </div>
            <p className="muted" style={{ marginTop: 10 }}>
              Minter:{" "}
              <a className="addr" href={`${EXPLORER}/${MINTER}`} target="_blank" rel="noreferrer">
                {MINTER}
              </a>
            </p>
            <p className="muted">
              DEX vault (contratto): <span className="addr">{dexPool ?? "—"}</span>
            </p>
            <p className="muted">
              DeDust pool: <span className="addr">{DEDUST_POOL}</span>
              {market && market.priceNative > 0
                ? ` · ${formatTinyPrice(market.priceNative)} TON/$AWN`
                : ""}
            </p>
            <div style={{ marginTop: 12 }}>
              <TokenMarketPanel market={market} error={marketErr || undefined} />
            </div>
            <details style={{ marginTop: 8 }}>
              <summary className="muted" style={{ cursor: "pointer" }}>
                Ops chart (treasury / sell flag)
              </summary>
              <div style={{ width: "100%", height: 160, marginTop: 8 }}>
                <ResponsiveContainer>
                  <AreaChart data={chart}>
                    <CartesianGrid stroke="#1e3348" strokeDasharray="3 3" />
                    <XAxis dataKey="t" hide />
                    <YAxis stroke="#7f9bb8" width={40} />
                    <Tooltip
                      contentStyle={{
                        background: "#0d1520",
                        border: "1px solid #1e3348",
                        color: "#e8f2ff",
                      }}
                    />
                    <Area type="monotone" dataKey="treasury" stroke="#2ee6ff" name="Treasury" />
                    <Area type="stepAfter" dataKey="sell" stroke="#ffb020" name="Sell flag" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </details>
          </section>

          <section className="panel span4">
            <h2>Claim (Owner)</h2>
            <div className="muted">{claimTimer.label}</div>
            <div className={`timer${claimTest1m ? " test" : ""}`}>{claimTimer.value}</div>
            <p className="muted">
              {claimTest1m ? (
                <>
                  <strong>TEST 1m</strong> = countdown accrual <strong>solo UI deck</strong>{" "}
                  (60s). Non scrive on-chain. Periodo contratto resta{" "}
                  <strong>1/3/5/7g</strong> via SetClaimPeriodDays. Finestra claim reale =
                  Apri finestra / ciclo on-chain (24h).
                </>
              ) : (
                <>
                  Accrual <strong>{claimPeriodDays}g</strong> · finestra 24h. Owner escluso
                  dal ClaimReward. Premi <strong>1g/3g/5g/7g</strong>: una sola tx imposta
                  il periodo e <strong>chiude la finestra</strong> (niente ForceClose
                  extra).
                </>
              )}
            </p>
            <div className="btn-row" style={{ marginTop: 10 }}>
              <button
                type="button"
                className={`cmd${claimTest1m ? " warn" : ""}`}
                disabled={busy}
                title="Ops test: countdown accrual 60s sul deck — non cambia mainnet"
                onClick={() => {
                  const next = !claimTest1m;
                  setClaimTest1m(next);
                  if (next) {
                    setClaimTestCycleStart(null);
                    log("Claim TEST 1m ON · UI only (Avvia timer)", "ok");
                  } else {
                    setClaimTestCycleStart(null);
                    log("Claim TEST 1m OFF · timer da stato on-chain", "ok");
                  }
                }}
              >
                {claimTest1m ? "Esci TEST 1m" : "TEST 1m"}
              </button>
              {claimTest1m ? (
                <button
                  type="button"
                  className="cmd ok"
                  disabled={busy}
                  onClick={() => {
                    const t = Math.floor(Date.now() / 1000);
                    setClaimTestCycleStart(t);
                    setNow(t);
                    log("Claim TEST 1m · timer avviato (60s)", "ok");
                  }}
                >
                  Avvia timer 1m
                </button>
              ) : null}
              {claimTest1m ? (
                <span className="badge warn">UI · 60s</span>
              ) : null}
            </div>
            <p className="muted" style={{ marginTop: 8 }}>
              <strong>Claim ON/OFF</strong> richiede il prossimo redeploy (
              <code>SetClaimProgramActive</code>). Sul minter live attuale quei bottoni{" "}
              <em>non esistono ancora</em> → la tx bounce. Fino al deploy: usa Chiudi
              finestra / non aprire. Al lancio: vendite OFF + claim OFF; attivi il claim
              solo quando farai deploy.
            </p>
            <div className="btn-row" style={{ marginTop: 10 }}>
              <button
                type="button"
                className={`cmd${claimActive ? " ok" : ""}`}
                disabled={busy || !wallet}
                title="Attivo dopo redeploy minter con SetClaimProgramActive"
                onClick={() =>
                  void sendBoc(
                    MINTER,
                    toNano("0.05"),
                    bodySetClaimProgramActive(true),
                    "Claim ON (serve redeploy)",
                  )
                }
              >
                Claim ON
              </button>
              <button
                type="button"
                className={`cmd${!claimActive ? " hot" : ""}`}
                disabled={busy || !wallet}
                title="Attivo dopo redeploy minter con SetClaimProgramActive"
                onClick={() =>
                  void sendBoc(
                    MINTER,
                    toNano("0.05"),
                    bodySetClaimProgramActive(false),
                    "Claim OFF (serve redeploy)",
                  )
                }
              >
                Claim OFF
              </button>
              <span className={`badge ${claimActive ? "on" : "off"}`}>
                {claimActive ? "CLAIM ARMED (live)" : "CLAIM OFF"}
              </span>
            </div>
            <div className="btn-row" style={{ marginTop: 10 }}>
              {([1, 3, 5, 7] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`cmd${
                    !claimTest1m && claimPeriodDays === d ? " ok" : ""
                  }`}
                  disabled={busy || !wallet}
                  title="SetClaimPeriodDays: cambia periodo + chiude finestra in 1 tx"
                  onClick={() => {
                    setClaimTest1m(false);
                    setClaimTestCycleStart(null);
                    setClaimPeriodSec(d * 86400);
                    setClaimWindowOpen(false);
                    void sendBoc(
                      MINTER,
                      toNano("0.05"),
                      bodySetClaimPeriodDays(d),
                      `SetClaimPeriodDays ${d}d (chiude finestra)`,
                    );
                  }}
                >
                  {d}g
                </button>
              ))}
            </div>
            <p className="muted" style={{ marginTop: 10 }}>
              <strong>Claim treasury</strong> (destinazione 2) — TON nel pool claim del
              minter via <code>DepositTreasury</code>. Le fee di gioco vanno al Keeper
              (destinazione 1, pannello sotto).
            </p>
            <div className="btn-row" style={{ marginTop: 10 }}>
              <label className="field">
                TON da depositare
                <input value={depositTon} onChange={(e) => setDepositTon(e.target.value)} />
              </label>
              <button
                className="cmd warn"
                disabled={busy}
                onClick={() =>
                  void sendBoc(
                    MINTER,
                    toNano(depositTon || "0.1"),
                    bodyDepositTreasury(),
                    "DepositTreasury",
                  )
                }
              >
                DepositTreasury → claim pool
              </button>
            </div>
            <div className="btn-row" style={{ marginTop: 10 }}>
              <button
                className="cmd hot"
                disabled={busy || !wallet}
                onClick={() =>
                  void sendBoc(
                    MINTER,
                    toNano("0.05"),
                    bodyForceOpenClaimWindow(),
                    "ForceOpenClaimWindow",
                  )
                }
              >
                Apri finestra
              </button>
              <button
                className="cmd"
                disabled={busy || !wallet}
                onClick={() =>
                  void sendBoc(
                    MINTER,
                    toNano("0.05"),
                    bodyForceCloseClaimWindow(),
                    "ForceCloseClaimWindow",
                  )
                }
              >
                Chiudi finestra
              </button>
            </div>
          </section>

          <section className="panel miniapp-ops">
            <h2>Miniapp · Coming Soon / Live (solo Owner)</h2>
            <p className="muted">
              Questi toggle non sono più nella miniapp pubblica. Imposta lo stato qui, copia il
              JSON e aggiorna <code>miniapp/public/app-status.json</code> (poi redeploy di quel
              file) per tutti gli utenti. Coda claim minati → usa{" "}
              <strong>Batch airdrop</strong> sotto.
            </p>
            <div className="mini-status-grid">
              {(
                [
                  { key: "global" as const, label: "Tutta la miniapp" },
                  { key: "siege" as const, label: "Neon Siege" },
                  { key: "run" as const, label: "RunAwan" },
                ] as const
              ).map((row) => {
                const current =
                  row.key === "global" ? mini.global : mini.games[row.key];
                return (
                  <div key={row.key} className="mini-status-row">
                    <div className="mini-status-head">
                      <span>{row.label}</span>
                      <em className={current === "coming" ? "st-coming" : "st-live"}>
                        {current === "coming" ? "IN ARRIVO" : "LIVE"}
                      </em>
                    </div>
                    <div className="btn-row">
                      <button
                        type="button"
                        className={`cmd hot${current === "coming" ? " active-status" : ""}`}
                        onClick={() => setMiniStatus(row.key, "coming")}
                      >
                        IN ARRIVO
                      </button>
                      <button
                        type="button"
                        className={`cmd ok${current === "live" ? " active-status" : ""}`}
                        onClick={() => setMiniStatus(row.key, "live")}
                      >
                        LIVE
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button type="button" className="cmd hot" onClick={() => setAllMini("coming")}>
                TUTTO IN ARRIVO
              </button>
              <button type="button" className="cmd ok" onClick={() => setAllMini("live")}>
                TUTTO LIVE
              </button>
              <button type="button" className="cmd" onClick={() => void copyMiniJson()}>
                {miniCopied ? "Copiato ✓" : "Copia app-status.json"}
              </button>
            </div>
            <label className="field" style={{ marginTop: 12 }}>
              Anteprima JSON (pubblico)
              <textarea rows={10} readOnly value={miniJson} />
            </label>
          </section>

          <section className="panel span6">
            <h2>Start / Stop scambi</h2>
            <div className="btn-row">
              <button
                className="cmd ok"
                disabled={busy || tradingOn}
                onClick={() =>
                  void sendBoc(MINTER, toNano("0.05"), bodyEnableTrading(), "EnableTrading")
                }
              >
                Start trading
              </button>
              <button
                className="cmd ok"
                disabled={busy || sellOn}
                onClick={() =>
                  void sendBoc(MINTER, toNano("0.05"), bodySetSell(true), "Sell ON")
                }
              >
                Start vendite
              </button>
              <button
                className="cmd hot"
                disabled={busy || !sellOn}
                onClick={() =>
                  void sendBoc(MINTER, toNano("0.05"), bodySetSell(false), "Sell OFF")
                }
              >
                Stop vendite
              </button>
              <button
                className="cmd warn"
                disabled={busy}
                onClick={() =>
                  void sendBoc(
                    MINTER,
                    toNano("0.05"),
                    bodyDexLimits(!limitsOn),
                    `Limits ${!limitsOn ? "ON" : "OFF"}`,
                  )
                }
              >
                Toggle limiti DEX
              </button>
              <button
                className="cmd"
                disabled={busy || !wallet}
                onClick={() =>
                  void sendBoc(
                    MINTER,
                    toNano("0.08"),
                    bodyPushConfig(wallet),
                    "PushWalletConfig self",
                  )
                }
              >
                Sync config → mio wallet
              </button>
            </div>
            <div className="btn-row" style={{ marginTop: 10, alignItems: "center", gap: 8 }}>
              <label className="muted" htmlFor="buy-bp-draft">
                SetBuyLimitBp
              </label>
              <input
                id="buy-bp-draft"
                type="number"
                min={1}
                max={10000}
                value={buyBpDraft}
                onChange={(e) => setBuyBpDraft(e.target.value)}
                style={{ width: 88 }}
              />
              <span className="muted">bp (1500 = 15%)</span>
              <button
                className="cmd warn"
                disabled={busy}
                onClick={() => {
                  const bp = Number(buyBpDraft);
                  if (!Number.isInteger(bp) || bp <= 0 || bp > 10_000) {
                    log("Buy bp must be integer 1..10000", "err");
                    return;
                  }
                  void sendBoc(
                    MINTER,
                    toNano("0.05"),
                    bodySetBuyLimitBp(bp),
                    `SetBuyLimitBp(${bp}) — poi sync vault`,
                  );
                }}
              >
                Set buy limit bp
              </button>
            </div>
            <div className="btn-row" style={{ marginTop: 10, alignItems: "center", gap: 8 }}>
              <label className="muted" htmlFor="sell-bp-draft">
                SetSellLimitBp
              </label>
              <input
                id="sell-bp-draft"
                type="number"
                min={1}
                max={10000}
                value={sellBpDraft}
                onChange={(e) => setSellBpDraft(e.target.value)}
                style={{ width: 88 }}
              />
              <span className="muted">bp (300 = 3%)</span>
              <button
                className="cmd warn"
                disabled={busy}
                onClick={() => {
                  const bp = Number(sellBpDraft);
                  if (!Number.isInteger(bp) || bp <= 0 || bp > 10_000) {
                    log("Sell bp must be integer 1..10000", "err");
                    return;
                  }
                  void sendBoc(
                    MINTER,
                    toNano("0.05"),
                    bodySetSellLimitBp(bp),
                    `SetSellLimitBp(${bp}) — poi sync vault`,
                  );
                }}
              >
                Set sell limit bp
              </button>
            </div>
            <p className="muted" style={{ marginTop: 8 }}>
              Sell: i holder vendono al massimo il{" "}
              <strong>minimo</strong> tra (1) % del pool (SetSellLimitBp, es. 3%) e
              (2) % del loro saldo (possession). Tutti i limiti sono{" "}
              <strong>per transazione</strong>.
            </p>
            <div className="btn-row" style={{ marginTop: 10, alignItems: "center", gap: 8 }}>
              <label className="muted" htmlFor="tax-bp-draft">
                SetSellTaxBp
              </label>
              <input
                id="tax-bp-draft"
                type="number"
                min={0}
                max={1000}
                value={taxBpDraft}
                onChange={(e) => setTaxBpDraft(e.target.value)}
                style={{ width: 88 }}
              />
              <span className="muted">bp (300 = 3% sell→treasury; max 1000)</span>
              <button
                className="cmd warn"
                disabled={busy}
                onClick={() => {
                  const bp = Number(taxBpDraft);
                  if (!Number.isInteger(bp) || bp < 0 || bp > 1000) {
                    log("Sell tax bp must be integer 0..1000", "err");
                    return;
                  }
                  void sendBoc(
                    MINTER,
                    toNano("0.05"),
                    bodySetSellTaxBp(bp),
                    `SetSellTaxBp(${bp}) — poi sync vault`,
                  );
                }}
              >
                Set sell / treasury tax
              </button>
              <button
                className="cmd"
                disabled={busy || !dexPool}
                onClick={() => {
                  if (!dexPool) {
                    log("DEX pool / vault non impostato", "err");
                    return;
                  }
                  void sendBoc(
                    MINTER,
                    toNano("0.1"),
                    bodyPushConfig(dexPool),
                    "PushWalletConfig vault",
                  );
                }}
              >
                Sync config → vault
              </button>
            </div>
            <p className="muted" style={{ marginTop: 10 }}>
              <strong>DeDust:</strong> limiti e sell-tax sono sul jetton wallet del vault — dopo
              lo swap. Superare il buy limit = bounce 10374, TON resta nel pool (no refund).
              Ston.fi fallisce prima. Buy/sell bp e tax sono setter owner-only sul minter.{" "}
              <code>SetDexLimitsEnabled</code> spegne i limiti %. Dopo SetBuy/SellLimitBp o
              SetSellTaxBp fai sempre PushWalletConfig sul vault.
            </p>
            <p className="muted" style={{ marginTop: 10 }}>
              Collega <strong>AWN-Owner</strong>. Stop trading totale non è un flag separato: usa
              stop vendite + limiti / blacklist. EnableTrading è one-way on-chain.
            </p>
          </section>

          <DeployStatusPanel
            live={{
              tradingOn,
              sellOn,
              claimActive,
              claimWindowOpen,
              limitsOn,
              maxBuyBp,
              maxSellBp,
              sellTaxBp,
              dexPool,
              liveSyncOk,
              holderCount: tokenLocation.holderCount,
            }}
          />

          <section className="panel span12">
            <h2>Holders · dove sta il token · chi lo detiene</h2>
            <p className="muted">
              Saldi da TonAPI (jetton on-chain, lista completa). @Telegram dal registry miniapp
              (opzionale) — non nasconde gli holder on-chain. Ordine: balance ↓.
            </p>
            <div className="token-location" style={{ marginTop: 10 }}>
              <div className="token-location-grid">
        <div>
                  <span className="muted">Supply</span>
                  <strong>{formatAwnDisplay(String(tokenLocation.totalSupply))}</strong>
                </div>
                <div>
                  <span className="muted">Somma holders</span>
                  <strong>{formatAwnDisplay(String(tokenLocation.holdersSum))}</strong>
                </div>
                <div>
                  <span className="muted">Owner</span>
                  <strong>{formatAwnDisplay(String(tokenLocation.owner))}</strong>
                </div>
                <div>
                  <span className="muted">Vault LP (DeDust)</span>
                  <strong>{formatAwnDisplay(String(tokenLocation.liquidityVault))}</strong>
                </div>
                <div>
                  <span className="muted">LP / pool side</span>
                  <strong>{formatAwnDisplay(String(tokenLocation.lpPoolOwner))}</strong>
                </div>
                <div>
                  <span className="muted">Retail / altri</span>
                  <strong>{formatAwnDisplay(String(tokenLocation.retail))}</strong>
                </div>
                <div>
                  <span className="muted">Non spiegato</span>
                  <strong>{formatAwnDisplay(String(tokenLocation.unexplained))}</strong>
                </div>
                <div>
                  <span className="muted">N° holder</span>
                  <strong>{tokenLocation.holderCount}</strong>
                </div>
              </div>
            </div>
            <div className="btn-row" style={{ marginTop: 8 }}>
              <button
                type="button"
                className="cmd ok"
                disabled={busy}
                onClick={() => void syncHolders()}
              >
                Sync holders
              </button>
              <button
                type="button"
                className="cmd"
                disabled={busy}
                onClick={() => void onRefreshHoldersBalances()}
              >
                Refresh $AWN
              </button>
              <button
                type="button"
                className="cmd hot"
                disabled={holders.length === 0}
                onClick={() => {
                  setHolders([]);
                  log("Tabella holders svuotata", "ok");
                }}
              >
                Svuota
              </button>
            </div>
            <div className="holders-table-wrap">
              <table className="holders-table">
                <thead>
                  <tr>
                    <th>Wallet</th>
                    <th>Ruolo / dove</th>
                    <th>@Telegram</th>
                    <th>$AWN</th>
                    <th>Aggiornato</th>
                  </tr>
                </thead>
                <tbody>
                  {holders.length === 0 && (
                    <tr>
                      <td colSpan={5} className="muted">
                        Nessun holder — Sync holders (TonAPI on-chain)
                      </td>
                    </tr>
                  )}
                  {holders.map((h) => (
                    <tr key={h.wallet}>
                      <td className="addr">
                        <button
                          type="button"
                          className="addr-copy"
                          title="Copia indirizzo"
                          onClick={() => void copyHolderWallet(h.wallet)}
                        >
                          {h.wallet}
                        </button>
                      </td>
                      <td>
                        <span
                          className={
                            h.role && h.role !== "holder"
                              ? "holder-role special"
                              : "holder-role"
                          }
                        >
                          {h.roleLabel || "Holder"}
                        </span>
                      </td>
                      <td>{h.telegram || "—"}</td>
                      <td>{formatAwnDisplay(h.awn)}</td>
                      <td className="muted">
                        {h.updatedAt ? new Date(h.updatedAt).toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <label className="field" style={{ marginTop: 12 }}>
              Import JSON registry (opzionale · solo @Telegram · key <code>{HOLDERS_LS_KEY}</code>)
              <textarea
                rows={3}
                value={holdersImport}
                onChange={(e) => setHoldersImport(e.target.value)}
                placeholder='[{"wallet":"EQ…","telegram":"@user","awn":"1000",...}]'
              />
            </label>
            <button
              type="button"
              className="cmd ok"
              disabled={!holdersImport.trim()}
              onClick={() => void onImportHolders()}
            >
              Importa
            </button>
          </section>

          <section className="panel span6">
            <h2>Blacklist</h2>
            <label className="field">
              Target
              <input value={blAddr} onChange={(e) => setBlAddr(e.target.value)} />
            </label>
            <div className="btn-row">
              <button className="cmd" onClick={() => void onCheckBl()}>
                Check
              </button>
              <button
                className="cmd hot"
                disabled={busy}
                onClick={() =>
                  void sendBoc(
                    MINTER,
                    toNano("0.08"),
                    bodyBlacklist(blAddr.trim(), true),
                    "Blacklist ON",
                  )
                }
              >
                Block
              </button>
              <button
                className="cmd ok"
                disabled={busy}
                onClick={() =>
                  void sendBoc(
                    MINTER,
                    toNano("0.08"),
                    bodyBlacklist(blAddr.trim(), false),
                    "Blacklist OFF",
                  )
                }
              >
                Unblock
              </button>
            </div>
            {blStatus && (
              <p className="muted">
                Status: <strong>{blStatus}</strong>
              </p>
            )}
          </section>

          <section className="panel span6">
            <h2>Invio token community</h2>
            <label className="field">
              Destinatario
              <input value={sendTo} onChange={(e) => setSendTo(e.target.value)} />
            </label>
            <label className="field">
              Amount $AWN
              <input value={sendAmt} onChange={(e) => setSendAmt(e.target.value)} />
            </label>
            <div className="btn-row">
              <button
                className="cmd ok"
                disabled={busy || !wallet}
                onClick={() => {
                  if (!wallet) return;
                  void sendBoc(
                    OWNER_JETTON_WALLET,
                    toNano("0.12"),
                    bodyJettonTransfer(toUnits(sendAmt), sendTo.trim(), wallet),
                    `Transfer ${sendAmt} AWN`,
                  );
                }}
              >
                Send AWN
              </button>
        </div>
            <p className="muted">Usa il jetton wallet owner: {OWNER_JETTON_WALLET.slice(0, 12)}…</p>
          </section>

          <section className="panel span6">
            <h2>Batch airdrop</h2>
            <p className="muted">
              Settlement mined $AWN / premi Classifica: prefilla dalla coda o da JSON
              leaderboard, poi Fire batch.
            </p>
            <label className="field">
              Righe alternate: address / amount
              <textarea
                rows={6}
                value={batchText}
                onChange={(e) => setBatchText(e.target.value)}
              />
            </label>
            <button
              className="cmd warn"
              disabled={busy || !wallet}
              onClick={() => {
                try {
                  const items = parseBatch(batchText);
                  void sendBoc(
                    OWNER_JETTON_WALLET,
                    toNano(String(0.05 + items.length * 0.06)),
                    bodyBatchTransfer(items),
                    `Batch ${items.length}`,
                  );
                } catch (e) {
                  log(String(e), "err");
                }
              }}
            >
              Fire batch (max 150)
            </button>
            <div className="lb-prize-import">
              <h3 className="subhead">Premi Classifica → BatchTransfer</h3>
              <p className="muted">
                Miniapp Classifica → «Copia JSON premi» → incolla qui → Prefill (stesso
                formato della coda mined).
              </p>
              <label className="field">
                Import JSON leaderboard
                <textarea
                  rows={3}
                  value={lbImport}
                  onChange={(e) => setLbImport(e.target.value)}
                  placeholder='{"prizes":[{"wallet":"EQ…","amount":5000,"rank":1}]}'
                />
              </label>
        <button
          type="button"
                className="cmd ok"
                disabled={!lbImport.trim()}
                onClick={importLeaderboardPrizes}
        >
                Prefill BatchTransfer (leaderboard)
        </button>
            </div>
      </section>

          <section id="mined-queue" className="panel mined-queue-panel">
            <h2>Coda mined $AWN (≥100)</h2>
            <p className="muted">
              Giocatori accodano in miniapp (off-chain). Sync Blob / import JSON → Prefill
              BatchTransfer → Fire batch sopra. Non mint automatico.
            </p>
            <div className="stat-row">
              <div className="stat">
                <div className="k">Voci in coda</div>
                <div className="v">{minedQueue.length}</div>
              </div>
              <div className="stat">
                <div className="k">Totale $AWN</div>
                <div className="v">{minedTotal}</div>
              </div>
            </div>
            <div className="btn-row" style={{ marginTop: 10 }}>
              <button
                type="button"
                className="cmd ok"
                disabled={minedBusy}
                onClick={() => void syncMinedQueue()}
              >
                {minedBusy ? "…" : "Sync coda (API)"}
              </button>
              <button
                type="button"
                className="cmd warn"
                disabled={minedQueue.length === 0}
                onClick={() => {
                  setBatchText(minedQueueToBatchText(minedQueue));
                  log(`Batch prefill · ${minedQueue.length} destinatari`, "ok");
                }}
              >
                Prefill BatchTransfer
              </button>
              <button
                type="button"
                className="cmd hot"
                disabled={minedQueue.length === 0 || minedBusy}
                onClick={() => {
                  setMinedQueue([]);
                  saveLocalMinedQueue([]);
                  void clearRemoteMinedQueue()
                    .then(() => log("Coda mined svuotata (locale + API)", "ok"))
                    .catch((e) =>
                      log(
                        `Clear locale OK; API: ${e instanceof Error ? e.message : String(e)}`,
                        "err",
                      ),
                    );
                }}
              >
                Svuota coda
              </button>
            </div>
            <div className="holders-table-wrap" style={{ marginTop: 12 }}>
              <table className="holders-table">
                <thead>
                  <tr>
                    <th>Wallet</th>
                    <th>Telegram</th>
                    <th>$AWN</th>
                    <th>Quando</th>
                  </tr>
                </thead>
                <tbody>
                  {minedQueue.length === 0 && (
                    <tr>
                      <td colSpan={4} className="muted">
                        Nessuna coda — Sync API o Import JSON (key{" "}
                        <code>{MINED_QUEUE_LS_KEY}</code>)
                      </td>
                    </tr>
                  )}
                  {minedQueue.map((row) => (
                    <tr key={`${row.wallet}-${row.at}-${row.minedAwn}`}>
                      <td className="mono">{row.wallet.slice(0, 8)}…{row.wallet.slice(-4)}</td>
                      <td>{telegramLabel(row)}</td>
                      <td>{row.minedAwn}</td>
                      <td className="muted">
                        {new Date(row.at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <label className="field" style={{ marginTop: 12 }}>
              Import JSON coda (opzionale)
              <textarea
                rows={3}
                value={minedImport}
                onChange={(e) => setMinedImport(e.target.value)}
                placeholder='[{"wallet":"EQ…","minedAwn":120,"at":…}]'
              />
            </label>
            <button
              type="button"
              className="cmd"
              disabled={!minedImport.trim()}
              onClick={importMinedQueue}
            >
              Import queue JSON
            </button>
          </section>

          <section className="panel keeper-panel">
            <h2>Dual deposit · Keeper &amp; Claim treasury</h2>
            <p className="muted">
              Due destinazioni distinte — non depositare LP pool TON automaticamente.
            </p>
            <div className="dual-deposit-grid">
              <div className="dual-card">
                <h3 className="subhead">1 · Keeper · game intake</h3>
                <p className="muted">
                  Micropagamenti gioco (vite, bomba, shop) → questo wallet. Ops / liquidità
                  keeper — non è il claim pool.
                </p>
                <div className="stat-row">
                  <div className="stat">
                    <div className="k">Saldo Keeper (TON)</div>
                    <div className="v">{keeperTonBal}</div>
        </div>
                  <div className="stat">
                    <div className="k">Pending tax $AWN</div>
                    <div className="v">{pendingTax}</div>
                  </div>
                </div>
                <label className="field">
                  Indirizzo Keeper (copiabile)
                  <div className="btn-row" style={{ alignItems: "stretch", marginTop: 6 }}>
                    <input
                      value={keeperDest}
                      onChange={(e) => setKeeperDest(e.target.value)}
                      placeholder={DEFAULT_KEEPER}
                      style={{
                        flex: 1,
                        fontFamily: "ui-monospace, monospace",
                        fontSize: "0.85rem",
                      }}
                    />
                    <button
                      type="button"
                      className="cmd"
                      onClick={() => {
                        void navigator.clipboard.writeText(
                          keeperDest.trim() || DEFAULT_KEEPER,
                        );
                        setKeeperCopied(true);
                        log("Keeper copiato", "ok");
                        window.setTimeout(() => setKeeperCopied(false), 1600);
                      }}
                    >
                      {keeperCopied ? "OK" : "Copia"}
                    </button>
                  </div>
                  <p className="muted" style={{ marginTop: 6 }}>
                    Default: <code className="addr">{DEFAULT_KEEPER}</code>
                  </p>
                </label>
              </div>
              <div className="dual-card">
                <h3 className="subhead">2 · Claim treasury · DepositTreasury</h3>
                <p className="muted">
                  TON nel pool claim del minter. Holder riscattano con ClaimReward nella
                  finestra. Fund dopo sweep/swap tax o deposito diretto Owner/Keeper.
                </p>
                <div className="stat-row">
                  <div className="stat">
                    <div className="k">Treasury TON (minter)</div>
                    <div className="v">{treasury}</div>
                  </div>
                </div>
                <div className="btn-row">
                  <label className="field" style={{ marginBottom: 0, minWidth: 140 }}>
                    TON da depositare
                    <input
                      value={keeperDepositTon}
                      onChange={(e) => setKeeperDepositTon(e.target.value)}
                    />
                  </label>
                  <button
                    className="cmd warn"
                    disabled={busy}
                    onClick={() =>
                      void sendBoc(
                        MINTER,
                        toNano(keeperDepositTon || "0.1"),
                        bodyDepositTreasury(),
                        "DepositTreasury → claim pool",
                      )
                    }
                  >
                    DepositTreasury → claim pool
                  </button>
                </div>
              </div>
            </div>
            <hr className="panel-divider" />
            <h3 className="subhead">Tax path · Sweep → Swap → DepositTreasury</h3>
            <ol className="keeper-steps">
              <li>
                <strong>Sweep</strong> — Owner sposta la tax $AWN dal wallet minter → Keeper
            </li>
            <li>
                <strong>Swap DEX</strong> — sul wallet Keeper scambia $AWN → TON (manuale)
            </li>
            <li>
                <strong>DepositTreasury</strong> — destinazione 2 (claim pool) con il bottone
                sopra
            </li>
            </ol>
            <label className="field">
              Amount $AWN da sweep (vuoto / max = tutto il pending)
              <div className="btn-row" style={{ alignItems: "stretch" }}>
                <input
                  value={sweepAmt}
                  onChange={(e) => setSweepAmt(e.target.value)}
                  placeholder={pendingTax !== "0" ? pendingTax : "max"}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="cmd"
                  disabled={pendingTaxRaw <= 0n}
                  onClick={() => setSweepAmt(fromUnits(pendingTaxRaw))}
                >
                  Max
                </button>
        </div>
            </label>
            <div className="btn-row">
              <button
                className="cmd ok"
                disabled={busy || !wallet || pendingTaxRaw <= 0n}
                onClick={() => {
                  const raw = sweepAmt.trim().toLowerCase();
                  const amount =
                    !raw || raw === "max" || raw === "all" ? 0n : toUnits(raw);
                  void sendBoc(
                    MINTER,
                    toNano("0.15"),
                    bodySweepTaxJettons(keeperDest.trim(), amount),
                    amount === 0n
                      ? "SweepTaxJettons (all pending)"
                      : `SweepTaxJettons ${raw} AWN`,
                  );
                }}
              >
                Sweep tax → Keeper
              </button>
            </div>
            <p className="muted" style={{ marginTop: 10 }}>
              Minter: {MINTER.slice(0, 8)}…{MINTER.slice(-4)}
            </p>
      </section>

          <section className="panel">
            <h2>Ops log</h2>
            <div className="log">
              {logs.length === 0 && <div>In attesa di comandi…</div>}
              {logs.map((l, i) => (
                <div key={`${l.t}-${i}`} className={l.kind}>
                  [{l.t}] {l.msg}
                </div>
              ))}
            </div>
            <p className="muted" style={{ marginTop: 8 }}>
              Avvio: <code>cd admin && npm run dev</code> → http://localhost:5173 · collega Owner
              testnet o mainnet a seconda di <code>VITE_NETWORK</code>.
            </p>
          </section>
        </div>

        <details className="danger-zone">
          <summary>Zona pericolosa / Advanced — non aprire se non sei sicuro</summary>
          <div className="danger-body">
            <h2>Rinuncia ownership</h2>
            <p className="muted">
              <strong>IRREVERSIBILE.</strong> Trasferisce l&apos;owner del minter a un indirizzo
              morto (o altro). Dopo la conferma on-chain questo wallet non potrà più:
              EnableTrading, Start/Stop vendite, blacklist, SweepTax, PushWalletConfig, ChangeOwner,
              ecc. Usare solo a prodotto stabilizzato.
            </p>
            <label className="field">
              Nuovo owner (default = dead address)
              <input
                value={renounceTo}
                onChange={(e) => setRenounceTo(e.target.value)}
                placeholder={DEAD_OWNER}
              />
            </label>
            <label className="field">
              Digita <code>RINUNCIA</code> per abilitare
              <input
                value={renounceConfirm}
                onChange={(e) => setRenounceConfirm(e.target.value)}
                placeholder="RINUNCIA"
                autoComplete="off"
              />
            </label>
            <div className="btn-row">
              <button
                className="cmd hot"
                disabled={busy || !wallet || renounceConfirm.trim() !== "RINUNCIA"}
                onClick={() => {
                  if (
                    !window.confirm(
                      "Confermi la rinuncia ownership? È IRREVERSIBILE. Continua solo se sei sicuro.",
                    )
                  ) {
                    return;
                  }
                  void sendBoc(
                    MINTER,
                    toNano("0.05"),
                    bodyChangeOwner(renounceTo.trim()),
                    "ChangeOwner (RINUNCIA)",
                  );
                }}
              >
                Rinuncia ownership
              </button>
            </div>
          </div>
        </details>
      </div>
    </>
  );
}
