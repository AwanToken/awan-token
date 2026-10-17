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

type Props = {
  market: MarketSnapshot | null;
  error?: string;
  caption?: string;
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

export function TokenMarketPanel({ market, error, caption }: Props) {
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
          <p className="tm-pair">$AWN / TON</p>
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
      </div>

      <div className="tm-layout">
        <div className="tm-chart-col">
          <div className="tm-chart-frame">
            <ResponsiveContainer width="100%" height={260}>
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
                margin={{ top: 8, right: 4, left: 0, bottom: 4 }}
              >
                <defs>
                  <linearGradient id="tmAwnFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7df9ff" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#7df9ff" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(125,249,255,0.08)" vertical={false} />
                <XAxis
                  dataKey="t"
                  tick={{ fill: "#8a7aa8", fontSize: 9 }}
                  minTickGap={40}
                  tickMargin={6}
                />
                <YAxis
                  domain={yDomain}
                  tick={{ fill: "#8a7aa8", fontSize: 9 }}
                  width={58}
                  tickFormatter={(v: number) => formatTinyPrice(Number(v), 3)}
                  tickMargin={2}
                />
                <Tooltip
                  contentStyle={{
                    background: "#16082a",
                    border: "1px solid #7df9ff",
                    borderRadius: 0,
                    fontFamily: "Rajdhani",
                  }}
                  formatter={(v) => [
                    `${formatTinyPrice(Number(v ?? 0))} TON`,
                    "Price",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke="#7df9ff"
                  strokeWidth={2}
                  fill="url(#tmAwnFill)"
                  isAnimationActive={false}
                  // Sparse OHLCV (thin pool) — show vertices so a short series still reads as a chart
                  dot={
                    candles.length > 1 && candles.length <= 32
                      ? { r: 3, stroke: "#7df9ff", fill: "#16082a", strokeWidth: 2 }
                      : false
                  }
                  activeDot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {caption && <p className="chart-caption">{caption}</p>}
          {error && <p className="hint soft">{error}</p>}
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
                className="ghost-btn tm-copy"
                onClick={() => void copyContract()}
                disabled={!market?.contract}
              >
                {copied ? "OK" : "Copy"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
