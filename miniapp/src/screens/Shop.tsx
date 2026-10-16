import { useEffect, useState } from "react";
import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { TREASURY_OR_KEEPER } from "../config";
import { useI18n } from "../i18n/I18nContext";
import { toNano } from "../lib/ton";
import { UPGRADES, loadOwned, markOwned, type UpgradeId } from "../lib/upgrades";
import { haptic } from "../lib/telegram";

const ICON: Record<string, string> = {
  gun: "⚔",
  shield: "🛡",
  speed: "🚀",
  missile: "🚀",
  rail: "⚡",
};

export function ShopScreen() {
  const { t } = useI18n();
  const wallet = useTonAddress();
  const [tonConnectUI] = useTonConnectUI();
  const [owned, setOwned] = useState<UpgradeId[]>(() => loadOwned(wallet));
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState<UpgradeId | null>(null);

  useEffect(() => {
    setOwned(loadOwned(wallet));
  }, [wallet]);

  async function buy(id: UpgradeId) {
    if (!wallet) {
      await tonConnectUI.openModal();
      return;
    }
    if (owned.includes(id)) return;
    const u = UPGRADES.find((x) => x.id === id)!;
    setBusy(id);
    setMsg("");
    try {
      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [{ address: TREASURY_OR_KEEPER, amount: toNano(u.priceTon).toString() }],
      });
      setOwned(markOwned(wallet, id));
      haptic("medium");
      setMsg(`${u.name} — ${t.shop.acquired}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "…");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="panel shop-panel fade-in">
      <p className="eyebrow">{t.shop.eyebrow}</p>
      <h2 className="panel-title">{t.shop.title}</h2>
      <p className="lede">
        {t.shop.lede} <code className="mono">{TREASURY_OR_KEEPER.slice(0, 10)}…</code>
      </p>

      <div className="upgrade-legend">
        <p>
          <strong>Menù potenziamenti</strong> — ogni carta dice <em>cosa cambia</em> (arma, scudo,
          motore). In partita i drop colorati mostrano il nome dell’effetto.
        </p>
      </div>

      <div className="upgrade-list upgrade-cards">
        {UPGRADES.map((u) => {
          const have = owned.includes(u.id);
          return (
            <div key={u.id} className={`upgrade-card ${have ? "owned" : ""}`}>
              <div className="upgrade-icon">{ICON[u.icon] ?? "◆"}</div>
              <div className="upgrade-body">
                <strong>{u.name}</strong>
                <span className="upgrade-changes">{u.changes}</span>
                <span className="upgrade-blurb">{u.blurb}</span>
              </div>
              <button
                type="button"
                className="neon-btn"
                disabled={have || busy === u.id}
                onClick={() => void buy(u.id)}
              >
                {have ? t.shop.owned : busy === u.id ? "…" : `${u.priceTon} TON`}
              </button>
            </div>
          );
        })}
      </div>
      {msg && <p className="hint">{msg}</p>}
      {!wallet && <p className="hint">{t.shop.connect}</p>}
    </section>
  );
}
