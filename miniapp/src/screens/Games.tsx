import { useEffect, useRef, useState } from "react";
import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { TREASURY_OR_KEEPER } from "../config";
import { DIFFICULTIES, type DifficultyId } from "../game/difficulty";
import { SHIPS, drawShip, type ShipId } from "../game/ships";
import { useI18n } from "../i18n/I18nContext";
import { useAppStatus } from "../lib/appStatus";
import {
  RUN_POWERS,
  buyPower,
  ensureStarterGrant,
  getMinedPending,
  loadEco,
  type RunPowerId,
} from "../lib/gameEconomy";
import { haptic } from "../lib/telegram";
import { toNano } from "../lib/ton";
import { UPGRADES, loadOwned, markOwned, type UpgradeId } from "../lib/upgrades";

const UPGRADE_ICON: Record<string, string> = {
  gun: "⚔",
  shield: "🛡",
  speed: "🚀",
  missile: "🚀",
  rail: "⚡",
};

/** Highest-tier craft in the roster (last entry / Iron Falcon). */
const BEST_SHIP = SHIPS[SHIPS.length - 1]!;

type Props = {
  selected: ShipId;
  onSelect: (id: ShipId) => void;
  difficulty: DifficultyId;
  onDifficulty: (d: DifficultyId) => void;
  onLaunchSiege: () => void;
  onLaunchRun: () => void;
  onOpenRoadmap: () => void;
  ecoTick: number;
};

function ShipPreview({ id, active }: { id: ShipId; active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const ship = SHIPS.find((s) => s.id === id)!;
    ctx.clearRect(0, 0, c.width, c.height);
    const g = ctx.createRadialGradient(48, 48, 4, 48, 48, 44);
    g.addColorStop(0, "rgba(255,43,214,0.28)");
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 96, 96);
    drawShip(ctx, ship, 48, 50, active ? 1.55 : 1.35, "up");
  }, [id, active]);
  return <canvas ref={ref} width={96} height={96} className="ship-preview" />;
}

/** Large hero art of the best aircraft for the Neon Siege game card. */
function SiegeHeroIcon() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const { width: w, height: h } = c;
    ctx.clearRect(0, 0, w, h);
    const bg = ctx.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w * 0.55);
    bg.addColorStop(0, "rgba(125,249,255,0.35)");
    bg.addColorStop(0.45, "rgba(255,43,214,0.18)");
    bg.addColorStop(1, "rgba(8,2,18,0.9)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    drawShip(ctx, BEST_SHIP, w / 2, h / 2 + 4, 2.85, "up");
  }, []);
  return (
    <canvas
      ref={ref}
      width={112}
      height={112}
      className="gp-siege-art"
      aria-hidden
    />
  );
}

function EcoWalletStrip({
  spendable,
  gold,
  mined,
}: {
  spendable: number;
  gold: number;
  mined: number;
}) {
  const { t } = useI18n();
  return (
    <div className="eco-wallet-panel">
      <p className="eco-wallet-title">{t.games.tokenMenu}</p>
      <div className="eco-strip">
        <span>
          {t.games.spendable}: <strong>{spendable}</strong>
        </span>
        <span>
          {t.games.minedPending}: <strong>{mined}</strong>
        </span>
        <span>
          {t.games.gold}: <strong>{gold}</strong>
        </span>
      </div>
      <p className="hint">{t.games.economyHint}</p>
    </div>
  );
}

