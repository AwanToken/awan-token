import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EXPLORER } from "../config";
import { DEDUST_POOL } from "../lib/dedustFeed";
import {
  chartYDomain,
  type MarketSnapshot,
} from "../lib/geckoMarket";
import {
  formatCompact,
  formatTinyPrice,
  formatUsd,
  truncateAddress,
} from "../lib/formatTinyPrice";

const GT_POOL_URL = `https://www.geckoterminal.com/ton/pools/${DEDUST_POOL}`;

type Props = {
  market: MarketSnapshot | null;
  error?: string;
};

function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="tm-metric">
      <span className="tm-metric-k">{label}</span>
      <strong className="tm-metric-v">{value}</strong>
      {sub ? <span className="tm-metric-sub">{sub}</span> : null}
    </div>
  );
}

export function TokenMarketPanel({ market, error }: Props) {
  const [copied, setCopied] = useState(false);
  const candles = market?.candles ?? [];
  const yDomain = useMemo(() => chartYDomain(candles), [candles]);

  const change = market?.change24hPct;
  const changeCls =
    change == null ? "" : change >= 0 ? "tm-up" : "tm-down";

  async function copyContract() {
    if (!market?.contract) return;
    try {
      await navigator.clipboard.writeText(market.contract);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  const priceNative = market?.priceNative ?? 0;
  const priceUsd = market?.priceUsd ?? 0;

  return (
    <div className="tm-panel">
      <div className="tm-head">
        <div>
          <p className="tm-pair">$AWN / TON · market</p>
          <p className="tm-price-line">
            <span className="tm-price-main">
              {priceNative > 0 ? `${formatTinyPrice(priceNative)} TON` : "—"}
            </span>
            {priceUsd > 0 && (
              <span className="tm-price-usd">{formatUsd(priceUsd, 8)}</span>
            )}
            {change != null && (
              <span className={`tm-change ${changeCls}`}>
                {change >= 0 ? "+" : ""}
                {change.toFixed(2)}%
              </span>
            )}
          </p>
        </div>
        {market?.source === "dedust" && (
          <span className="tm-badge">DeDust fallback</span>
        )}
      </div>

      <div className="tm-layout">
        <div className="tm-chart-col">
          <div className="tm-chart-frame">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart
                data={
                  candles.length
                    ? candles
                    : [
                        {
                          t: "—",
                          ts: 0,
                          price: 0,
                          high: 0,
                          low: 0,
                          volume: 0,
                        },
                      ]
                }
                margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
              >
                <defs>
                  <linearGradient id="tmAdminFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#b6ff3b" stopOpacity={0.65} />
                    <stop offset="100%" stopColor="#b6ff3b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1e3348" strokeDasharray="3 3" />
                <XAxis
                  dataKey="t"
                  tick={{ fill: "#7f9bb8", fontSize: 10 }}
                  minTickGap={36}
                />
                <YAxis
                  domain={yDomain}
                  stroke="#7f9bb8"
                  width={62}
                  tick={{ fill: "#7f9bb8", fontSize: 10 }}
                  tickFormatter={(v: number) => formatTinyPrice(Number(v), 3)}
                />
                <Tooltip
                  contentStyle={{
                    background: "#0d1520",
                    border: "1px solid #1e3348",
                    color: "#e8f2ff",
                  }}
                  formatter={(v) => [
                    `${formatTinyPrice(Number(v ?? 0))} TON`,
                    "Price",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke="#b6ff3b"
                  strokeWidth={2}
                  fill="url(#tmAdminFill)"
                  isAnimationActive={false}
                  dot={false}
                  name="TON / $AWN"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="muted" style={{ marginTop: 6, fontSize: "0.75rem" }}>
            OHLCV 15m (GeckoTerminal) · Y padded to data range · poll ~25s.
            Buy/Sell utenti → Ston.fi.
          </p>
          {error && (
            <p className="muted" style={{ color: "var(--hot)" }}>
              {error}
            </p>
          )}
        </div>

        <div className="tm-metrics">
          <Metric label="Price USD" value={priceUsd > 0 ? formatUsd(priceUsd, 8) : "—"} />
          <Metric
            label="Price TON"
            value={priceNative > 0 ? formatTinyPrice(priceNative) : "—"}
          />
          <Metric label="FDV" value={formatUsd(market?.fdvUsd)} />
          <Metric
            label="Market Cap"
            value={market?.marketCapUsd != null ? formatUsd(market.marketCapUsd) : "—"}
          />
          <Metric label="Total Supply" value={formatCompact(market?.totalSupply)} />
          <Metric
            label="Circulating"
            value={formatCompact(market?.circulatingSupply)}
            sub={market?.marketCapUsd == null ? "≈ total (MC n/a)" : undefined}
          />
          <Metric label="Volume 24h" value={formatUsd(market?.volume24hUsd)} />
          <Metric
            label="Txn 24h"
            value={`${market?.buys24h ?? 0} / ${market?.sells24h ?? 0}`}
            sub="buys / sells"
          />
          <Metric label="Liquidity" value={formatUsd(market?.liquidityUsd)} />
          <Metric
            label="Holders"
            value={
              market?.holders != null
                ? market.holders.toLocaleString("en-US")
                : "—"
            }
          />
          <Metric
            label="ATH"
            value={
              market?.ath ? `${formatTinyPrice(market.ath.price)} TON` : "—"
            }
            sub={market?.ath?.label}
          />
          <Metric
            label="ATL"
            value={
              market?.atl ? `${formatTinyPrice(market.atl.price)} TON` : "—"
            }
            sub={market?.atl?.label}
          />
          <Metric label="Age" value={market?.ageLabel ?? "—"} />
          <div className="tm-metric tm-contract">
            <span className="tm-metric-k">Contract</span>
            <div className="tm-contract-row">
              <strong className="tm-metric-v mono">
                {truncateAddress(market?.contract ?? "", 8, 6)}
              </strong>
              <button
                type="button"
                className="cmd tm-copy"
                onClick={() => void copyContract()}
                disabled={!market?.contract}
              >
                {copied ? "OK" : "Copy"}
              </button>
              {market?.contract ? (
                <a
                  className="addr tm-ext-link"
                  href={`${EXPLORER}/${market.contract}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Explorer
                </a>
              ) : null}
              <a
                className="addr tm-ext-link"
                href={GT_POOL_URL}
                target="_blank"
                rel="noreferrer"
              >
                GeckoTerminal
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
