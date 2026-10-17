import { useCallback, useEffect, useState } from "react";
import { NETWORK } from "../config";
import {
  DEPLOY,
  deployAddressBook,
  fetchDeployHealthMap,
  shortAddr,
  type AccountHealth,
} from "../lib/deployInfo";

export type DeployLiveFlags = {
  tradingOn: boolean;
  sellOn: boolean;
  claimActive: boolean;
  claimWindowOpen: boolean;
  limitsOn: boolean;
  maxBuyBp: number;
  maxSellBp: number;
  sellTaxBp: number;
  dexPool: string | null;
  liveSyncOk: boolean;
  holderCount: number;
};

type Light = {
  id: string;
  label: string;
  on: boolean;
  detail: string;
};

function healthClass(h: AccountHealth | undefined): string {
  if (h === "active") return "ok";
  if (h === "uninit") return "warn";
  if (h === "error" || h === "nonexist") return "bad";
  return "unk";
}

function healthLabel(h: AccountHealth | undefined): string {
  switch (h) {
    case "active":
      return "ACTIVE";
    case "uninit":
      return "UNINIT";
    case "nonexist":
      return "MISSING";
    case "error":
      return "ERR";
    case "unknown":
    case undefined:
      return "…";
    default:
      return "…";
  }
}

const ADDR_BOOK = deployAddressBook();

