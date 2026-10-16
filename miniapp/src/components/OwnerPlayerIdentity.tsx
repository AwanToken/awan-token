import { formatTelegramHandle, getTelegramUser, type TelegramIdentity } from "../lib/telegram";

type Props = {
  wallet?: string | null;
  telegram?: TelegramIdentity | null;
  telegramLabel?: string;
  walletLabel: string;
  tgLabel: string;
  tgUnknown: string;
  /** Prefer live WebApp user when entry has no telegram (current session). */
  preferLive?: boolean;
  compact?: boolean;
};

/** Owner-only: wallet + Telegram handle for control. */
export function OwnerPlayerIdentity({
  wallet,
  telegram,
  telegramLabel,
  walletLabel,
  tgLabel,
  tgUnknown,
  preferLive,
  compact,
}: Props) {
  const live = preferLive ? getTelegramUser() : null;
  const handle =
    telegramLabel ||
    formatTelegramHandle(telegram) ||
    formatTelegramHandle(live) ||
    "";
  const addr = wallet?.trim() || "";
  const short = addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "—";

  return (
    <div className={`owner-identity${compact ? " compact" : ""}`}>
      <div className="owner-identity-row">
        <span className="owner-identity-k">{walletLabel}</span>
        <code className="owner-identity-v" title={addr || undefined}>
          {short}
        </code>
      </div>
      <div className="owner-identity-row">
        <span className="owner-identity-k">{tgLabel}</span>
        <strong className={`owner-identity-v tg${handle ? "" : " muted"}`}>
          {handle || tgUnknown}
        </strong>
      </div>
    </div>
  );
}
