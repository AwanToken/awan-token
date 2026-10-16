import { useState } from "react";
import { useTonAddress } from "@tonconnect/ui-react";
import { useI18n } from "../i18n/I18nContext";
import { type AppStatusValue, useAppStatus } from "../lib/appStatus";
import { loadEco } from "../lib/gameEconomy";
import { OwnerPlayerIdentity } from "./OwnerPlayerIdentity";

type RowProps = {
  label: string;
  current: AppStatusValue;
  unlocked: boolean;
  onSet: (v: AppStatusValue) => void;
  comingLabel: string;
  liveLabel: string;
};

function StatusRow({ label, current, unlocked, onSet, comingLabel, liveLabel }: RowProps) {
  return (
    <div className="owner-status-row">
      <div className="owner-status-row-head">
        <span>{label}</span>
        <em className={current === "coming" ? "st-coming" : "st-live"}>
          {current === "coming" ? comingLabel : liveLabel}
        </em>
      </div>
      <div className="owner-status-btns">
        <button
          type="button"
          className={`neon-btn warn compact ${current === "coming" ? "active-status" : ""}`}
          disabled={!unlocked}
          onClick={() => onSet("coming")}
        >
          {comingLabel}
        </button>
        <button
          type="button"
          className={`neon-btn compact ${current === "live" ? "active-status" : ""}`}
          disabled={!unlocked}
          onClick={() => onSet("live")}
        >
          {liveLabel}
        </button>
      </div>
    </div>
  );
}

type Props = {
  /** When true, render without wrapping <details> (parent already provides one). */
  embedded?: boolean;
  defaultOpen?: boolean;
};

export function OwnerStatusPanel({ embedded, defaultOpen }: Props) {
  const { t } = useI18n();
  const wallet = useTonAddress();
  const {
    status,
    hasOverride,
    setGlobal,
    setGame,
    setAll,
    clearOverrides,
  } = useAppStatus();
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const [pin, setPin] = useState("");
  const unlocked = pin.trim() === "OWNER";
  const sessionEco = loadEco(wallet);

  const body = (
    <>
      <p className="hint">{t.games.ownerStatusHint}</p>
      <label className="field">
        PIN
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          autoComplete="off"
          placeholder="OWNER"
        />
      </label>
      {unlocked && (
        <div className="owner-session-block">
          <p className="hint">{t.games.ownerSessionPlayer}</p>
          <OwnerPlayerIdentity
            wallet={wallet}
            telegram={sessionEco.telegram}
            preferLive
            walletLabel={t.games.ownerWallet}
            tgLabel={t.games.ownerTelegram}
            tgUnknown={t.games.ownerTelegramUnknown}
          />
        </div>
      )}
      {hasOverride && <p className="hint owner-override-flag">{t.games.overrideActive}</p>}

      <StatusRow
        label={t.games.statusGlobal}
        current={status.global}
        unlocked={unlocked}
        onSet={setGlobal}
        comingLabel={t.games.comingSoon}
        liveLabel={t.games.backLive}
      />
      <StatusRow
        label={t.games.statusSiege}
        current={status.games.siege}
        unlocked={unlocked}
        onSet={(v) => setGame("siege", v)}
        comingLabel={t.games.comingSoon}
        liveLabel={t.games.backLive}
      />
      <StatusRow
        label={t.games.statusRun}
        current={status.games.run}
        unlocked={unlocked}
        onSet={(v) => setGame("run", v)}
        comingLabel={t.games.comingSoon}
        liveLabel={t.games.backLive}
      />

      <div className="owner-status-btns bulk">
        <button
          type="button"
          className="neon-btn warn compact"
          disabled={!unlocked}
          onClick={() => setAll("coming")}
        >
          {t.games.setAllComing}
        </button>
        <button
          type="button"
          className="neon-btn compact"
          disabled={!unlocked}
          onClick={() => setAll("live")}
        >
          {t.games.setAllLive}
        </button>
      </div>
      <button
        type="button"
        className="ghost-btn owner-clear-btn"
        disabled={!unlocked || !hasOverride}
        onClick={() => clearOverrides()}
      >
        {t.games.clearOverrides}
      </button>
    </>
  );

  if (embedded) return <div className="owner-status-embed">{body}</div>;

  return (
    <details
      className="owner-claim-box owner-status-box"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary>{t.games.ownerStatus}</summary>
      {body}
    </details>
  );
}