export function GamesScreen({
  selected,
  onSelect,
  difficulty,
  onDifficulty,
  onLaunchSiege,
  onLaunchRun,
  onOpenRoadmap,
  ecoTick,
}: Props) {
  const { t } = useI18n();
  const wallet = useTonAddress();
  const [tonConnectUI] = useTonConnectUI();
  const [mode, setMode] = useState<"hub" | "siege" | "run">("hub");
  const [eco, setEco] = useState(() => ensureStarterGrant(wallet));
  const [msg, setMsg] = useState("");
  const [owned, setOwned] = useState<UpgradeId[]>(() => loadOwned(wallet));
  const [busyUpgrade, setBusyUpgrade] = useState<UpgradeId | null>(null);
  const { isSiegeComing, isRunComing } = useAppStatus();

  useEffect(() => {
    setEco(ensureStarterGrant(wallet));
    setOwned(loadOwned(wallet));
  }, [wallet, ecoTick]);

  function refreshEco() {
    setEco(loadEco(wallet));
  }

  function buy(id: RunPowerId) {
    const r = buyPower(wallet, id);
    if ("error" in r) {
      setMsg(r.error);
      return;
    }
    setEco(r);
    setMsg("OK");
  }

  async function buySiegeUpgrade(id: UpgradeId) {
    if (!wallet) {
      await tonConnectUI.openModal();
      return;
    }
    if (owned.includes(id)) return;
    const u = UPGRADES.find((x) => x.id === id)!;
    setBusyUpgrade(id);
    setMsg("");
    try {
      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [
          { address: TREASURY_OR_KEEPER, amount: toNano(u.priceTon).toString() },
        ],
      });
      setOwned(markOwned(wallet, id));
      haptic("medium");
      setMsg(`${u.name} — ${t.shop.acquired}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "…");
    } finally {
      setBusyUpgrade(null);
    }
  }

  if (mode === "hub") {
    return (
      <section className="panel games-hub fade-in">
        <p className="eyebrow">{t.games.eyebrow}</p>
        <h2 className="panel-title">{t.games.title}</h2>
        <p className="lede">{t.games.lede}</p>

        <EcoWalletStrip
          spendable={eco.spendableAwn}
          gold={eco.goldCoins}
          mined={eco.minedAwn}
        />

        <button
          type="button"
          className={`game-pick siege${isSiegeComing ? " coming" : ""}`}
          disabled={isSiegeComing}
          onClick={() => {
            if (!isSiegeComing) setMode("siege");
          }}
        >
          {isSiegeComing && (
            <span className="coming-badge">{t.games.comingSoonBadge}</span>
          )}
          <div className="gp-art-row">
            <SiegeHeroIcon />
            <div>
              <span className="gp-title">AWN: Neon Siege</span>
              <span className="gp-sub">{t.games.siegeSub}</span>
              <span className="gp-ship-tag">
                {BEST_SHIP.name} · SH {BEST_SHIP.baseShields}
              </span>
            </div>
          </div>
        </button>

        <button
          type="button"
          className={`game-pick run${isRunComing ? " coming" : ""}`}
          disabled={isRunComing}
          onClick={() => {
            if (!isRunComing) setMode("run");
          }}
        >
          {isRunComing && (
            <span className="coming-badge">{t.games.comingSoonBadge}</span>
          )}
          <img src="/awn-logo.png" alt="" className="gp-logo" />
          <div>
            <span className="gp-title">AWN Run</span>
            <span className="gp-sub">{t.games.runSub}</span>
          </div>
        </button>

        <button type="button" className="neon-btn roadmap-cta" onClick={onOpenRoadmap}>
          {t.roadmap.openFromGames}
        </button>
      </section>
    );
  }

  if (mode === "siege") {
    return (
      <section className="panel hangar-panel fade-in">
        <button type="button" className="ghost-btn" onClick={() => setMode("hub")}>
          ← {t.games.title}
        </button>
        <p className="eyebrow">{t.hangar.eyebrow}</p>
        <h2 className="panel-title">Neon Siege</h2>
        <p className="lede">{t.hangar.lede}</p>
        <p className="hint">{t.hangar.awnHint}</p>

        <EcoWalletStrip
          spendable={eco.spendableAwn}
          gold={eco.goldCoins}
          mined={getMinedPending(wallet)}
        />

        <div className="diff-block">
          <p className="diff-title">{t.hangar.title}</p>
          <div className="diff-row">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.id}
                type="button"
                className={`diff-btn ${difficulty === d.id ? "active" : ""}`}
                onClick={() => onDifficulty(d.id)}
              >
                <strong>{d.labelIt}</strong>
                <span>{d.blurb}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="ship-grid ship-grid-wide">
          {SHIPS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`ship-card ${selected === s.id ? "active" : ""}`}
              onClick={() => onSelect(s.id)}
            >
              <ShipPreview id={s.id} active={selected === s.id} />
              <div>
                <strong>{s.name}</strong>
                <span>{s.tagline}</span>
                <em className="weapon-chip">{s.weaponLabel}</em>
                <small>
                  FR {s.baseFireMs}ms · DMG {s.baseDamage} · SPD {s.baseSpeed} · SH{" "}
                  {s.baseShields}
                </small>
              </div>
            </button>
          ))}
        </div>

        <h3 className="sub-title">{t.games.siegeUpgrades}</h3>
        <p className="hint">{t.shop.lede}</p>
        <div className="upgrade-cards">
          {UPGRADES.map((u) => {
            const have = owned.includes(u.id);
            return (
              <div key={u.id} className={`upgrade-card ${have ? "owned" : ""}`}>
                <div className="upgrade-icon">{UPGRADE_ICON[u.icon] ?? "◆"}</div>
                <div className="upgrade-body">
                  <strong>{u.name}</strong>
                  <span className="upgrade-changes">{u.changes}</span>
                  <span className="upgrade-blurb">{u.blurb}</span>
                </div>
                <button
                  type="button"
                  className="neon-btn"
                  disabled={have || busyUpgrade === u.id}
                  onClick={() => void buySiegeUpgrade(u.id)}
                >
                  {have
                    ? t.shop.owned
                    : busyUpgrade === u.id
                      ? "…"
                      : `${u.priceTon} TON`}
                </button>
              </div>
            );
          })}
        </div>
        {msg && mode === "siege" && <p className="hint">{msg}</p>}
        {!wallet && <p className="hint">{t.shop.connect}</p>}

        <div className="launch-dock">
          <button
            type="button"
            className="neon-btn buy launch-btn"
            disabled={isSiegeComing}
            onClick={() => {
              if (!isSiegeComing) onLaunchSiege();
            }}
          >
            {isSiegeComing ? t.games.comingSoonBadge : t.hangar.launch}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="panel run-lobby fade-in">
      <button type="button" className="ghost-btn" onClick={() => setMode("hub")}>
        ← {t.games.title}
      </button>
      <div className="run-hero">
        <img src="/awn-logo.png" alt="$AWN" className="run-hero-logo" />
        <div>
          <h2 className="panel-title">AWN Run</h2>
          <p className="lede">{t.games.runLede}</p>
        </div>
      </div>

      <EcoWalletStrip
        spendable={loadEco(wallet).spendableAwn}
        gold={eco.goldCoins}
        mined={getMinedPending(wallet)}
      />
      <p className="hint">{t.games.starterHint}</p>

      <h3 className="sub-title">{t.games.powerShop}</h3>
      <div className="upgrade-cards">
        {RUN_POWERS.map((p) => {
          const have = eco.powers.includes(p.id);
          return (
            <div key={p.id} className={`upgrade-card ${have ? "owned" : ""}`}>
              <div className="upgrade-icon">
                {p.id === "mushroom"
                  ? "🍄"
                  : p.id === "fire_flower"
                    ? "🌸"
                    : p.id === "star"
                      ? "⭐"
                      : "🍃"}
              </div>
              <div className="upgrade-body">
                <strong>{p.name}</strong>
                <span className="upgrade-changes">{p.effect}</span>
                <span className="upgrade-blurb">{p.blurb}</span>
              </div>
              <button
                type="button"
                className="neon-btn"
                disabled={have}
                onClick={() => buy(p.id)}
              >
                {have ? "OK" : `${p.costAwn} $AWN`}
              </button>
            </div>
          );
        })}
      </div>
      {msg && <p className="hint">{msg}</p>}

      <div className="launch-dock">
        <button
          type="button"
          className="neon-btn buy launch-btn"
          disabled={isRunComing}
          onClick={() => {
            if (!isRunComing) onLaunchRun();
          }}
        >
          {isRunComing ? t.games.comingSoonBadge : t.games.playRun}
        </button>
      </div>

    </section>
  );
}
