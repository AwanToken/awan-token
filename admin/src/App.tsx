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
import {
  HOLDERS_LS_KEY,
  importHolderRegistryJson,
  loadHolderRegistry,
  saveHolderRegistry,
  type HolderRow,
} from "./lib/holders";
import {
  bodyBlacklist,
  bodyBatchTransfer,
  bodyChangeOwner,
  bodyDepositTreasury,
  bodyDexLimits,
  bodyEnableTrading,
  bodySetBuyLimitBp,
  bodyForceCloseClaimWindow,
  bodyForceOpenClaimWindow,
  bodyJettonTransfer,
  bodyPushConfig,
  bodySetClaimPeriodDays,
  bodySetClaimProgramActive,
  bodySetSell,
  bodySweepTaxJettons,
  fetchHolder,
  fetchLiveState,
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
      setDexPool(st.dexPool);
      setTreasury(fromUnits(st.treasury));
      setPendingTax(fromUnits(st.pendingTaxJettons));
      setPendingTaxRaw(st.pendingTaxJettons);
      setSupply(fromUnits(st.totalSupply));
      setCycleStart(st.cycleStart);
      setClaimWindowEnd(st.claimWindowEnd);
      setClaimWindowOpen(st.claimWindowOpen);
      setClaimActive(st.claimProgramActive);

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
    localStorage.setItem(LS_CLAIM_PERIOD, JSON.stringify(claimPeriodSec));
  }, [claimPeriodSec]);

  const claimPeriodDays = Math.max(1, Math.round(claimPeriodSec / 86400));

  const claimTimer = useMemo(() => {
    if (!claimActive || !cycleStart) {
      return { label: "Claim non attivo", value: "--" };
    }
    const unlock = cycleStart + claimPeriodSec;
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
  }, [claimActive, cycleStart, claimPeriodSec, claimWindowEnd, claimWindowOpen, now]);

  function onImportHolders() {
    try {
      const rows = importHolderRegistryJson(holdersImport);
      setHolders(rows);
      setHoldersImport("");
      log(`Importati ${rows.length} holder`, "ok");
    } catch (e) {
      log(String(e), "err");
    }
  }

  async function onRefreshHoldersBalances() {
    if (holders.length === 0) return;
    setBusy(true);
    try {
      const next: HolderRow[] = [];
      for (const row of holders) {
        try {
          const info = await fetchHolder(row.wallet);
          next.push({
            ...row,
            awn: fromUnits(info.balance),
            updatedAt: Date.now(),
          });
        } catch {
          next.push(row);
        }
      }
      setHolders(next);
      log(`Balance aggiornati · ${next.length} wallet`, "ok");
    } catch (e) {
      log(String(e), "err");
    } finally {
      setBusy(false);
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
            <button className="cmd" disabled={busy} onClick={() => void refresh()}>
              Refresh
            </button>
            <div className="tc-wrap">
              <TonConnectButton />
            </div>
          </div>
        </header>

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
                <div className="k">DEX limits</div>
                <div className="v">
                  {limitsOn ? "ON" : "OFF"} · buy {(maxBuyBp / 100).toFixed(maxBuyBp % 100 ? 1 : 0)}% / sell{" "}
                  {(maxSellBp / 100).toFixed(maxSellBp % 100 ? 1 : 0)}%
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
              DEX pool: <span className="addr">{dexPool ?? "—"}</span>
            </p>
            <div style={{ width: "100%", height: 220, marginTop: 12 }}>
              <ResponsiveContainer>
                <AreaChart data={chart}>
                  <defs>
                    <linearGradient id="gT" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2ee6ff" stopOpacity={0.7} />
                      <stop offset="100%" stopColor="#2ee6ff" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gS" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#b6ff3b" stopOpacity={0.55} />
                      <stop offset="100%" stopColor="#b6ff3b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
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
                  <Area
                    type="monotone"
                    dataKey="treasury"
                    stroke="#2ee6ff"
                    fill="url(#gT)"
                    name="Treasury"
                  />
                  <Area
                    type="stepAfter"
                    dataKey="sell"
                    stroke="#b6ff3b"
                    fill="url(#gS)"
                    name="Sell flag"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="muted">Grafico gamer: tesoreria + flag sell (poll live ogni 20s).</p>
          </section>

          <section className="panel span4">
            <h2>Claim (Owner)</h2>
            <div className="muted">{claimTimer.label}</div>
            <div className="timer">{claimTimer.value}</div>
            <p className="muted">
              Accrual <strong>{claimPeriodDays}g</strong> · finestra 24h. Owner escluso dal
              ClaimReward. Premi <strong>1g/3g/5g/7g</strong>: una sola tx imposta il periodo e{" "}
              <strong>chiude la finestra</strong> (niente ForceClose extra).
            </p>
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
                  className={`cmd${claimPeriodDays === d ? " ok" : ""}`}
                  disabled={busy || !wallet}
                  title="SetClaimPeriodDays: cambia periodo + chiude finestra in 1 tx"
                  onClick={() => {
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
                Deposit treasury
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
                  { key: "run" as const, label: "AWN Run" },
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
              <strong>DeDust:</strong> il limite buy è sul jetton wallet del vault — dopo lo swap.
              Superarlo = bounce 10374, TON resta nel pool (no refund). Ston.fi fallisce prima.
              Buy/sell bp sono separati; <code>SetDexLimitsEnabled</code> spegne entrambi.
              Dopo SetBuyLimitBp fai sempre PushWalletConfig sul vault.
            </p>
            <p className="muted" style={{ marginTop: 10 }}>
              Collega <strong>AWN-Owner</strong>. Stop trading totale non è un flag separato: usa
              stop vendite + limiti / blacklist. EnableTrading è one-way on-chain.
            </p>
          </section>

          <section className="panel span12">
            <h2>Holders · wallet · @tg · $AWN</h2>
            <p className="muted">
              Tabella Owner-only. Incolla JSON esportato dalla miniapp (
              <code>{HOLDERS_LS_KEY}</code>) oppure aggiorna i balance on-chain.
            </p>
            <div className="btn-row" style={{ marginTop: 8 }}>
              <button
                type="button"
                className="cmd"
                disabled={busy || holders.length === 0}
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
                    <th>@Telegram</th>
                    <th>$AWN</th>
                    <th>Aggiornato</th>
                  </tr>
                </thead>
                <tbody>
                  {holders.length === 0 && (
                    <tr>
                      <td colSpan={4} className="muted">
                        Nessun holder — importa JSON dalla miniapp
                      </td>
                    </tr>
                  )}
                  {holders.map((h) => (
                    <tr key={h.wallet}>
                      <td className="addr">{h.wallet}</td>
                      <td>{h.telegram || "—"}</td>
                      <td>{h.awn}</td>
                      <td className="muted">
                        {h.updatedAt ? new Date(h.updatedAt).toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <label className="field" style={{ marginTop: 12 }}>
              Import JSON registry
              <textarea
                rows={4}
                value={holdersImport}
                onChange={(e) => setHoldersImport(e.target.value)}
                placeholder='[{"wallet":"EQ…","telegram":"@user","awn":"1000",...}]'
              />
            </label>
            <button
              type="button"
              className="cmd ok"
              disabled={!holdersImport.trim()}
              onClick={onImportHolders}
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
          </section>

          <section className="panel keeper-panel">
            <h2>Keeper / Tax → Treasury</h2>
            <div className="stat-row">
              <div className="stat">
                <div className="k">Pending tax $AWN</div>
                <div className="v">{pendingTax}</div>
              </div>
              <div className="stat">
                <div className="k">Treasury TON</div>
                <div className="v">{treasury}</div>
              </div>
            </div>
            <ol className="keeper-steps">
              <li>
                <strong>Sweep</strong> — Owner sposta la tax $AWN dal wallet minter → Keeper
              </li>
              <li>
                <strong>Swap DEX</strong> — sul wallet Keeper scambia $AWN → TON (manuale, es.
                DeDust / Ston.fi)
              </li>
              <li>
                <strong>DepositTreasury</strong> — invia i TON al minter con il bottone sotto
              </li>
            </ol>
            <label className="field">
              Destinazione Keeper
              <input
                value={keeperDest}
                onChange={(e) => setKeeperDest(e.target.value)}
                placeholder={DEFAULT_KEEPER}
              />
            </label>
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
            <hr className="panel-divider" />
            <h3 className="subhead">Deposit treasury (post-swap)</h3>
            <p className="muted">
              Dopo lo swap sul Keeper, collega il wallet Keeper (o Owner se ha i TON) e deposita
              nella tesoreria del minter.
            </p>
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
                    "DepositTreasury (Keeper)",
                  )
                }
              >
                Deposit treasury
              </button>
            </div>
            <p className="muted" style={{ marginTop: 10 }}>
              <code>SweepTaxJettons</code> attivo sul minter testnet corrente (
              {MINTER.slice(0, 8)}…{MINTER.slice(-4)}).
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
