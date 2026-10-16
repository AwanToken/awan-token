import { useEffect, type ReactNode } from "react";
import { TonConnectButton } from "@tonconnect/ui-react";
import { NETWORK } from "../config";
import { useI18n } from "../i18n/I18nContext";
import { ensureAudio } from "../lib/audio";
import { AudioDock } from "./AudioDock";
import { ComingSoonOverlay } from "./ComingSoonOverlay";

export type TabId = "home" | "claim" | "wallet" | "games" | "board" | "roadmap";

type Props = {
  tab: TabId;
  onTab: (t: TabId) => void;
  children: ReactNode;
  hideNav?: boolean;
  /** Fullscreen game session — hide chrome so canvas is visible */
  playing?: boolean;
};

export function Layout({ tab, onTab, children, hideNav, playing }: Props) {
  const { t, lang, setLang, langs } = useI18n();

  useEffect(() => {
    const kick = () => {
      void ensureAudio();
      window.removeEventListener("pointerdown", kick);
    };
    window.addEventListener("pointerdown", kick, { once: true });
    return () => window.removeEventListener("pointerdown", kick);
  }, []);

  const navTabs: { id: TabId; label: string }[] = [
    { id: "home", label: t.nav.home },
    { id: "wallet", label: t.nav.wallet },
    { id: "claim", label: t.nav.claim },
    { id: "games", label: t.nav.games },
    { id: "roadmap", label: t.nav.roadmap },
    { id: "board", label: t.nav.board },
  ];

  return (
    <div className={`app-shell scene-3d${playing ? " playing" : ""}`}>
      <div className="fx-grid" aria-hidden />
      <div className="fx-orbs" aria-hidden>
        <span className="orb o1" />
        <span className="orb o2" />
        <span className="orb o3" />
      </div>
      <div className="scanline-overlay" aria-hidden />
      <header className="app-header glass-3d">
        <div className="brand-row float-soft">
          <img src="/awn-logo.png" alt="$AWN" className="brand-logo spin-slow" />
          <p className="brand-ticker neon-text">$AWN</p>
          <p className="brand-sub brand-sub-mobile">{t.brandSub}</p>
        </div>

        <div className="header-center">
          <h1 className="brand-name neon-text">AWAN</h1>
          <span className={`net-pill ${NETWORK}`}>{NETWORK}</span>
        </div>

        <div className="header-actions">
          <div className="header-right">
            <div className="header-top-controls">
              <div className="lang-switch" role="group" aria-label="Language">
                {langs.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    className={`lang-btn ${lang === l.id ? "active" : ""}`}
                    onClick={() => setLang(l.id)}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
              <div className="header-audio">
                <AudioDock compact={Boolean(playing)} />
              </div>
            </div>
            <TonConnectButton className="tc-btn" />
          </div>
        </div>
      </header>
      <main className="app-main stage-3d">{children}</main>
      {!hideNav && (
        <nav className="cyber-nav nav-3d">
          {navTabs.map((tb) => (
            <button
              key={tb.id}
              type="button"
              className={`nav-tab ${tab === tb.id ? "active" : ""}`}
              onClick={() => onTab(tb.id)}
            >
              <span className="nav-glow" />
              {tb.label}
            </button>
          ))}
        </nav>
      )}
      {!playing && <ComingSoonOverlay />}
    </div>
  );
}
