import { useEffect, useRef, useState } from "react";
import { useTonConnectUI } from "@tonconnect/ui-react";
import { TREASURY_OR_KEEPER } from "../config";
import type { AppliedStats } from "../lib/upgrades";
import { ensureAudio, sfxBoom, sfxHit, sfxPower, sfxShoot } from "../lib/audio";
import { useI18n } from "../i18n/I18nContext";
import { haptic } from "../lib/telegram";
import { toNano } from "../lib/ton";
import type { DifficultyId } from "./difficulty";
import { getDifficulty } from "./difficulty";
import type { ShipId } from "./ships";
import { SIEGE_BOMB_PRICE_TON } from "./siegeLevels";
import { NeonSiegeEngine, type GameInput, type GameOverPayload } from "./engine";

type Props = {
  shipId: ShipId;
  stats: AppliedStats;
  difficulty: DifficultyId;
  onExit: () => void;
  onRestart: () => void;
  onGameOver: (p: GameOverPayload) => void;
};

function emptyInput(): GameInput {
  return {
    left: false,
    right: false,
    up: false,
    down: false,
    fire: false,
    pauseToggle: false,
    bomb: false,
    aimX: null,
    aimY: null,
  };
}

export function NeonSiege({ shipId, stats, difficulty, onExit, onRestart, onGameOver }: Props) {
  const { t } = useI18n();
  const [tonConnectUI] = useTonConnectUI();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<NeonSiegeEngine | null>(null);
  const inputRef = useRef<GameInput>(emptyInput());
  const buyingBomb = useRef(false);
  const [hud, setHud] = useState({
    score: 0,
    wave: 1,
    level: 1,
    shields: 0,
    minedAwn: 0,
    bombReady: 0,
    weaponTier: 0,
  });
  const [over, setOver] = useState(false);
  const [bombMsg, setBombMsg] = useState("");
  const [bombBusy, setBombBusy] = useState(false);
  const ended = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    let w = Math.min(420, parent?.clientWidth || 0);
    if (w < 160) w = Math.min(420, window.innerWidth - 28) || 360;
    const h = Math.min(640, Math.floor(w * 1.55));
    canvas.width = w;
    canvas.height = h;

    void ensureAudio();
    const engine = new NeonSiegeEngine(w, h, shipId, stats, difficulty);
    engineRef.current = engine;
    ended.current = false;
    setOver(false);
    setBombMsg("");

    engine.onSfx = (kind) => {
      if (kind === "shoot") sfxShoot();
      if (kind === "hit") sfxHit();
      if (kind === "power") sfxPower();
      if (kind === "boom" || kind === "bomb") sfxBoom();
      if (kind === "awn") sfxPower();
    };
    engine.onGameOver = (p) => {
      if (ended.current) return;
      ended.current = true;
      setOver(true);
      onGameOver(p);
    };
    engine.onBombNeedPurchase = () => {
      void buyAndArmBomb();
    };

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      engine.update(dt, inputRef.current);
      const ctx = canvas.getContext("2d");
      if (ctx) engine.draw(ctx);
      setHud({
        score: engine.score,
        wave: engine.wave,
        level: engine.level,
        shields: Math.max(0, engine.player.shields),
        minedAwn: engine.minedAwn,
        bombReady: engine.bombReady,
        weaponTier: engine.weaponTier,
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onKey = (e: KeyboardEvent, down: boolean) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") inputRef.current.left = down;
      if (e.code === "ArrowRight" || e.code === "KeyD") inputRef.current.right = down;
      if (e.code === "ArrowUp" || e.code === "KeyW") inputRef.current.up = down;
      if (e.code === "ArrowDown" || e.code === "KeyS") inputRef.current.down = down;
      if (e.code === "Space" || e.code === "KeyJ") {
        inputRef.current.fire = down;
        if (down) e.preventDefault();
      }
      if (e.code === "KeyB") {
        inputRef.current.bomb = down;
        if (down) e.preventDefault();
      }
      if (e.code === "KeyP" || e.code === "Escape") {
        inputRef.current.pauseToggle = down;
      }
    };
    const kd = (e: KeyboardEvent) => onKey(e, true);
    const ku = (e: KeyboardEvent) => onKey(e, false);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);

    const canvasPoint = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const sx = canvas.width / rect.width;
      const sy = canvas.height / rect.height;
      return {
        x: (clientX - rect.left) * sx,
        y: (clientY - rect.top) * sy,
      };
    };

    const setAim = (clientX: number, clientY: number) => {
      const p = canvasPoint(clientX, clientY);
      inputRef.current.aimX = p.x;
      inputRef.current.aimY = p.y;
    };
    const clearAim = () => {
      inputRef.current.aimX = null;
      inputRef.current.aimY = null;
    };

    const onPointerDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      setAim(e.clientX, e.clientY);
      e.preventDefault();
    };
    const onPointerMove = (e: PointerEvent) => {
      if (e.buttons === 0 && e.pointerType === "mouse" && !canvas.hasPointerCapture(e.pointerId)) {
        setAim(e.clientX, e.clientY);
        return;
      }
      if (canvas.hasPointerCapture(e.pointerId) || e.buttons > 0) {
        setAim(e.clientX, e.clientY);
      }
    };
    const onPointerUp = (e: PointerEvent) => {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* */
      }
      if (e.pointerType !== "mouse") clearAim();
    };
    const onPointerLeave = () => {
      clearAim();
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerLeave);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerLeave);
    };
    // buyAndArmBomb is stable enough via refs; omit from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipId, stats, difficulty, onGameOver]);

  async function buyAndArmBomb() {
    const engine = engineRef.current;
    if (!engine || buyingBomb.current) return;
    if (engine.bombPurchasedThisMatch || engine.bombUsedThisMatch || engine.bombReady > 0) {
      setBombMsg(t.game.bombAlready);
      return;
    }
    buyingBomb.current = true;
    setBombBusy(true);
    setBombMsg("");
    try {
      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [
          {
            address: TREASURY_OR_KEEPER,
            amount: toNano(SIEGE_BOMB_PRICE_TON).toString(),
          },
        ],
      });
      if (engine.grantPurchasedBomb()) {
        haptic("medium");
        setBombMsg(t.game.bombArmed);
      }
    } catch (e) {
      setBombMsg(e instanceof Error ? e.message : t.game.bombFailed);
    } finally {
      buyingBomb.current = false;
      setBombBusy(false);
    }
  }

  function triggerBomb() {
    const engine = engineRef.current;
    if (!engine) return;
    if (engine.bombReady > 0) {
      inputRef.current.bomb = true;
      setTimeout(() => {
        inputRef.current.bomb = false;
      }, 80);
      return;
    }
    void buyAndArmBomb();
  }

  return (
    <div className="game-shell">
      <div className="game-topbar">
        <button type="button" className="ghost-btn" onClick={onExit}>
          ← Games
        </button>
        <div className="game-title">
          Neon Siege · L{hud.level}/4 · {getDifficulty(difficulty).labelIt}
        </div>
        <button
          type="button"
          className="ghost-btn"
          onClick={() => {
            inputRef.current.pauseToggle = true;
            setTimeout(() => {
              inputRef.current.pauseToggle = false;
            }, 80);
          }}
        >
          Pause
        </button>
      </div>
      <div className="game-canvas-wrap">
        <canvas ref={canvasRef} />
      </div>
      {/* Touch: drag canvas to steer (auto-fire). Bomb only — no D-pad / FIRE. */}
      <div className="game-touch siege-pad siege-pad-bomb">
        <button
          type="button"
          className={`touch-btn bomb ${hud.bombReady > 0 ? "armed" : ""}`}
          disabled={bombBusy || over}
          onPointerDown={(e) => {
            e.preventDefault();
            triggerBomb();
          }}
        >
          {bombBusy
            ? "…"
            : hud.bombReady > 0
              ? t.game.bombDetonate
              : t.game.bombBuy.replace("{ton}", SIEGE_BOMB_PRICE_TON)}
        </button>
      </div>
      {bombMsg && <p className="hint center glow-cyan">{bombMsg}</p>}
      {over && (
        <div className="game-over-actions">
          <button type="button" className="neon-btn buy" onClick={onRestart}>
            {t.game.playAgain}
          </button>
          <button type="button" className="ghost-btn" onClick={onExit}>
            ← Games
          </button>
        </div>
      )}
      <p className="game-hint">
        {t.game.siegeHint} · Score {hud.score} · SH {hud.shields} · T{hud.weaponTier}
        {hud.minedAwn > 0 ? ` · $AWN ${hud.minedAwn}` : ""}
      </p>
    </div>
  );
}
