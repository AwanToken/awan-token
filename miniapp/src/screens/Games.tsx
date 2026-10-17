import { useEffect, useRef, useState } from "react";
import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { TREASURY_OR_KEEPER } from "../config";
import { DIFFICULTIES, type DifficultyId } from "../game/difficulty";
import { SHIPS, drawShip, type ShipId } from "../game/ships";
import { useI18n } from "../i18n/I18nContext";
import { useAppStatus } from "../lib/appStatus";
import { MINED_CLAIM_THRESHOLD } from "../config";
import {
  RUN_POWERS,
  buyPower,
  canClaimMined,
  claimMinedToPool,
  ensureStarterGrant,
  getMinedPending,
  getPowerCostAwn,
  hasUsedFirstAwnPowerToday,
  loadEco,
  type RunPowerId,
} from "../lib/gameEconomy";
import {
  RUN_LIFE_PRICE_TON,
  canBuyRunLife,
  grantPurchasedRunLife,
  loadRunLives,
  purchasesLeftToday,
} from "../lib/runLives";
import { haptic } from "../lib/telegram";
import { toNano } from "../lib/ton";
import { UPGRADES, loadOwned, markOwned, type UpgradeId } from "../lib/upgrades";
import { RUN_LEVELS } from "../game/run/runLevels";
import { drawAwnHero } from "../game/run/awnHeroArt";

const UPGRADE_ICON: Record<string, string> = {
  gun: "⚔",
  shield: "🛡",
  speed: "🚀",
  missile: "🚀",
  rail: "⚡",
};

/** Highest-tier craft in the roster (last entry / Iron Falcon). */
const BEST_SHIP = SHIPS[SHIPS.length - 1]!;

/** Shared presentation tile size for both game picks. */
const GP_ART = 112;

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

/** Animated Neon Siege craft for the hub card (same tile size as RunAwan). */
function SiegeHeroIcon() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const t0 = performance.now();
    const paint = (now: number) => {
      const t = (now - t0) / 1000;
      const { width: w, height: h } = c;
      ctx.clearRect(0, 0, w, h);
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
      const bg = ctx.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w * 0.58);
      bg.addColorStop(0, `rgba(125,249,255,${0.28 + pulse * 0.18})`);
      bg.addColorStop(0.45, "rgba(255,43,214,0.2)");
      bg.addColorStop(1, "rgba(8,2,18,0.92)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      // soft engine trail
      ctx.fillStyle = `rgba(125,249,255,${0.12 + pulse * 0.2})`;
      ctx.beginPath();
      ctx.ellipse(w / 2, h * 0.78, 18 + pulse * 6, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      const bob = Math.sin(t * 3) * 3;
      drawShip(ctx, BEST_SHIP, w / 2, h / 2 + 2 + bob, 2.9, "up");
      raf = requestAnimationFrame(paint);
    };
    raf = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <canvas
      ref={ref}
      width={GP_ART}
      height={GP_ART}
      className="gp-game-art"
      aria-hidden
    />
  );
}

/** Animated RunAwan hero (logo-man vibe) — no circular logo badge. */
function RunHeroIcon({ className = "gp-game-art" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const t0 = performance.now();
    const paint = (now: number) => {
      drawAwnHero(ctx, c.width, c.height, { t: (now - t0) / 1000, faces: 1 });
      raf = requestAnimationFrame(paint);
    };
    raf = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <canvas ref={ref} width={GP_ART} height={GP_ART} className={className} aria-hidden />
  );
}

