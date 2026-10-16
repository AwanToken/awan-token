import type { AppliedStats } from "../lib/upgrades";
import { rollSiegeAwnDrop, type SiegeDropKind } from "../lib/gameEconomy";
import { getDifficulty, type DifficultyDef, type DifficultyId } from "./difficulty";
import { drawJet, getShip, type ShipId, type WeaponId } from "./ships";

export type GameInput = {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  fire: boolean;
  pauseToggle: boolean;
  /** Canvas pointer (mouse/touch) — ship eases toward this point when set. */
  aimX: number | null;
  aimY: number | null;
};

export type GameOverPayload = { score: number; wave: number; minedAwn: number };

type FloatText = {
  x: number;
  y: number;
  life: number;
  text: string;
  color: string;
};

type Bullet = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dmg: number;
  ally: boolean;
  w: number;
  h: number;
  color: string;
};
type Enemy = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  kind: "fighter" | "bomber" | "ace" | "boss";
  style: number;
  color: string;
  accent: string;
  phase: number;
  score: number;
  w: number;
  h: number;
};
export type PowerKind = "shield" | "rapid" | "spread" | "missile" | "rail";
type Powerup = { x: number; y: number; kind: PowerKind; life: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string };

/** In-run pickup labels — what the player gets */
export const POWER_INFO: Record<
  PowerKind,
  { label: string; short: string; color: string; effect: string }
> = {
  shield: {
    label: "SCUDO",
    short: "+1 HP",
    color: "#7df9ff",
    effect: "Aggiunge 1 scudo",
  },
  rapid: {
    label: "RAPID",
    short: "Fire+",
    color: "#ff2bd6",
    effect: "Cadenza fuoco ×1.8 per 6s",
  },
  spread: {
    label: "SPREAD",
    short: "×3",
    color: "#b8ff3c",
    effect: "Ventaglio 3 colpi per 7s",
  },
  missile: {
    label: "MISSILE",
    short: "Homing",
    color: "#ff9f1c",
    effect: "Missili cercatori per 8s",
  },
  rail: {
    label: "RAIL",
    short: "Heavy",
    color: "#c77dff",
    effect: "Colpi pesanti per 6s",
  },
};

export class NeonSiegeEngine {
  w: number;
  h: number;
  shipId: ShipId;
  stats: AppliedStats;
  diff: DifficultyDef;
  difficultyId: DifficultyId;

  player = { x: 0, y: 0, shields: 1, invuln: 0 };
  bullets: Bullet[] = [];
  enemies: Enemy[] = [];
  powerups: Powerup[] = [];
  particles: Particle[] = [];
  floats: FloatText[] = [];
  score = 0;
  wave = 1;
  /** Session mined $AWN (pending apply on game over). */
  minedAwn = 0;
  /** Brief HUD flash when a drop hits. */
  awnFlash = 0;
  scroll = 0;
  fireCd = 0;
  rapidUntil = 0;
  spreadUntil = 0;
  missileUntil = 0;
  railUntil = 0;
  paused = false;
  over = false;
  elapsed = 0;
  spawnT = 0;
  autoFire = true;
  activeWeaponNote = "";
  private pauseLatch = false;

  onGameOver?: (p: GameOverPayload) => void;
  onSfx?: (kind: "shoot" | "hit" | "power" | "boom" | "awn") => void;

