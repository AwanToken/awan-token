import { useEffect, useRef, useState } from "react";
import { useTonConnectUI } from "@tonconnect/ui-react";
import { TREASURY_OR_KEEPER } from "../../config";
import { ensureAudio, sfxBoom, sfxHit, sfxPower, sfxShoot } from "../../lib/audio";
import { useI18n } from "../../i18n/I18nContext";
import {
  RUN_POWERS,
  buyPowerInRun,
  getPowerCostAwn,
  grantPowerFromTon,
  loadEco,
  type RunPowerId,
} from "../../lib/gameEconomy";
import { getRunLives } from "../../lib/runLives";
import { haptic } from "../../lib/telegram";
import { toNano } from "../../lib/ton";
import { RUN_PAUSE_POWER_PRICE_TON } from "./runLevels";
import { AwnRunEngine, type RunResult } from "./runEngine";
import { getRunLevel } from "./runLevels";

type Props = {
  powers: RunPowerId[];
  wallet: string | null;
  onExit: () => void;
  onRestart: () => void;
  onOver: (r: RunResult) => void;
  /** Notify parent that owned powers changed mid-run. */
  onPowersChange?: (powers: RunPowerId[]) => void;
};

type InputState = {
  left: boolean;
  right: boolean;
  down: boolean;
  jump: boolean;
  action: boolean;
};

const POWER_ICON: Record<RunPowerId, string> = {
  mushroom: "🍄",
  fire_flower: "🔥",
  star: "⭐",
  leaf: "🍃",
};