function EcoWalletStrip({
  spendable,
  gold,
  mined,
  wallet,
  onClaimed,
}: {
  spendable: number;
  gold: number;
  mined: number;
  wallet: string | null;
  onClaimed?: () => void;
}) {
  const { t } = useI18n();
  const [claimMsg, setClaimMsg] = useState("");
  const ready = canClaimMined(wallet);
  const progress = Math.min(100, Math.round((mined / MINED_CLAIM_THRESHOLD) * 100));

  function onClaimMined() {
    const r = claimMinedToPool(wallet);
    if (!r.ok) {
      setClaimMsg(
        r.error === "wallet_required"
          ? t.games.claimNeedWallet
          : t.games.claimNeedMore.replace("{n}", String(MINED_CLAIM_THRESHOLD)),
      );
      return;
    }
    setClaimMsg(
      t.games.claimQueued.replace("{amount}", String(r.queued)),
    );
    haptic("medium");
    onClaimed?.();
  }

  return (
    <div className="eco-wallet-panel">
      <p className="eco-wallet-title">{t.games.tokenMenu}</p>
      <div className="eco-strip">
        <span>
          {t.games.spendable}: <strong>{spendable}</strong>
        </span>
        <span>
          {t.games.minedPending}: <strong>{mined}</strong>
          <em className="eco-threshold">
            {" "}
            / {MINED_CLAIM_THRESHOLD}
          </em>
        </span>
        <span>
          {t.games.gold}: <strong>{gold}</strong>
        </span>
      </div>
      <div
        className="eco-claim-progress"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="eco-claim-bar" style={{ width: `${progress}%` }} />
      </div>
      <p className="hint">{t.games.minedPendingHint}</p>
      <button
        type="button"
        className="neon-btn buy eco-claim-btn"
        disabled={!wallet || !ready}
        onClick={onClaimMined}
      >
        {!wallet
          ? t.games.claimNeedWallet
          : ready
            ? t.games.claimMined
            : t.games.claimNeedMore.replace("{n}", String(MINED_CLAIM_THRESHOLD))}
      </button>
      {ready && wallet && <p className="hint">{t.games.ownerSettle}</p>}
      <p className="hint">{t.games.economyHint}</p>
      {claimMsg && <p className="hint glow-cyan">{claimMsg}</p>}
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
  const [livesState, setLivesState] = useState(() => loadRunLives(wallet));
  const [msg, setMsg] = useState("");
  const [owned, setOwned] = useState<UpgradeId[]>(() => loadOwned(wallet));
  const [busyUpgrade, setBusyUpgrade] = useState<UpgradeId | null>(null);
  const [busyLife, setBusyLife] = useState(false);
  const { isSiegeComing, isRunComing } = useAppStatus();

  useEffect(() => {
    setEco(ensureStarterGrant(wallet));
    setOwned(loadOwned(wallet));
    setLivesState(loadRunLives(wallet));
  }, [wallet, ecoTick]);

  function refreshEco() {
    setEco(loadEco(wallet));
    setLivesState(loadRunLives(wallet));
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

  async function buyRunLife() {
    if (!wallet) {
      await tonConnectUI.openModal();
      return;
    }
    if (!canBuyRunLife(wallet)) {
      setMsg(t.games.livesDailyCap);
      return;
    }
    setBusyLife(true);
    setMsg("");
    try {
      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [
          {
            address: TREASURY_OR_KEEPER,
            amount: toNano(RUN_LIFE_PRICE_TON).toString(),
          },
        ],
      });
      const r = grantPurchasedRunLife(wallet);
      if (!r.ok) {
        setMsg(t.games.livesDailyCap);
        return;
      }
      setLivesState(r.state);
      haptic("medium");
      setMsg(t.games.livesBought);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "…");
    } finally {
      setBusyLife(false);
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
          wallet={wallet}
          onClaimed={refreshEco}
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
            <div className="gp-copy">
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
          <div className="gp-art-row">
            <RunHeroIcon />
            <div className="gp-copy">
              <span className="gp-title">RunAwan</span>
              <span className="gp-sub">{t.games.runSub}</span>
              <span className="gp-ship-tag">Boss · Fiore di fuoco</span>
            </div>
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
          wallet={wallet}
          onClaimed={refreshEco}
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
        <RunHeroIcon className="run-hero-art" />
        <div>
          <h2 className="panel-title">RunAwan</h2>
          <p className="lede">{t.games.runLede}</p>
        </div>
      </div>

      <EcoWalletStrip
        spendable={loadEco(wallet).spendableAwn}
        gold={eco.goldCoins}
        mined={getMinedPending(wallet)}
        wallet={wallet}
        onClaimed={refreshEco}
      />
      <p className="hint">{t.games.starterHint}</p>
      <p className="hint">{t.games.runLevelsHint}</p>

      <div className="run-levels-strip" aria-hidden>
        {RUN_LEVELS.map((lv) => (
          <span key={lv.id} className="run-level-chip" style={{ borderColor: lv.accent }}>
            L{lv.id} {lv.boss.nameIt}
          </span>
        ))}
      </div>

      <h3 className="sub-title">{t.games.livesShop}</h3>
      <p className="hint">{t.games.livesLede}</p>
      <div className="run-lives-row">
        <span className="run-lives-count">
          {t.games.livesLabel}: <strong>{livesState.lives}</strong>
          <em>
            {" "}
            · {purchasesLeftToday(wallet)}/10
          </em>
        </span>
        <button
          type="button"
          className="neon-btn"
          disabled={busyLife || !canBuyRunLife(wallet)}
          onClick={() => void buyRunLife()}
        >
          {busyLife ? "…" : t.games.livesBuy}
        </button>
      </div>

      <h3 className="sub-title">{t.games.powerShop}</h3>
      <p className="hint">{t.games.powerPickupHint}</p>
      {!hasUsedFirstAwnPowerToday(wallet) && (
        <p className="hint glow-cyan">{t.games.firstPowerHint}</p>
      )}
      <div className="upgrade-cards">
        {RUN_POWERS.map((p) => {
          const have = eco.powers.includes(p.id);
          const cost = getPowerCostAwn(wallet, p.id);
          return (
            <div key={p.id} className={`upgrade-card ${have ? "owned" : ""}`}>
              <div className="upgrade-icon">
                {p.id === "mushroom"
                  ? "🍄"
                  : p.id === "fire_flower"
                    ? "🔥"
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
                {have ? "OK" : `${cost} $AWN`}
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
          disabled={isRunComing || livesState.lives < 1}
          onClick={() => {
            if (isRunComing) return;
            if (livesState.lives < 1) {
              setMsg(t.games.livesNone);
              return;
            }
            onLaunchRun();
          }}
        >
          {isRunComing
            ? t.games.comingSoonBadge
            : livesState.lives < 1
              ? t.games.livesNeedBuy
              : t.games.playRun}
        </button>
      </div>

    </section>
  );
}