export function DeployStatusPanel({ live }: { live: DeployLiveFlags }) {
  const [health, setHealth] = useState<Record<string, AccountHealth>>({});
  const [copied, setCopied] = useState("");
  const [busyHealth, setBusyHealth] = useState(false);

  const refreshHealth = useCallback(async () => {
    setBusyHealth(true);
    try {
      const map = await fetchDeployHealthMap(ADDR_BOOK);
      setHealth(map);
    } finally {
      setBusyHealth(false);
    }
  }, []);

  useEffect(() => {
    void refreshHealth();
    const id = setInterval(() => void refreshHealth(), 60_000);
    return () => clearInterval(id);
  }, [refreshHealth]);

  async function copyAddr(addr: string, key: string) {
    try {
      await navigator.clipboard.writeText(addr);
      setCopied(key);
      window.setTimeout(() => setCopied(""), 1600);
    } catch {
      /* ignore */
    }
  }

  const lights: Light[] = [
    {
      id: "net",
      label: "Network",
      on: NETWORK === "mainnet",
      detail: NETWORK.toUpperCase(),
    },
    {
      id: "sync",
      label: "Live sync",
      on: live.liveSyncOk,
      detail: live.liveSyncOk ? "TonAPI OK" : "FAIL / retry",
    },
    {
      id: "trade",
      label: "Trading",
      on: live.tradingOn,
      detail: live.tradingOn ? "ENABLED" : "OFF",
    },
    {
      id: "sell",
      label: "Sells",
      on: live.sellOn,
      detail: live.sellOn ? "ENABLED" : "OFF",
    },
    {
      id: "claim",
      label: "Claim program",
      on: live.claimActive,
      detail: live.claimActive
        ? live.claimWindowOpen
          ? "ARMED · WINDOW"
          : "ARMED"
        : "IDLE",
    },
    {
      id: "buyLimit",
      label: "Buy limit",
      on: live.limitsOn,
      detail: live.limitsOn
        ? `${(live.maxBuyBp / 100).toFixed(live.maxBuyBp % 100 ? 1 : 0)}% (${live.maxBuyBp} bp)`
        : "OFF",
    },
    {
      id: "sellLimit",
      label: "Sell limit",
      on: live.limitsOn,
      detail: live.limitsOn
        ? `${(live.maxSellBp / 100).toFixed(live.maxSellBp % 100 ? 1 : 0)}% (${live.maxSellBp} bp)`
        : "OFF",
    },
    {
      id: "tax",
      label: "Sell / treasury tax",
      on: live.sellTaxBp > 0,
      detail: `${(live.sellTaxBp / 100).toFixed(live.sellTaxBp % 100 ? 1 : 0)}% (${live.sellTaxBp} bp)`,
    },
    {
      id: "vault",
      label: "DEX vault (live)",
      on: Boolean(live.dexPool),
      detail: live.dexPool ? shortAddr(live.dexPool) : "not set",
    },
    {
      id: "holders",
      label: "Holders tracked",
      on: live.holderCount > 0,
      detail: String(live.holderCount),
    },
  ];

  const fileBuy = DEPLOY.dexLimits?.maxBuyLimitBp ?? DEPLOY.tradingFlags?.maxBuyLimitBp;
  const fileSell = DEPLOY.dexLimits?.maxSellLimitBp ?? DEPLOY.tradingFlags?.maxSellLimitBp;
  const fileTax = DEPLOY.dexLimits?.sellTaxBp ?? DEPLOY.tradingFlags?.sellTaxBp;

  return (
    <section className="panel span12 deploy-status">
      <h2>On-chain / deploy status</h2>
      <p className="muted">
        Luci da stato live (TonAPI getters) + indirizzi da{" "}
        <code>deployments/mainnet.json</code>. Copia gli address — niente link
        esterni obbligatori. Health account = TonAPI <code>status</code>.
      </p>

      <div className="status-lights" role="list">
        {lights.map((l) => (
          <div
            key={l.id}
            className={`status-light ${l.on ? "on" : "off"}`}
            role="listitem"
            title={l.detail}
          >
            <span className="status-lamp" aria-hidden />
            <div className="status-meta">
              <span className="status-label">{l.label}</span>
              <span className="status-detail">{l.detail}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="deploy-meta muted" style={{ marginTop: 12 }}>
        <div>
          Deployed <strong>{DEPLOY.deployedAt}</strong>
          {DEPLOY.lpCreatedAt ? (
            <>
              {" "}
              · LP <strong>{DEPLOY.lpCreatedAt}</strong>
            </>
          ) : null}
        </div>
        <div>
          File flags (snapshot): trading{" "}
          <strong>{DEPLOY.launchFlags.trading ? "ON" : "OFF"}</strong> · sells{" "}
          <strong>{DEPLOY.launchFlags.sells ? "ON" : "OFF"}</strong> · claim{" "}
          <strong>{DEPLOY.launchFlags.claim ? "ON" : "OFF"}</strong>
          {fileBuy != null ? (
            <>
              {" "}
              · buy limit {fileBuy} bp
            </>
          ) : null}
          {fileSell != null ? (
            <>
              {" "}
              · sell limit {fileSell} bp
            </>
          ) : null}
          {fileTax != null ? <> · sell/treasury tax {fileTax} bp</> : null}
        </div>
        {DEPLOY.tradingFlags?.note || DEPLOY.launchFlags.note ? (
          <div className="deploy-note">
            {DEPLOY.tradingFlags?.note || DEPLOY.launchFlags.note}
          </div>
        ) : null}
      </div>

      <div className="btn-row" style={{ marginTop: 10 }}>
        <button
          type="button"
          className="cmd"
          disabled={busyHealth}
          onClick={() => void refreshHealth()}
        >
          {busyHealth ? "Health…" : "Refresh health"}
        </button>
      </div>

      <div className="addr-book">
        {ADDR_BOOK.map((row) => {
          const h = health[row.key];
          return (
            <div key={row.key} className="addr-book-row">
              <span className={`health-pill ${healthClass(h)}`}>
                {healthLabel(h)}
              </span>
              <span className="addr-book-label">{row.label}</span>
              <code className="addr-book-addr" title={row.address}>
                {shortAddr(row.address, 8, 6)}
              </code>
              <button
                type="button"
                className="cmd"
                onClick={() => void copyAddr(row.address, row.key)}
              >
                {copied === row.key ? "Copied" : "Copy"}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
