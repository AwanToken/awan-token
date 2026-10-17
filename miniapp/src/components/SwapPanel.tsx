import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import omnistonWidgetLoader, {
  type OmnistonConfig,
  type OmnistonWidget,
} from "@ston-fi/omniston-widget-loader";
import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { MINTER, STON_FI_BUY_URL, STON_FI_SELL_URL } from "../config";
import { useI18n } from "../i18n/I18nContext";
import { openExternal } from "../lib/telegram";

export type SwapMode = "buy" | "sell";

/** Native TON — Omniston/Ston.fi asset id (not a jetton). */
const TON_NATIVE = "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c";

/** Omniston ships older @tonconnect typings; runtime UI instance is compatible. */
type IntegratedTonConnect = Extract<
  OmnistonConfig["tonconnect"],
  { type: "integrated" }
>;

type Props = {
  mode: SwapMode;
  onClose: () => void;
  /** Optional one-line tip — keep short; full limit banner stays on Home */
  reminder?: ReactNode;
};

/**
 * Option A — in-app Ston.fi via Omniston widget with the miniapp TonConnect
 * session (`integrated`). Compact fixed sheet so Buy/Sell does not push Home.
 */
export function SwapPanel({ mode, onClose, reminder }: Props) {
  const { t } = useI18n();
  const wallet = useTonAddress();
  const [tonConnectUI] = useTonConnectUI();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<OmnistonWidget | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">(
    "loading",
  );

  const stonUrl = useMemo(
    () => (mode === "buy" ? STON_FI_BUY_URL : STON_FI_SELL_URL),
    [mode],
  );

  const bidAsk = useMemo(() => {
    if (mode === "buy") {
      return { bid: TON_NATIVE, ask: MINTER };
    }
    return { bid: MINTER, ask: TON_NATIVE };
  }, [mode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");

    async function mountWidget() {
      const host = hostRef.current;
      if (!host || !tonConnectUI) {
        if (!cancelled) setStatus("fallback");
        return;
      }

      try {
        // Wait until TonConnect has restored any existing session
        await Promise.resolve(tonConnectUI.connectionRestored);
        if (cancelled || !hostRef.current) return;

        const OmnistonWidgetCtor = await omnistonWidgetLoader.load();
        if (cancelled || !hostRef.current) return;

        widgetRef.current?.unmount();
        widgetRef.current = null;
        hostRef.current.replaceChildren();

        const widget = new OmnistonWidgetCtor({
          tonconnect: {
            type: "integrated",
            instance: tonConnectUI as unknown as IntegratedTonConnect["instance"],
          },
          widget: {
            defaultBidAsset: bidAsk.bid,
            defaultAskAsset: bidAsk.ask,
            defaultAssets: false,
            customAssets: [TON_NATIVE, MINTER],
          },
        });

        // Dark-ish host so widget chrome blends with the sheet
        hostRef.current.style.setProperty("color-scheme", "dark");
        widget.mount(hostRef.current);
        widgetRef.current = widget;
        if (!cancelled) setStatus("ready");
      } catch {
        if (!cancelled) setStatus("fallback");
      }
    }

    void mountWidget();

    return () => {
      cancelled = true;
      try {
        widgetRef.current?.unmount();
      } catch {
        /* ignore */
      }
      widgetRef.current = null;
      if (hostRef.current) hostRef.current.replaceChildren();
    };
  }, [tonConnectUI, wallet, mode, bidAsk.bid, bidAsk.ask]);

  const sheet = (
    <div className="swap-overlay" role="dialog" aria-modal="true">
      <button
        type="button"
        className="swap-overlay-backdrop"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="swap-sheet">
        <div className="swap-sheet-head">
          <h3>{mode === "buy" ? t.home.buy : t.home.sell}</h3>
          <div className="swap-sheet-actions">
            {!wallet && (
              <button
                type="button"
                className="ghost-btn"
                onClick={() => void tonConnectUI.openModal()}
              >
                {t.walletGate.connect}
              </button>
            )}
            <button type="button" className="ghost-btn" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        {reminder ? <div className="swap-reminder-slim">{reminder}</div> : null}

        <p className="hint soft swap-ston-hint">
          Ston.fi · {mode === "buy" ? "TON → $AWN" : "$AWN → TON"}
          {wallet ? ` · ${wallet.slice(0, 4)}…${wallet.slice(-4)}` : ""}
        </p>

        {status === "loading" && <p className="hint">{t.home.swapLoading}</p>}

        {status === "fallback" && (
          <div className="swap-fallback">
            <p className="hint">{t.home.swapFallback}</p>
            <button
              type="button"
              className="neon-btn buy"
              onClick={() => openExternal(stonUrl)}
            >
              {t.home.openStonFi}
            </button>
          </div>
        )}

        <div
          ref={hostRef}
          className="swap-widget-host"
          hidden={status === "fallback"}
        />
      </div>
    </div>
  );

  return createPortal(sheet, document.body);
}
