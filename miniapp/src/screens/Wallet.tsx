import { useCallback, useEffect, useState } from "react";
import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { EXPLORER, MINTER, NETWORK } from "../config";
import { useI18n } from "../i18n/I18nContext";
import {
  estimateClaimPayout,
  fetchClaimStatus,
  fetchHolder,
  fetchJettonSupply,
  fetchJettonWalletAddress,
  fetchTonBalance,
  fetchTradingSnap,
  fromNanoTon,
  fromUnits,
  toFriendlyAddress,
} from "../lib/ton";
import {
  loadClaimHistory,
  totalClaimedTon,
  type ClaimRecord,
} from "../lib/claimHistory";

export function WalletScreen() {
  const { t } = useI18n();
  const walletRaw = useTonAddress();
  const wallet = walletRaw
    ? (() => {
        try {
          return toFriendlyAddress(walletRaw);
        } catch {
          return walletRaw;
        }
      })()
    : "";
  const [tonConnectUI] = useTonConnectUI();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [tonBal, setTonBal] = useState<string>("—");
  const [awnBal, setAwnBal] = useState<string>("—");
  const [jw, setJw] = useState<string | null>(null);
  const [inClaimPool, setInClaimPool] = useState(false);
  const [claimedThisCycle, setClaimedThisCycle] = useState(false);
  const [cycleId, setCycleId] = useState(0);
  const [estClaim, setEstClaim] = useState<string>("—");
  const [fullElig, setFullElig] = useState(true);
  const [dexPool, setDexPool] = useState<string | null>(null);
  const [tradingOn, setTradingOn] = useState(false);
  const [history, setHistory] = useState<ClaimRecord[]>([]);
  const [totalEarned, setTotalEarned] = useState(0);

  const refresh = useCallback(async () => {
    if (!walletRaw) {
      setTonBal("—");
      setAwnBal("—");
      setInClaimPool(false);
      setHistory([]);
      setTotalEarned(0);
      setErr("");
      return;
    }
    setBusy(true);
    setErr("");

    const softFail = (label: string) => {
      console.warn(`[wallet] ${label}`);
    };
    let anyFail = false;
    let holderBal: bigint | null = null;
    let supply: bigint | null = null;
    let snapshot: bigint | null = null;
    let minBal: bigint | null = null;
    let periodStart: bigint | null = null;

    // Fetch independently — one failure must not blank the rest.
    const tonP = fetchTonBalance(walletRaw)
      .then((ton) => {
        setTonBal(fromNanoTon(ton));
      })
      .catch(() => {
        anyFail = true;
        softFail("TON balance");
      });

    const holderP = fetchHolder(walletRaw)
      .then((holder) => {
        holderBal = holder.balance;
        minBal = holder.minBalancePeriod;
        periodStart = holder.periodStartBalance;
        setAwnBal(fromUnits(holder.balance));
        setInClaimPool(holder.balance > 0n);
        return holder;
      })
      .catch(() => {
        anyFail = true;
        softFail("$AWN holder");
        return null;
      });

    const supplyP = fetchJettonSupply()
      .then((s) => {
        supply = s;
        return s;
      })
      .catch(() => {
        anyFail = true;
        softFail("supply");
        return null;
      });

    const claimP = fetchClaimStatus()
      .then((claim) => {
        snapshot = claim.claimPoolSnapshot;
        setCycleId(claim.cycleId);
        return claim;
      })
      .catch(() => {
        anyFail = true;
        softFail("claim status");
        return null;
      });

    const tradingP = fetchTradingSnap()
      .then((trading) => {
        setDexPool(trading.dexPool);
        setTradingOn(trading.isTradingEnabled);
      })
      .catch(() => {
        anyFail = true;
        softFail("trading");
      });

    const jwP = fetchJettonWalletAddress(walletRaw)
      .then((jwAddr) => {
        setJw(jwAddr);
      })
      .catch(() => {
        anyFail = true;
        softFail("jetton wallet");
      });

    const [, holder, , claim] = await Promise.all([
      tonP,
      holderP,
      supplyP,
      claimP,
      tradingP,
      jwP,
    ]);

    if (holder && claim) {
      setClaimedThisCycle(holder.claimedCycleId === claim.cycleId && claim.cycleId > 0);
    }

    if (holderBal != null && supply != null && snapshot != null && minBal != null && periodStart != null) {
      const est = estimateClaimPayout({
        snapshot,
        balance: holderBal,
        totalSupply: supply,
        minBalancePeriod: minBal,
        periodStartBalance: periodStart,
      });
      setEstClaim(fromNanoTon(est.payout));
      setFullElig(est.fullEligible);
    }

    setHistory(loadClaimHistory(walletRaw));
    setTotalEarned(totalClaimedTon(walletRaw));

    if (anyFail) {
      setErr("Alcuni dati on-chain non sono disponibili al momento. Riprova con AGGIORNA.");
    }
    setBusy(false);
  }, [walletRaw]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 25000);
    return () => clearInterval(id);
  }, [refresh]);

  if (!walletRaw) {
    return (
      <section className="panel wallet-panel fade-in">
        <p className="eyebrow">{t.wallet.eyebrow}</p>
        <h2 className="panel-title">{t.wallet.title}</h2>
        <p className="lede">{t.wallet.connectLede}</p>
        <button type="button" className="neon-btn buy" onClick={() => void tonConnectUI.openModal()}>
          {t.wallet.connect}
        </button>
      </section>
    );
  }

  return (
    <section className="panel wallet-panel fade-in">
      <p className="eyebrow">{t.wallet.eyebrow}</p>
      <h2 className="panel-title">{t.wallet.title}</h2>
      <p className="lede">{t.wallet.lede}</p>

      <div className="wallet-addr mono">{wallet || walletRaw}</div>

      <div className="meta-grid wallet-stats">
        <div className="meta-cell glow-cell">
          <span>TON</span>
          <strong>{tonBal}</strong>
        </div>
        <div className="meta-cell glow-cell">
          <span>$AWN</span>
          <strong>{awnBal}</strong>
        </div>
        <div className="meta-cell glow-cell">
          <span>{t.wallet.network}</span>
          <strong>{NETWORK}</strong>
        </div>
      </div>

      <div className={`pool-badge ${inClaimPool ? "yes" : "no"}`}>
        <strong>{t.wallet.claimPool}</strong>
        <span>
          {inClaimPool ? t.wallet.poolYes : t.wallet.poolNo}
          {claimedThisCycle ? ` · ${t.wallet.claimedCycle} #${cycleId}` : ""}
        </span>
      </div>

      <div className="earn-card dual-flows-note">
        <p className="eyebrow">{t.wallet.dualFlowsTitle}</p>
        <p className="hint">{t.wallet.dualFlowsBody}</p>
      </div>

      <div className="meta-grid">
        <div className="meta-cell">
          <span>{t.wallet.estClaim}</span>
          <strong>{estClaim} TON</strong>
        </div>
        <div className="meta-cell">
          <span>{t.wallet.eligibility}</span>
          <strong>{fullElig ? t.wallet.fullReward : t.wallet.halfReward}</strong>
        </div>
        <div className="meta-cell">
          <span>{t.wallet.dex}</span>
          <strong>{tradingOn ? "ON" : "OFF"}</strong>
        </div>
      </div>

      {dexPool && (
        <p className="hint">
          {t.wallet.dexPool}:{" "}
          <a className="link" href={`${EXPLORER}/${dexPool}`} target="_blank" rel="noreferrer">
            {dexPool.slice(0, 12)}…
          </a>
        </p>
      )}

      <div className="earn-card">
        <p className="eyebrow">{t.wallet.earnings}</p>
        <p className="price-big">{totalEarned.toFixed(4)} TON</p>
        <p className="hint">{t.wallet.earningsHint}</p>
      </div>

      <h3 className="sub-title">{t.wallet.history}</h3>
      <ul className="claim-hist">
        {history.length === 0 && <li className="hint">{t.wallet.historyEmpty}</li>}
        {history.map((h) => (
          <li key={`${h.cycleId}-${h.at}`}>
            <span>
              {t.wallet.cycle} #{h.cycleId}
            </span>
            <strong>{h.amountTon} TON</strong>
            <time>{new Date(h.at).toLocaleString()}</time>
          </li>
        ))}
      </ul>

      {jw && (
        <p className="hint mono">
          Jetton wallet:{" "}
          <a className="link" href={`${EXPLORER}/${jw}`} target="_blank" rel="noreferrer">
            {jw.slice(0, 14)}…
          </a>
        </p>
      )}
      <p className="hint">
        Minter:{" "}
        <a className="link" href={`${EXPLORER}/${MINTER}`} target="_blank" rel="noreferrer">
          {MINTER.slice(0, 14)}…
        </a>
      </p>

      {err && <p className="err">{err}</p>}
      <button type="button" className="neon-btn" disabled={busy} onClick={() => void refresh()}>
        {busy ? "…" : t.wallet.refresh}
      </button>
    </section>
  );
}
