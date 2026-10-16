import type { ReactNode } from "react";
import { useTonConnectUI } from "@tonconnect/ui-react";
import { useI18n } from "../i18n/I18nContext";

type Props = {
  locked: boolean;
  children: ReactNode;
  /** Compact banner for sections inside home */
  compact?: boolean;
};

/** Blurs content until wallet is connected — chart stays outside this wrapper. */
export function WalletSpoiler({ locked, children, compact }: Props) {
  const { t } = useI18n();
  const [tc] = useTonConnectUI();

  if (!locked) return <>{children}</>;

  return (
    <div className={`wallet-spoiler${compact ? " compact" : ""}`}>
      <div className="wallet-spoiler-blur" aria-hidden>
        {children}
      </div>
      <div className="wallet-spoiler-veil">
        <p className="wallet-spoiler-title">{t.walletGate.title}</p>
        <p className="wallet-spoiler-hint">{t.walletGate.hint}</p>
        <button type="button" className="neon-btn buy" onClick={() => void tc.openModal()}>
          {t.walletGate.connect}
        </button>
      </div>
    </div>
  );
}
