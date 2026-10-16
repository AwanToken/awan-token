import { useEffect, useState } from "react";
import { useTonAddress } from "@tonconnect/ui-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { WalletSpoiler } from "../components/WalletSpoiler";
import {
  MINTER,
  NETWORK,
  PAIR_LABEL,
  RPC,
  STON_FI_BUY_URL,
  STON_FI_SELL_URL,
} from "../config";
import { useI18n } from "../i18n/I18nContext";
import { bootstrapFeed, tickFeed, type CandlePoint } from "../lib/priceFeed";
import { openExternal } from "../lib/telegram";
import {
  fetchBuyLimitGuard,
  fromNanoTon,
  fromUnits,
  type BuyLimitGuard,
} from "../lib/ton";

export function HomeScreen() {
  const { t } = useI18n();
  const wallet = useTonAddress();
  const locked = !wallet;
  const [data, setData] = useState<CandlePoint[]>(() => bootstrapFeed());
  const [guard, setGuard] = useState<BuyLimitGuard | null>(null);
  const [guardErr, setGuardErr] = useState("");
  const last = data[data.length - 1]?.price ?? 0;

  useEffect(() => {
    const id = setInterval(() => setData(tickFeed()), 2500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchBuyLimitGuard()
        .then((g) => {
          if (!cancelled) {
            setGuard(g);
            setGuardErr("");
          }
        })
        .catch((e) => {
          if (!cancelled) {
            setGuardErr(e instanceof Error ? e.message : String(e));
          }
        });
    };
    load();
    const id = setInterval(load, 20_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const maxTonLabel =
    guard?.estimatedMaxTonIn != null
      ? `~${fromNanoTon(guard.estimatedMaxTonIn)} TON`
      : "—";
  const maxAwnLabel =
    guard?.maxBuyAwn != null ? `${fromUnits(guard.maxBuyAwn)} $AWN` : "—";

  function onBuy() {
    // Soft UX gate: show live on-chain buy cap before opening Ston.fi.
    if (guard?.isDexLimitsEnabled && guard.estimatedMaxTonIn != null) {
      const ok = window.confirm(
        `${t.home.buyConfirmTitle}\n\n` +
          `${t.home.buyConfirmBody
            .replace("{pct}", guard.buyPctLabel)
            .replace("{maxTon}", maxTonLabel)
            .replace("{maxAwn}", maxAwnLabel)}\n\n` +
          t.home.buyConfirmWarn,
      );
      if (!ok) return;
    }
    openExternal(STON_FI_BUY_URL);
  }

  function onSell() {
    openExternal(STON_FI_SELL_URL);
  }

  return (
    <section className="panel home-panel fade-in">
      <div className="hero-strip">
        <div>
          <p className="eyebrow">{t.home.eyebrow}</p>
          <h2 className="panel-title">{PAIR_LABEL}</h2>
          <p className="price-big">{last.toFixed(6)} TON</p>
        </div>
      </div>

      {/* Chart always works without wallet */}
      <div className="chart-frame">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="awnFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff2bd6" stopOpacity={0.55} />
                <stop offset="100%" stopColor="#7df9ff" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(125,249,255,0.08)" vertical={false} />
            <XAxis dataKey="t" tick={{ fill: "#8a7aa8", fontSize: 10 }} minTickGap={40} />
            <YAxis
              domain={["auto", "auto"]}
              tick={{ fill: "#8a7aa8", fontSize: 10 }}
              width={56}
            />
            <Tooltip
              contentStyle={{
                background: "#16082a",
                border: "1px solid #ff2bd6",
                borderRadius: 0,
                fontFamily: "Rajdhani",
              }}
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke="#7df9ff"
              strokeWidth={2}
              fill="url(#awnFill)"
              isAnimationActive
              animationDuration={600}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <WalletSpoiler locked={locked} compact>
        {guard?.isDexLimitsEnabled && (
          <div className="buy-limit-banner" role="status">
            <strong>{t.home.limitTitle}</strong>
            <p>
              {t.home.limitBody
                .replace("{pct}", guard.buyPctLabel)
                .replace("{maxTon}", maxTonLabel)
                .replace("{maxAwn}", maxAwnLabel)}
            </p>
            <p className="buy-limit-danger">{t.home.limitDanger}</p>
          </div>
        )}
        {guardErr && <p className="hint">{t.home.limitLoadFail}</p>}

        <div className="hero-actions" style={{ marginTop: 12 }}>
          <button type="button" className="neon-btn buy" onClick={onBuy}>
            {t.home.buy}
          </button>
          <button type="button" className="neon-btn sell" onClick={onSell}>
            {t.home.sell}
          </button>
        </div>
        <div className="meta-grid">
          <div className="meta-cell">
            <span>{t.home.network}</span>
            <strong>{NETWORK}</strong>
          </div>
          <div className="meta-cell">
            <span>{t.home.minter}</span>
            <strong className="mono truncate">{MINTER.slice(0, 8)}…</strong>
          </div>
          <div className="meta-cell">
            <span>{t.home.rpc}</span>
            <strong className="mono truncate">{RPC.replace("https://", "").slice(0, 22)}</strong>
          </div>
          {guard && (
            <div className="meta-cell">
              <span>{t.home.limitMeta}</span>
              <strong>
                {guard.isDexLimitsEnabled ? guard.buyPctLabel : "OFF"}
              </strong>
            </div>
          )}
        </div>
        <p className="hint">{t.home.hint}</p>
      </WalletSpoiler>
    </section>
  );
}
