import { useCallback, useEffect, useState } from "react";
import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { CLAIM_PERIOD, CLAIM_WINDOW, EXPLORER, MINTER, TOKEN_OWNER } from "../config";
import { useI18n } from "../i18n/I18nContext";
import { addClaimRecord } from "../lib/claimHistory";
import {
  bodyClaimReward,
  deriveCyclePhase,
  estimateClaimPayout,
  fetchClaimStatus,
  fetchHolder,
  fetchJettonSupply,
  fmtCountdown,
  fromNanoTon,
  fromUnits,
  normalizeAddress,
  toNano,
  type ClaimStatus,
} from "../lib/ton";
import { haptic } from "../lib/telegram";

function isTokenOwner(wallet: string | null): boolean {
  if (!wallet) return false;
  try {
    return normalizeAddress(wallet).equals(normalizeAddress(TOKEN_OWNER));
  } catch {
    return false;
  }
}

export function ClaimScreen() {
  const { t } = useI18n();
  const wallet = useTonAddress();
  const [tonConnectUI] = useTonConnectUI();
  const [status, setStatus] = useState<ClaimStatus | null>(null);
  const [holderHint, setHolderHint] = useState("");
  const [alreadyClaimed, setAlreadyClaimed] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const ownerBlocked = isTokenOwner(wallet);

  const refresh = useCallback(async () => {
    try {
      setErr("");
      const s = await fetchClaimStatus();
      setStatus(s);
      if (wallet) {
        try {
          const h = await fetchHolder(wallet);
          const claimed = h.claimedCycleId === s.cycleId && s.cycleId > 0;
          setAlreadyClaimed(claimed);
          setHolderHint(
            claimed
              ? t.claim.alreadyClaimedHint.replace("#{cycle}", String(s.cycleId))
              : `${fromUnits(h.minBalancePeriod)} $AWN · ${fromUnits(h.balance)} $AWN`,
          );
        } catch {
          setHolderHint("—");
        }
      } else {
        setAlreadyClaimed(false);
        setHolderHint(t.claim.connectHint);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "RPC error");
    }
  }, [wallet, t.claim.connectHint, t.claim.alreadyClaimedHint]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    const r = setInterval(() => void refresh(), 20000);
    return () => {
      clearInterval(timer);
      clearInterval(r);
    };
  }, [refresh]);

  const phase = status ? deriveCyclePhase(status, now) : { kind: "inactive" as const };
  const windowOpen = status?.claimWindowOpen ?? false;
  /** Global window may stay open for others; for this wallet claim is locked after success. */
  const canClaim =
    !!wallet &&
    !!status?.claimProgramActive &&
    windowOpen &&
    !alreadyClaimed &&
    !ownerBlocked &&
    !busy;

  async function onClaim() {
    if (!wallet) {
      await tonConnectUI.openModal();
      return;
    }
    if (ownerBlocked) {
      setErr(t.claim.ownerNoClaimHint);
      return;
    }
    if (alreadyClaimed) {
      setErr(t.claim.alreadyClaimedNote);
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const [holder, supply, st] = await Promise.all([
        fetchHolder(wallet),
        fetchJettonSupply(),
        status ? Promise.resolve(status) : fetchClaimStatus(),
      ]);
      if (holder.claimedCycleId === st.cycleId && st.cycleId > 0) {
        setAlreadyClaimed(true);
        setHolderHint(t.claim.alreadyClaimedHint.replace("#{cycle}", String(st.cycleId)));
        setErr(t.claim.alreadyClaimedNote);
        return;
      }
      if (!st.claimWindowOpen) {
        setErr(t.claim.windowClosedNote);
        return;
      }

      const est = estimateClaimPayout({
        snapshot: st.claimPoolSnapshot,
        balance: holder.balance,
        totalSupply: supply,
        minBalancePeriod: holder.minBalancePeriod,
        periodStartBalance: holder.periodStartBalance,
      });

      const body = bodyClaimReward().toBoc().toString("base64");
      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [
          {
            address: MINTER,
            amount: toNano("0.08").toString(),
            payload: body,
          },
        ],
      });
      addClaimRecord(wallet, {
        cycleId: st.cycleId,
        amountTon: fromNanoTon(est.payout),
        amountNano: est.payout.toString(),
        txHint: "ClaimReward submitted",
      });
      // Lock immediately so a second tap cannot burn fees before RPC refresh.
      setAlreadyClaimed(true);
      setHolderHint(t.claim.alreadyClaimedHint.replace("#{cycle}", String(st.cycleId)));
      haptic("medium");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Claim rejected");
    } finally {
      setBusy(false);
      void refresh();
    }
  }

  return (
    <section className="panel claim-panel fade-in">
      <p className="eyebrow">{t.claim.eyebrow}</p>
      <h2 className="panel-title">{t.claim.title}</h2>
      <p className="lede">
        {CLAIM_PERIOD / 86400}d · {CLAIM_WINDOW / 3600}h · {t.claim.lede}
      </p>

      <div className="timer-card pulse-border">
        {ownerBlocked && (
          <>
            <span className="timer-label">{t.claim.ownerNoClaim}</span>
            <strong className="timer-value">—</strong>
            <p className="hint">{t.claim.ownerNoClaimHint}</p>
          </>
        )}
        {!ownerBlocked && alreadyClaimed && status && (
          <>
            <span className="timer-label">{t.claim.alreadyClaimed}</span>
            <strong className="timer-value">{t.claim.cycle} #{status.cycleId}</strong>
            <p className="hint">
              {t.claim.alreadyClaimedHint.replace("#{cycle}", String(status.cycleId))}
            </p>
          </>
        )}
        {!ownerBlocked && !alreadyClaimed && phase.kind === "inactive" && (
          <>
            <span className="timer-label">{t.claim.program}</span>
            <strong className="timer-value">{t.claim.inactive}</strong>
            <p className="hint">{t.claim.inactiveHint}</p>
          </>
        )}
        {!ownerBlocked && !alreadyClaimed && phase.kind === "accrual" && (
          <>
            <span className="timer-label">{t.claim.accrual}</span>
            <strong className="timer-value">{fmtCountdown(phase.secondsLeft)}</strong>
            <p className="hint">{t.claim.accrualHint}</p>
          </>
        )}
        {!ownerBlocked && !alreadyClaimed && phase.kind === "window" && (
          <>
            <span className="timer-label">
              {windowOpen ? t.claim.windowOpen : t.claim.windowPhase} · {t.claim.closesIn}
            </span>
            <strong className="timer-value glow-cyan">{fmtCountdown(phase.secondsLeft)}</strong>
            <p className="hint">
              {windowOpen ? t.claim.windowOpenHint : t.claim.windowClosedHint}
            </p>
          </>
        )}
        {!ownerBlocked && !alreadyClaimed && phase.kind === "between" && (
          <>
            <span className="timer-label">{t.claim.between}</span>
            <strong className="timer-value">{t.claim.refreshing}</strong>
          </>
        )}
      </div>

      <div className="meta-grid">
        <div className="meta-cell">
          <span>{t.claim.cycle}</span>
          <strong>#{status?.cycleId ?? "—"}</strong>
        </div>
        <div className="meta-cell">
          <span>{t.claim.treasury}</span>
          <strong>{status ? fromUnits(status.treasury) : "—"}</strong>
        </div>
        <div className="meta-cell">
          <span>{t.claim.poolSnap}</span>
          <strong>{status ? fromUnits(status.claimPoolSnapshot) : "—"}</strong>
        </div>
      </div>

      <p className="holder-hint">{holderHint}</p>
      {err && <p className="err">{err}</p>}

      <div className="row-actions">
        <button type="button" className="neon-btn" onClick={() => void refresh()}>
          {t.claim.refresh}
        </button>
        <button
          type="button"
          className="neon-btn buy"
          disabled={!!wallet && !canClaim}
          onClick={() => void onClaim()}
        >
          {!wallet
            ? t.claim.connectClaim
            : busy
              ? t.claim.signing
              : ownerBlocked
                ? t.claim.ownerNoClaim
                : alreadyClaimed
                  ? t.claim.alreadyClaimed
                  : t.claim.claimReward}
        </button>
      </div>
      {ownerBlocked && wallet && <p className="hint">{t.claim.ownerNoClaimHint}</p>}
      {!ownerBlocked && alreadyClaimed && wallet && (
        <p className="hint">{t.claim.alreadyClaimedNote}</p>
      )}
      {!ownerBlocked && !alreadyClaimed && !windowOpen && wallet && (
        <p className="hint">{t.claim.windowClosedNote}</p>
      )}
      <a className="link" href={`${EXPLORER}/${MINTER}`} target="_blank" rel="noreferrer">
        {t.claim.viewMinter}
      </a>
    </section>
  );
}