export function AwnRun({ powers, wallet, onExit, onRestart, onOver, onPowersChange }: Props) {
  const { t, lang } = useI18n();
  const [tonConnectUI] = useTonConnectUI();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<AwnRunEngine | null>(null);
  const inputRef = useRef<InputState>({
    left: false,
    right: false,
    down: false,
    jump: false,
    action: false,
  });
  const [hud, setHud] = useState({
    gold: 0,
    mined: 0,
    score: 0,
    level: 1,
    levelName: getRunLevel(1).name,
    hasFire: false,
    hasLeaf: false,
    inBoss: false,
    hp: 1,
  });
  const [over, setOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [lives, setLives] = useState(() => getRunLives(wallet));
  const [spendable, setSpendable] = useState(() => loadEco(wallet).spendableAwn);
  const [owned, setOwned] = useState<RunPowerId[]>(() => [...powers]);
  const [shopMsg, setShopMsg] = useState("");
  const [busyTon, setBusyTon] = useState<RunPowerId | null>(null);
  const ended = useRef(false);

  useEffect(() => {
    setLives(getRunLives(wallet));
    setSpendable(loadEco(wallet).spendableAwn);
  }, [wallet, over]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    void ensureAudio();
    const parent = canvas.parentElement;
    let w = Math.min(420, parent?.clientWidth || 0);
    if (w < 160) w = Math.min(420, window.innerWidth - 28) || 360;
    const h = Math.min(560, Math.floor(w * 1.35));
    canvas.width = w;
    canvas.height = h;

    const logo = new Image();
    const engine = new AwnRunEngine(w, h, powers, null);
    engineRef.current = engine;
    ended.current = false;
    setOver(false);
    setPaused(false);
    setOwned([...powers]);
    engine.onSfx = (k) => {
      if (k === "coin" || k === "power") sfxPower();
      if (k === "awn") sfxShoot();
      if (k === "jump" || k === "break") sfxHit();
      if (k === "hit") sfxHit();
      if (k === "boom") sfxBoom();
    };
    engine.onOver = (r) => {
      if (ended.current) return;
      ended.current = true;
      setOver(true);
      setPaused(false);
      onOver(r);
    };

    const attachLogo = () => {
      if (logo.naturalWidth > 0) engine.logo = logo;
    };
    logo.onload = attachLogo;
    logo.onerror = () => {
      /* fallback face */
    };
    logo.src = "/awn-logo.png";
    if (logo.complete) attachLogo();

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      engine.update(dt, inputRef.current);
      const ctx = canvas.getContext("2d");
      if (ctx) engine.draw(ctx);
      const lv = engine.levelDef();
      setHud({
        gold: engine.gold,
        mined: engine.mined,
        score: engine.score,
        level: engine.level,
        levelName: lang === "it" ? lv.nameIt : lv.name,
        hasFire: engine.hasFire(),
        hasLeaf: engine.hasLeaf(),
        inBoss: engine.inBoss,
        hp: engine.player.hp,
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onKey = (e: KeyboardEvent, down: boolean) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") inputRef.current.left = down;
      if (e.code === "ArrowRight" || e.code === "KeyD") inputRef.current.right = down;
      if (e.code === "ArrowDown" || e.code === "KeyS") inputRef.current.down = down;
      if (e.code === "ArrowUp" || e.code === "Space" || e.code === "KeyW" || e.code === "KeyK") {
        inputRef.current.jump = down;
        if (down) e.preventDefault();
      }
      if (e.code === "KeyJ" || e.code === "KeyF") inputRef.current.action = down;
      if (down && e.code === "Escape" && !engine.over) {
        togglePause();
      }
    };
    const kd = (e: KeyboardEvent) => onKey(e, true);
    const ku = (e: KeyboardEvent) => onKey(e, false);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      logo.onload = null;
      logo.onerror = null;
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restart via key/powers
  }, [powers, onOver, lang]);

  function togglePause() {
    const eng = engineRef.current;
    if (!eng || eng.over) return;
    const next = !eng.paused;
    eng.setPaused(next);
    setPaused(next);
    if (next) {
      setSpendable(loadEco(wallet).spendableAwn);
      setShopMsg("");
      // clear sticky touch
      inputRef.current = { left: false, right: false, down: false, jump: false, action: false };
    }
  }

  const touch = (k: keyof InputState, down: boolean) => {
    if (paused) return;
    inputRef.current[k] = down;
  };

  function buyAwn(id: RunPowerId) {
    const r = buyPowerInRun(wallet, id);
    if ("error" in r) {
      setShopMsg(r.error);
      return;
    }
    setSpendable(r.spendableAwn);
    setOwned([...r.powers]);
    engineRef.current?.grantPower(id);
    onPowersChange?.(r.powers);
    setShopMsg(t.games.runShopBought);
    haptic("medium");
  }

  async function buyTon(id: RunPowerId) {
    if (!wallet) {
      await tonConnectUI.openModal();
      return;
    }
    setBusyTon(id);
    setShopMsg("");
    try {
      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [
          {
            address: TREASURY_OR_KEEPER,
            amount: toNano(RUN_PAUSE_POWER_PRICE_TON).toString(),
          },
        ],
      });
      const eco = grantPowerFromTon(wallet, id);
      setOwned([...eco.powers]);
      setSpendable(eco.spendableAwn);
      engineRef.current?.grantPower(id);
      onPowersChange?.(eco.powers);
      setShopMsg(t.games.runShopBoughtTon);
      haptic("medium");
    } catch (e) {
      setShopMsg(e instanceof Error ? e.message : "…");
    } finally {
      setBusyTon(null);
    }
  }

  const actionLabel = hud.hasFire ? t.games.runBtnFire : hud.hasLeaf ? t.games.runBtnLeaf : t.games.runBtnPower;

  return (
    <div className="game-shell run-shell">
      <div className="game-topbar">
        <button type="button" className="ghost-btn" onClick={onExit}>
          ← {t.games.title}
        </button>
        <div className="game-title">RunAwan</div>
        <button type="button" className="ghost-btn run-pause-btn" onClick={togglePause}>
          {paused ? t.games.runResume : t.games.runPause}
        </button>
      </div>

      <div className="game-canvas-wrap run-wrap">
        <canvas ref={canvasRef} />

        {!over && (
          <div className="run-hud-overlay" aria-hidden={paused}>
            <div className="run-joypad">
              <button
                type="button"
                className="run-pad-btn"
                onPointerDown={(e) => {
                  e.preventDefault();
                  touch("left", true);
                }}
                onPointerUp={() => touch("left", false)}
                onPointerCancel={() => touch("left", false)}
                onPointerLeave={() => touch("left", false)}
              >
                ◀
              </button>
              <div className="run-pad-mid">
                <button
                  type="button"
                  className="run-pad-btn run-pad-down"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    touch("down", true);
                  }}
                  onPointerUp={() => touch("down", false)}
                  onPointerCancel={() => touch("down", false)}
                  onPointerLeave={() => touch("down", false)}
                >
                  ▼
                </button>
              </div>
              <button
                type="button"
                className="run-pad-btn"
                onPointerDown={(e) => {
                  e.preventDefault();
                  touch("right", true);
                }}
                onPointerUp={() => touch("right", false)}
                onPointerCancel={() => touch("right", false)}
                onPointerLeave={() => touch("right", false)}
              >
                ▶
              </button>
            </div>

            <div className="run-action-pad">
              <button
                type="button"
                className="run-pad-btn run-pad-jump"
                onPointerDown={(e) => {
                  e.preventDefault();
                  touch("jump", true);
                }}
                onPointerUp={() => touch("jump", false)}
                onPointerCancel={() => touch("jump", false)}
                onPointerLeave={() => touch("jump", false)}
              >
                {t.games.runBtnJump}
              </button>
              <button
                type="button"
                className={`run-pad-btn run-pad-power${hud.hasFire ? " lit" : ""}`}
                onPointerDown={(e) => {
                  e.preventDefault();
                  touch("action", true);
                }}
                onPointerUp={() => touch("action", false)}
                onPointerCancel={() => touch("action", false)}
                onPointerLeave={() => touch("action", false)}
              >
                {actionLabel}
              </button>
            </div>
          </div>
        )}

        {paused && !over && (
          <div className="run-pause-overlay">
            <div className="run-pause-card">
              <h3>{t.games.runPauseTitle}</h3>
              {hud.inBoss && !hud.hasFire && (
                <p className="run-pause-warn">{t.games.runBossNeedFire}</p>
              )}

              <div className="run-shop-block">
                <p className="run-shop-label">{t.games.runShopAwn}</p>
                <p className="hint">
                  {t.games.runShopAwnHint} · {t.games.spendable}: <strong>{spendable}</strong>
                </p>
                <div className="run-shop-grid">
                  {RUN_POWERS.map((p) => {
                    const have = owned.includes(p.id);
                    const cost = getPowerCostAwn(wallet, p.id);
                    return (
                      <button
                        key={`awn-${p.id}`}
                        type="button"
                        className="run-shop-item"
                        disabled={have}
                        onClick={() => buyAwn(p.id)}
                      >
                        <span>{POWER_ICON[p.id]}</span>
                        <strong>{p.name}</strong>
                        <em>{have ? "OK" : `${cost} $AWN`}</em>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="run-shop-block ton">
                <p className="run-shop-label">{t.games.runShopTon}</p>
                <p className="hint">{t.games.runShopTonHint}</p>
                <div className="run-shop-grid">
                  {RUN_POWERS.map((p) => {
                    const have = owned.includes(p.id);
                    return (
                      <button
                        key={`ton-${p.id}`}
                        type="button"
                        className="run-shop-item ton"
                        disabled={busyTon === p.id}
                        onClick={() => void buyTon(p.id)}
                      >
                        <span>{POWER_ICON[p.id]}</span>
                        <strong>{p.name}</strong>
                        <em>
                          {busyTon === p.id
                            ? "…"
                            : have
                              ? `+1 · ${RUN_PAUSE_POWER_PRICE_TON} TON`
                              : `${RUN_PAUSE_POWER_PRICE_TON} TON`}
                        </em>
                      </button>
                    );
                  })}
                </div>
              </div>

              {shopMsg && <p className="hint glow-cyan">{shopMsg}</p>}

              <button type="button" className="neon-btn buy" onClick={togglePause}>
                {t.games.runResume}
              </button>
            </div>
          </div>
        )}
      </div>

      {over && (
        <div className="game-over-actions">
          <button
            type="button"
            className="neon-btn buy"
            disabled={lives < 1}
            onClick={onRestart}
          >
            {lives < 1 ? t.games.livesNeedBuy : t.game.playAgain}
          </button>
          <button type="button" className="ghost-btn" onClick={onExit}>
            ← {t.games.title}
          </button>
        </div>
      )}
      <p className="game-hint">
        L{hud.level}/4 {hud.levelName} · HP {hud.hp} · {t.games.runHintScore} {hud.score} ·{" "}
        {t.games.livesLabel} {lives}
        {hud.inBoss ? ` · BOSS` : ""}
      </p>
    </div>
  );
}
