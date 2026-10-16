import { useEffect, useRef, useState } from "react";
import { ensureAudio, sfxBoom, sfxHit, sfxPower, sfxShoot } from "../../lib/audio";
import { AwnRunEngine, type RunResult } from "./runEngine";
import type { RunPowerId } from "../../lib/gameEconomy";

type Props = {
  powers: RunPowerId[];
  onExit: () => void;
  onOver: (r: RunResult) => void;
};

export function AwnRun({ powers, onExit, onOver }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef({ left: false, right: false, jump: false, fire: false });
  const [hud, setHud] = useState({ gold: 0, mined: 0, score: 0 });
  const ended = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    void ensureAudio();
    const parent = canvas.parentElement;
    // Prefer measured width; never leave a 0×0 canvas (layout not ready yet)
    let w = Math.min(420, parent?.clientWidth || 0);
    if (w < 160) w = Math.min(420, window.innerWidth - 28) || 360;
    const h = Math.min(560, Math.floor(w * 1.35));
    canvas.width = w;
    canvas.height = h;

    const logo = new Image();
    // Start immediately — do NOT block the run loop on logo.onload (404 / slow net = blank forever)
    let engine: AwnRunEngine = new AwnRunEngine(w, h, powers, null);
    ended.current = false;
    engine.onSfx = (k) => {
      if (k === "coin") sfxPower();
      if (k === "awn") sfxShoot();
      if (k === "jump") sfxHit();
      if (k === "hit") sfxHit();
      if (k === "boom") sfxBoom();
    };
    engine.onOver = (r) => {
      if (ended.current) return;
      ended.current = true;
      onOver(r);
    };

    const attachLogo = () => {
      if (logo.naturalWidth > 0) engine.logo = logo;
    };
    logo.onload = attachLogo;
    logo.onerror = () => {
      /* keep null logo — engine draws a fallback face */
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
      setHud({ gold: engine.gold, mined: engine.mined, score: engine.score });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onKey = (e: KeyboardEvent, down: boolean) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") inputRef.current.left = down;
      if (e.code === "ArrowRight" || e.code === "KeyD") inputRef.current.right = down;
      if (e.code === "ArrowUp" || e.code === "Space" || e.code === "KeyW" || e.code === "KeyK") {
        inputRef.current.jump = down;
        if (down) e.preventDefault();
      }
      if (e.code === "KeyJ" || e.code === "KeyF") inputRef.current.fire = down;
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
    };
  }, [powers, onOver]);

  const touch = (k: keyof typeof inputRef.current, down: boolean) => {
    inputRef.current[k] = down;
  };

  return (
    <div className="game-shell">
      <div className="game-topbar">
        <button type="button" className="ghost-btn" onClick={onExit}>
          ← Games
        </button>
        <div className="game-title">AWN Run</div>
        <span className="hint">
          ★{hud.gold} · $AWN{hud.mined}
        </span>
      </div>
      <div className="game-canvas-wrap run-wrap">
        <canvas ref={canvasRef} />
      </div>
      <div className="game-touch run-touch">
        <button
          type="button"
          className="touch-btn"
          onPointerDown={() => touch("left", true)}
          onPointerUp={() => touch("left", false)}
          onPointerLeave={() => touch("left", false)}
        >
          ◀
        </button>
        <button
          type="button"
          className="touch-btn fire"
          onPointerDown={() => touch("jump", true)}
          onPointerUp={() => touch("jump", false)}
          onPointerLeave={() => touch("jump", false)}
        >
          JUMP
        </button>
        <button
          type="button"
          className="touch-btn"
          onPointerDown={() => touch("right", true)}
          onPointerUp={() => touch("right", false)}
          onPointerLeave={() => touch("right", false)}
        >
          ▶
        </button>
        <button
          type="button"
          className="touch-btn fire"
          onPointerDown={() => touch("fire", true)}
          onPointerUp={() => touch("fire", false)}
          onPointerLeave={() => touch("fire", false)}
        >
          FIRE
        </button>
      </div>
      <p className="game-hint">
        Oro = divertimento · Moneta logo $AWN = minato per claim futuro (~14%) · Score {hud.score}
      </p>
    </div>
  );
}
