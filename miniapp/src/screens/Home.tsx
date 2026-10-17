import { useEffect, useState } from "react";
import { useTonAddress } from "@tonconnect/ui-react";
import { SwapPanel, type SwapMode } from "../components/SwapPanel";
import { TokenMarketPanel } from "../components/TokenMarketPanel";
import { WalletSpoiler } from "../components/WalletSpoiler";
import { MINTER, NETWORK, PAIR_LABEL } from "../config";
import { useI18n } from "../i18n/I18nContext";
import {
  fetchMarketSnapshot,
  type MarketSnapshot,
} from "../lib/geckoMarket";
import { formatTinyPrice } from "../lib/formatTinyPrice";
import {
  fetchBuyLimitGuard,
  fromNanoTon,
  fromUnits,
  type BuyLimitGuard,
} from "../lib/ton";

const POLL_MS = 25_000;

export function HomeScreen() {
  const { t } = useI18n();
  const wallet = useTonAddress();
  const locked = !wallet;
  const [market, setMarket] = useState<MarketSnapshot | null>(null);
  const [feedErr, setFeedErr] = useState("");
  const [guard, setGuard] = useState<BuyLimitGuard | null>(null);
  const [guardErr, setGuardErr] = useState("");
  const [swapMode, setSwapMode] = useState<SwapMode | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      void fetchMarketSnapshot()
        .then((snap) => {
          if (!cancelled) {
            setMarket(snap);
            setFeedErr("");
          }
        })
        .catch((e) => {
          if (!cancelled) setFeedErr(e instanceof Error ? e.message : String(e));
        });
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
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

  const last = market?.priceNative ?? 0;
  const maxTonLabel =
    guard?.estimatedMaxTonIn != null
      ? `~${fromNanoTon(guard.estimatedMaxTonIn)} TON`
      : "—";
  const maxAwnLabel =
    guard?.maxBuyAwn != null ? `${fromUnits(guard.maxBuyAwn)} $AWN` : "—";

  function openSwap(mode: SwapMode) {
    setSwapMode(mode);
  }

  const homeReminder = (
    <div className="buy-limit-banner" role="status">
      <strong>{t.home.limitTitle}</strong>
      {guard?.isDexLimitsEnabled ? (
        <p>
          {t.home.limitBody
            .replace("{pct}", guard.buyPctLabel)
            .replace("{maxTon}", maxTonLabel)
            .replace("{maxAwn}", maxAwnLabel)}
        </p>
      ) : (
        <p>{t.home.hint}</p>
      )}
      <div className="dedust-warn">
        <span className="dedust-warn-badge">{t.home.dedustBadge}</span>
        <p className="buy-limit-danger">{t.home.limitDanger}</p>
      </div>
      <p className="hint soft">{t.home.taxReminder}</p>
    </div>
  );

  /** One-line tip for the swap sheet — full banner stays on Home above. */
  const slimReminder = (
    <p className="hint soft" style={{ margin: 0 }}>
      {guard?.isDexLimitsEnabled
        ? `${t.home.limitMeta} ${guard.buyPctLabel} · max ${maxTonLabel}`
        : t.home.taxReminder}
    </p>
  );

  return (
    <section className="panel home-panel fade-in">
      <div className="hero-strip">
        <div>
          <p className="eyebrow">{t.home.eyebrow}</p>
          <h2 className="panel-title">{PAIR_LABEL}</h2>
          <p className="price-big">
            {last > 0 ? `${formatTinyPrice(last)} TON` : "—"}
          </p>
          {feedErr && <p className="hint soft">{t.home.feedFail}</p>}
        </div>
      </div>

      <TokenMarketPanel
        market={market}
        error={feedErr ? t.home.feedFail : undefined}
        caption={t.home.chartCaption}
      />

      <WalletSpoiler locked={locked} compact>
        {guard?.isDexLimitsEnabled && homeReminder}
        {guardErr && <p className="hint">{t.home.limitLoadFail}</p>}

        <div className="hero-actions" style={{ marginTop: 12 }}>
          <button type="button" className="neon-btn buy" onClick={() => openSwap("buy")}>
            {t.home.buy}
          </button>
          <button type="button" className="neon-btn sell" onClick={() => openSwap("sell")}>
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
            <span>{t.home.limitMeta}</span>
            <strong>
              {guard?.isDexLimitsEnabled ? guard.buyPctLabel : "OFF"}
            </strong>
          </div>
        </div>
        <p className="hint">{t.home.hint}</p>
      </WalletSpoiler>

      {swapMode && (
        <SwapPanel
          mode={swapMode}
          onClose={() => setSwapMode(null)}
          reminder={slimReminder}
        />
      )}
    </section>
  );
}
