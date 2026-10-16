import { useEffect, useRef, useState } from "react";
import type { AppliedStats } from "../lib/upgrades";
import { ensureAudio, sfxBoom, sfxHit, sfxPower, sfxShoot } from "../lib/audio";
import type { DifficultyId } from "./difficulty";
import { getDifficulty } from "./difficulty";
import type { ShipId } from "./ships";
import { NeonSiegeEngine, type GameInput, type GameOverPayload } from "./engine";

type Props = {
  shipId: ShipId;
  stats: AppliedStats;
  difficulty: DifficultyId;
  onExit: () => void;
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
    aimX: null,
    aimY: null,
  };
}

export function NeonSiege({ shipId, stats, difficulty, onExit, onGameOver }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<NeonSiegeEngine | null>(null);
  const inputRef = useRef<GameInput>(emptyInput());
  const [hud, setHud] = useState({ score: 0, wave: 1, shields: 0, minedAwn: 0 });
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
    engine.onSfx = (kind) => {
      if (kind === "shoot") sfxShoot();
      if (kind === "hit") sfxHit();
      if (kind === "power") sfxPower();
      if (kind === "boom") sfxBoom();
      if (kind === "awn") sfxPower();
    };
    engine.onGameOver = (p) => {
      if (ended.current) return;
      ended.current = true;
      onGameOver(p);
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
        shields: Math.max(0, engine.player.shields),
        minedAwn: engine.minedAwn,
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
        // Hover aim on desktop (no button) for fluid mouse steering
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
  }, [shipId, stats, difficulty, onGameOver]);

  const setDir = (key: "left" | "right" | "up" | "down" | "fire", down: boolean) => {
    inputRef.current[key] = down;
  };

  return (
    <div className="game-shell">
      <div className="game-topbar">
        <button type="button" className="ghost-btn" onClick={onExit}>
          ← Games
        </button>
        <div className="game-title">
          Neon Siege · {getDifficulty(difficulty).labelIt}
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
      <div className="game-touch siege-pad">
        <div className="dpad" aria-label="Move">
          <button
            type="button"
            className="touch-btn dpad-up"
            onPointerDown={() => setDir("up", true)}
            onPointerUp={() => setDir("up", false)}
            onPointerLeave={() => setDir("up", false)}
          >
            ▲
          </button>
          <button
            type="button"
            className="touch-btn dpad-left"
            onPointerDown={() => setDir("left", true)}
            onPointerUp={() => setDir("left", false)}
            onPointerLeave={() => setDir("left", false)}
          >
            ◀
          </button>
          <button
            type="button"
            className="touch-btn dpad-right"
            onPointerDown={() => setDir("right", true)}
            onPointerUp={() => setDir("right", false)}
            onPointerLeave={() => setDir("right", false)}
          >
            ▶
          </button>
          <button
            type="button"
            className="touch-btn dpad-down"
            onPointerDown={() => setDir("down", true)}
            onPointerUp={() => setDir("down", false)}
            onPointerLeave={() => setDir("down", false)}
          >
            ▼
          </button>
        </div>
        <button
          type="button"
          className="touch-btn fire"
          onPointerDown={() => setDir("fire", true)}
          onPointerUp={() => setDir("fire", false)}
          onPointerLeave={() => setDir("fire", false)}
        >
          FIRE
        </button>
      </div>
      <p className="game-hint">
        Mouse/touch sul canvas · WASD / frecce (anche diagonali) · Space fire · P pause · Score{" "}
        {hud.score} · Shields {hud.shields}
        {hud.minedAwn > 0 ? ` · Mined $AWN ${hud.minedAwn}` : ""}
      </p>
    </div>
  );
}