  constructor(
    w: number,
    h: number,
    shipId: ShipId,
    stats: AppliedStats,
    difficulty: DifficultyId = "easy",
  ) {
    this.w = w;
    this.h = h;
    this.shipId = shipId;
    this.stats = stats;
    this.difficultyId = difficulty;
    this.diff = getDifficulty(difficulty);
    const ship = getShip(shipId);
    this.player.x = w / 2;
    this.player.y = h * 0.82;
    this.player.shields = ship.baseShields + stats.shields + this.diff.bonusShields;
    this.activeWeaponNote = ship.weaponLabel;
  }

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
  }

  private ship() {
    return getShip(this.shipId);
  }

  private fireInterval() {
    const base = this.ship().baseFireMs / this.stats.fireRateMul;
    let mul = 1;
    if (this.elapsed < this.rapidUntil) mul *= 0.55;
    if (this.elapsed < this.railUntil) mul *= 1.25;
    return base * mul;
  }

  private damage() {
    let d = this.ship().baseDamage * this.stats.damageMul * this.diff.playerDmg;
    if (this.elapsed < this.railUntil) d *= 1.8;
    return d;
  }

  private speed() {
    return this.ship().baseSpeed * this.stats.speedMul;
  }

  private currentWeapon(): WeaponId {
    if (this.elapsed < this.missileUntil) return "plasma_arc";
    if (this.elapsed < this.spreadUntil) return "spread_burst";
    if (this.elapsed < this.railUntil) return "rail_lance";
    return this.ship().weapon;
  }

  private spawnWave() {
    const n = Math.max(
      2,
      Math.min(Math.floor((3 + Math.floor(this.wave * 1.15)) * this.diff.spawnMul), 12),
    );
    const es = this.diff.enemySpeed;
    for (let i = 0; i < n; i++) {
      let kind: Enemy["kind"] = "fighter";
      if (this.wave % 5 === 0 && i === 0) kind = "boss";
      else if (Math.random() > 0.82) kind = "ace";
      else if (Math.random() > 0.55) kind = "bomber";

      const palette = [
        { color: "#4a6fa5", accent: "#7df9ff" },
        { color: "#6b3a5c", accent: "#ff2bd6" },
        { color: "#3d5c45", accent: "#b8ff3c" },
        { color: "#5c4a7a", accent: "#c77dff" },
      ][Math.floor(Math.random() * 4)]!;

      const hpBase =
        kind === "boss"
          ? 32 + this.wave * 5
          : kind === "ace"
            ? 8 + this.wave * 0.6
            : kind === "bomber"
              ? 6 + this.wave * 0.5
              : 3 + this.wave * 0.3;
      const hp = Math.max(1, hpBase * this.diff.enemyHp);

      const scoreBase =
        kind === "boss" ? 600 + this.wave * 60 : kind === "ace" ? 120 : kind === "bomber" ? 90 : 45;

      this.enemies.push({
        x: 36 + Math.random() * (this.w - 72),
        y: -30 - Math.random() * 90 - i * 22,
        vx: (Math.random() - 0.5) * (kind === "ace" ? 160 : 50) * es,
        vy:
          (kind === "boss" ? 32 : kind === "bomber" ? 48 : 62 + Math.random() * 35 + this.wave * 2) *
          es,
        hp,
        kind,
        style: 1 + Math.floor(Math.random() * 6),
        color: kind === "boss" ? "#5a1a7a" : palette.color,
        accent: kind === "boss" ? "#ff2bd6" : palette.accent,
        phase: Math.random() * Math.PI * 2,
        score: Math.floor(scoreBase * this.diff.scoreMul),
        w: kind === "boss" ? 52 : kind === "bomber" ? 28 : 22,
        h: kind === "boss" ? 40 : 26,
      });
    }
    this.wave += 1;
  }

  private explode(x: number, y: number, color: string, n = 10) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 120;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.35 + Math.random() * 0.4,
        color,
      });
    }
  }

  private shoot() {
    const dmg = this.damage();
    const wpn = this.currentWeapon();
    const col =
      wpn === "rail_lance"
        ? "#c77dff"
        : wpn === "plasma_arc"
          ? "#ff9f1c"
          : wpn === "spread_burst"
            ? "#b8ff3c"
            : "#7df9ff";

    const mk = (ox: number, ovy = -440, ovx = 0, bw = 3, bh = 11) => {
      this.bullets.push({
        x: this.player.x + ox,
        y: this.player.y - 16,
        vx: ovx,
        vy: ovy,
        dmg,
        ally: true,
        w: bw,
        h: bh,
        color: col,
      });
    };

    if (wpn === "vulcan") {
      mk(0);
    } else if (wpn === "twin_cannon") {
      mk(-8);
      mk(8);
    } else if (wpn === "spread_burst") {
      mk(0, -430);
      mk(-12, -400, -55);
      mk(12, -400, 55);
    } else if (wpn === "rail_lance") {
      mk(0, -520, 0, 5, 18);
    } else {
      // plasma / missile mode
      mk(0, -400);
      mk(-10, -380, -40, 4, 10);
      mk(10, -380, 40, 4, 10);
      if (this.elapsed < this.missileUntil) {
        mk(-16, -360, -70, 4, 9);
        mk(16, -360, 70, 4, 9);
      }
    }
  }

  update(dt: number, input: GameInput) {
    if (this.over) return;

    if (input.pauseToggle && !this.pauseLatch) {
      this.paused = !this.paused;
      this.pauseLatch = true;
    } else if (!input.pauseToggle) {
      this.pauseLatch = false;
    }
    if (this.paused) return;

    this.elapsed += dt;
    this.scroll += dt * 90;
    this.fireCd = Math.max(0, this.fireCd - dt * 1000);
    this.player.invuln = Math.max(0, this.player.invuln - dt);

    // live weapon banner
    const ship = this.ship();
    if (this.elapsed < this.missileUntil) this.activeWeaponNote = POWER_INFO.missile.effect;
    else if (this.elapsed < this.spreadUntil) this.activeWeaponNote = POWER_INFO.spread.effect;
    else if (this.elapsed < this.railUntil) this.activeWeaponNote = POWER_INFO.rail.effect;
    else if (this.elapsed < this.rapidUntil) this.activeWeaponNote = POWER_INFO.rapid.effect;
    else this.activeWeaponNote = ship.weaponLabel;

    const spd = this.speed();
    // Keyboard / D-pad: full 8-way (normalize diagonals)
    let dx = 0;
    let dy = 0;
    if (input.left) dx -= 1;
    if (input.right) dx += 1;
    if (input.up) dy -= 1;
    if (input.down) dy += 1;
    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy) || 1;
      this.player.x += (dx / len) * spd * dt;
      this.player.y += (dy / len) * spd * dt;
    }
    // Mouse / touch: fluid chase toward pointer
    if (input.aimX != null && input.aimY != null) {
      const ease = Math.min(1, 14 * dt);
      this.player.x += (input.aimX - this.player.x) * ease;
      this.player.y += (input.aimY - this.player.y) * ease;
    }
    this.player.x = Math.max(20, Math.min(this.w - 20, this.player.x));
    this.player.y = Math.max(36, Math.min(this.h - 28, this.player.y));

    if ((this.autoFire || input.fire) && this.fireCd <= 0) {
      this.shoot();
      this.onSfx?.("shoot");
      this.fireCd = this.fireInterval();
    }

    this.spawnT -= dt;
    if (this.spawnT <= 0 || this.enemies.length === 0) {
      this.spawnWave();
      this.spawnT = this.diff.waveGap + Math.random() * 2;
    }

    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
    this.bullets = this.bullets.filter((b) => b.y > -30 && b.y < this.h + 30 && b.x > -20 && b.x < this.w + 20);

    for (const e of this.enemies) {
      e.phase += dt;
      if (e.kind === "ace") {
        e.x += Math.sin(e.phase * 3.2) * 100 * dt + e.vx * dt * 0.25;
        e.y += e.vy * dt;
      } else if (e.kind === "boss") {
        e.x += Math.sin(e.phase * 1.1) * 75 * dt;
        e.y += e.vy * dt;
        if (Math.random() < dt * 1.5 * this.diff.enemyFireMul) {
          this.bullets.push({
            x: e.x,
            y: e.y + 18,
            vx: (Math.random() - 0.5) * 60,
            vy: (240 + this.wave * 8) * this.diff.enemySpeed,
            dmg: 1,
            ally: false,
            w: 4,
            h: 9,
            color: "#ff4d6d",
          });
        }
      } else if (e.kind === "bomber") {
        e.x += Math.sin(e.phase) * 40 * dt;
        e.y += e.vy * dt;
        if (Math.random() < dt * 0.7 * this.diff.enemyFireMul) {
          this.bullets.push({
            x: e.x,
            y: e.y + 14,
            vx: 0,
            vy: 180 * this.diff.enemySpeed,
            dmg: 1,
            ally: false,
            w: 5,
            h: 8,
            color: "#ff9f1c",
          });
        }
      } else {
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        if (e.x < 24 || e.x > this.w - 24) e.vx *= -1;
      }
    }
    this.enemies = this.enemies.filter((e) => e.y < this.h + 50 && e.hp > 0);

    for (const b of this.bullets) {
      if (!b.ally) continue;
      for (const e of this.enemies) {
        if (Math.abs(b.x - e.x) < e.w * 0.5 && Math.abs(b.y - e.y) < e.h * 0.5) {
          e.hp -= b.dmg;
          b.y = -999;
          this.explode(e.x, e.y - 4, b.color, 5);
          this.onSfx?.("hit");
          if (e.hp <= 0) {
            this.score += e.score;
            this.explode(e.x, e.y, e.accent, e.kind === "boss" ? 30 : 14);
            this.onSfx?.("boom");
            this.trySiegeAwnDrop(e);
            if (Math.random() < 0.28) {
              const kinds: PowerKind[] = ["shield", "rapid", "spread", "missile", "rail"];
              this.powerups.push({
                x: e.x,
                y: e.y,
                kind: kinds[Math.floor(Math.random() * kinds.length)]!,
                life: 10,
              });
            }
          }
        }
      }
    }

    if (this.player.invuln <= 0) {
      const hit =
        this.bullets.some(
          (b) =>
            !b.ally &&
            Math.abs(b.x - this.player.x) < 13 &&
            Math.abs(b.y - this.player.y) < 15,
        ) ||
        this.enemies.some(
          (e) =>
            Math.abs(e.x - this.player.x) < e.w * 0.42 &&
            Math.abs(e.y - this.player.y) < e.h * 0.42,
        );
      if (hit) {
        this.player.shields -= 1;
        this.player.invuln = 1.15;
        this.explode(this.player.x, this.player.y, "#ff2bd6", 16);
        if (this.player.shields < 0) {
          this.over = true;
          this.onGameOver?.({
            score: this.score,
            wave: this.wave,
            minedAwn: this.minedAwn,
          });
        }
      }
    }

    for (const p of this.powerups) {
      p.y += 65 * dt;
      p.life -= dt;
      if (Math.hypot(p.x - this.player.x, p.y - this.player.y) < 26) {
        if (p.kind === "shield") this.player.shields += 1;
        if (p.kind === "rapid") this.rapidUntil = this.elapsed + 6;
        if (p.kind === "spread") this.spreadUntil = this.elapsed + 7;
        if (p.kind === "missile") this.missileUntil = this.elapsed + 8;
        if (p.kind === "rail") this.railUntil = this.elapsed + 6;
        p.life = -1;
        this.explode(p.x, p.y, POWER_INFO[p.kind].color, 10);
        this.onSfx?.("power");
      }
    }
    this.powerups = this.powerups.filter((p) => p.life > 0 && p.y < this.h + 20);

    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    this.awnFlash = Math.max(0, this.awnFlash - dt);
    for (const f of this.floats) {
      f.y -= 28 * dt;
      f.life -= dt;
    }
    this.floats = this.floats.filter((f) => f.life > 0);
  }

  /** Boss + elite (ace) only — fighters/bombers never drop. */
  private trySiegeAwnDrop(e: Enemy) {
    let kind: SiegeDropKind | null = null;
    if (e.kind === "boss") kind = "boss";
    else if (e.kind === "ace") kind = "elite";
    if (!kind) return;

    const amount = rollSiegeAwnDrop(this.difficultyId, kind);
    if (amount <= 0) return;

    this.minedAwn = Math.round((this.minedAwn + amount) * 10) / 10;
    this.awnFlash = 1.1;
    this.floats.push({
      x: e.x,
      y: e.y - 10,
      life: 1.35,
      text: `+${amount} $AWN`,
      color: "#b8ff3c",
    });
    this.explode(e.x, e.y, "#b8ff3c", 12);
    this.onSfx?.("awn");
  }

  /** Fake 3D: farther (top) = smaller scale */
  private depthScale(y: number) {
    const t = Math.max(0, Math.min(1, y / this.h));
    return 0.45 + t * 0.95;
  }

  draw(ctx: CanvasRenderingContext2D) {
    const { w, h } = this;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#2a0a4a");
    g.addColorStop(0.35, "#140628");
    g.addColorStop(1, "#050210");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // vanishing-point “corridor” for 3D motion
    const cx = w / 2 + Math.sin(this.elapsed * 0.4) * 8;
    const horizon = h * 0.18;
    ctx.strokeStyle = "rgba(255,43,214,0.22)";
    ctx.lineWidth = 1;
    for (let i = -6; i <= 6; i++) {
      ctx.beginPath();
      ctx.moveTo(cx, horizon);
      ctx.lineTo(cx + i * (w * 0.22), h + 20);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(125,249,255,0.18)";
    for (let i = 0; i < 14; i++) {
      const t = ((i / 14 + this.scroll * 0.0007) % 1);
      const y = horizon + t * t * (h - horizon);
      const half = (t * w * 0.48);
      ctx.beginPath();
      ctx.moveTo(cx - half, y);
      ctx.lineTo(cx + half, y);
      ctx.stroke();
    }

    // parallax stars in depth
    for (let i = 0; i < 60; i++) {
      const depth = 0.3 + (i % 5) * 0.15;
      const sx = (i * 97 + Math.sin(this.elapsed + i) * 4) % w;
      const sy = (i * 53 + this.scroll * depth) % h;
      const sz = depth * 2.2;
      ctx.fillStyle = i % 3 === 0 ? "rgba(255,43,214,0.55)" : "rgba(125,249,255,0.55)";
      ctx.beginPath();
      ctx.arc(sx, sy, sz, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (const p of this.powerups) {
      const sc = this.depthScale(p.y);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(sc, sc);
      ctx.translate(-p.x, -p.y);
      // bob
      const bob = Math.sin(this.elapsed * 5 + p.x) * 3;
      ctx.translate(0, bob);
      this.drawPowerup(ctx, p);
      ctx.restore();
    }

    for (const b of this.bullets) {
      const sc = this.depthScale(b.y);
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, b.w * sc, (b.h / 2) * sc, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // sort enemies far→near for draw order
    const sorted = [...this.enemies].sort((a, b) => a.y - b.y);
    for (const e of sorted) {
      const base = e.kind === "boss" ? 1.55 : e.kind === "bomber" ? 1.15 : 0.95;
      const sc = this.depthScale(e.y) * base;
      // soft shadow on “ground”
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.ellipse(e.x, e.y + 14 * sc, 14 * sc, 4 * sc, 0, 0, Math.PI * 2);
      ctx.fill();
      drawJet(ctx, {
        color: e.color,
        accent: e.accent,
        style: e.style,
        x: e.x,
        y: e.y,
        scale: sc,
        facing: "down",
        enemy: true,
      });
      if (e.kind === "boss") {
        ctx.fillStyle = "rgba(255,43,214,0.9)";
        ctx.font = "700 10px Rajdhani,sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("BOSS", e.x, e.y - 22 * sc);
        ctx.textAlign = "left";
      }
    }

    if (this.player.invuln <= 0 || Math.floor(this.elapsed * 12) % 2 === 0) {
      const bank = (Math.sin(this.elapsed * 2) * 0.02);
      ctx.save();
      ctx.translate(this.player.x, this.player.y);
      ctx.rotate(bank);
      // engine flare
      const flare = ctx.createRadialGradient(0, 18, 2, 0, 28, 22);
      flare.addColorStop(0, "rgba(125,249,255,0.85)");
      flare.addColorStop(0.4, "rgba(255,43,214,0.35)");
      flare.addColorStop(1, "transparent");
      ctx.fillStyle = flare;
      ctx.beginPath();
      ctx.ellipse(0, 24, 8 + Math.sin(this.elapsed * 20) * 2, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.translate(-this.player.x, -this.player.y);
      drawJet(ctx, {
        color: this.ship().color,
        accent: this.ship().accent,
        style: this.ship().style,
        x: this.player.x,
        y: this.player.y,
        scale: 1.12,
        facing: "up",
      });
      ctx.restore();
    }

    for (const f of this.floats) {
      const a = Math.min(1, f.life * 1.4);
      ctx.globalAlpha = a;
      ctx.fillStyle = f.color;
      ctx.font = "800 14px Orbitron,sans-serif";
      ctx.textAlign = "center";
      ctx.shadowColor = f.color;
      ctx.shadowBlur = 10;
      ctx.fillText(f.text, f.x, f.y);
      ctx.shadowBlur = 0;
      ctx.textAlign = "left";
    }
    ctx.globalAlpha = 1;

    // HUD
    ctx.fillStyle = "rgba(255,43,214,0.95)";
    ctx.font = "700 13px Rajdhani,sans-serif";
    ctx.fillText(`SCORE ${this.score}`, 10, 18);
    ctx.fillStyle = "rgba(125,249,255,0.95)";
    ctx.fillText(`WAVE ${this.wave}`, 10, 34);
    ctx.fillText(`SHIELD ${Math.max(0, this.player.shields)}`, 10, 50);
    if (this.minedAwn > 0 || this.awnFlash > 0) {
      const flash = this.awnFlash > 0;
      ctx.fillStyle = flash ? "#b8ff3c" : "rgba(184,255,60,0.85)";
      ctx.font = flash ? "800 14px Orbitron,sans-serif" : "700 12px Rajdhani,sans-serif";
      ctx.fillText(`$AWN ${this.minedAwn}`, 10, 66);
      if (flash) {
        ctx.globalAlpha = Math.min(1, this.awnFlash);
        ctx.fillStyle = "rgba(184,255,60,0.18)";
        ctx.fillRect(0, 0, w, 78);
        ctx.globalAlpha = 1;
      }
    }

    // weapon banner
    ctx.fillStyle = "rgba(8,2,18,0.72)";
    ctx.fillRect(8, h - 52, w - 16, 40);
    ctx.strokeStyle = "rgba(255,43,214,0.55)";
    ctx.strokeRect(8, h - 52, w - 16, 40);
    ctx.fillStyle = "#7df9ff";
    ctx.font = "700 11px Orbitron,sans-serif";
    ctx.fillText("ARMA ATTIVA", 16, h - 34);
    ctx.fillStyle = "#f2e9ff";
    ctx.font = "600 12px Rajdhani,sans-serif";
    ctx.fillText(this.activeWeaponNote.slice(0, 42), 16, h - 16);

    if (this.paused) {
      ctx.fillStyle = "rgba(8,2,18,0.55)";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#ff2bd6";
      ctx.font = "800 28px Orbitron,sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("PAUSED", w / 2, h / 2);
      ctx.textAlign = "left";
    }

    if (this.over) {
      ctx.fillStyle = "rgba(8,2,18,0.65)";
      ctx.fillRect(0, 0, w, h);
      ctx.textAlign = "center";
      ctx.fillStyle = "#ff2bd6";
      ctx.font = "800 24px Orbitron,sans-serif";
      ctx.fillText("SIGNAL LOST", w / 2, h / 2 - 10);
      ctx.fillStyle = "#7df9ff";
      ctx.font = "600 16px Rajdhani,sans-serif";
      ctx.fillText(`Final score ${this.score}`, w / 2, h / 2 + 18);
      if (this.minedAwn > 0) {
        ctx.fillStyle = "#b8ff3c";
        ctx.font = "700 14px Orbitron,sans-serif";
        ctx.fillText(`Mined +${this.minedAwn} $AWN`, w / 2, h / 2 + 42);
      }
      ctx.textAlign = "left";
    }
  }

  private drawPowerup(ctx: CanvasRenderingContext2D, p: Powerup) {
    const info = POWER_INFO[p.kind];
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.shadowColor = info.color;
    ctx.shadowBlur = 14;

    // capsule body
    ctx.fillStyle = "rgba(8,2,18,0.9)";
    ctx.strokeStyle = info.color;
    ctx.lineWidth = 2;
    roundRect(ctx, -22, -14, 44, 28, 6);
    ctx.fill();
    ctx.stroke();

    // icon chip
    ctx.fillStyle = info.color;
    ctx.beginPath();
    ctx.arc(-12, 0, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = "#fff";
    ctx.font = "800 8px Orbitron,sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(info.label, -4, -2);
    ctx.fillStyle = info.color;
    ctx.font = "600 8px Rajdhani,sans-serif";
    ctx.fillText(info.short, -4, 9);
    ctx.restore();
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
