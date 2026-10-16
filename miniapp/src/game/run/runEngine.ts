import { AWN_TOKEN_DROP_CHANCE } from "../../lib/gameEconomy";
import type { RunPowerId } from "../../lib/gameEconomy";

export type RunInput = {
  left: boolean;
  right: boolean;
  jump: boolean;
  fire: boolean;
};

export type RunResult = {
  score: number;
  gold: number;
  mined: number;
  distance: number;
};

type Rect = { x: number; y: number; w: number; h: number };
type Coin = Rect & { kind: "gold" | "awn"; bob: number };
type Enemy = Rect & { vx: number; alive: boolean };
type Fireball = { x: number; y: number; vx: number; life: number };

function aabb(a: Rect, b: Rect) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export class AwnRunEngine {
  w: number;
  h: number;
  powers: RunPowerId[];
  logo: HTMLImageElement | null;

  camX = 0;
  /** Mario-like hitbox: short & stout (not a floating logo circle). */
  player = { x: 40, y: 0, vx: 0, vy: 0, w: 22, h: 34, onGround: false, faces: 1, hp: 1 };
  platforms: Rect[] = [];
  coins: Coin[] = [];
  enemies: Enemy[] = [];
  fireballs: Fireball[] = [];
  score = 0;
  gold = 0;
  mined = 0;
  distance = 0;
  elapsed = 0;
  invuln = 0;
  over = false;
  won = false;
  jumpLatch = false;
  fireCd = 0;
  worldLen = 3200;

  onSfx?: (k: "coin" | "awn" | "jump" | "hit" | "boom") => void;
  onOver?: (r: RunResult) => void;

  constructor(w: number, h: number, powers: RunPowerId[], logo: HTMLImageElement | null) {
    this.w = w;
    this.h = h;
    this.powers = powers;
    this.logo = logo;
    if (powers.includes("mushroom")) {
      this.player.w = 28;
      this.player.h = 42;
      this.player.hp = 2;
    }
    if (powers.includes("star")) this.invuln = 3.5;
    this.player.y = h - 80;
    this.buildLevel();
  }

  private buildLevel() {
    const groundY = this.h - 40;
    this.platforms.push({ x: 0, y: groundY, w: this.worldLen, h: 40 });

    // floating platforms
    const pads = [
      [180, groundY - 70, 90],
      [320, groundY - 120, 70],
      [480, groundY - 80, 100],
      [650, groundY - 140, 80],
      [820, groundY - 90, 110],
      [1050, groundY - 130, 70],
      [1250, groundY - 70, 120],
      [1480, groundY - 150, 90],
      [1700, groundY - 100, 100],
      [1950, groundY - 160, 80],
      [2200, groundY - 85, 130],
      [2450, groundY - 140, 70],
      [2700, groundY - 75, 110],
      [2950, groundY - 120, 90],
    ];
    for (const [x, y, w] of pads) {
      this.platforms.push({ x: x!, y: y!, w: w!, h: 14 });
    }

    // coins on pads + ground — mix gold / rare AWN
    let ci = 0;
    for (const p of this.platforms) {
      if (p.w > 200) continue;
      const n = Math.max(1, Math.floor(p.w / 36));
      for (let i = 0; i < n; i++) {
        const kind: "gold" | "awn" = Math.random() < AWN_TOKEN_DROP_CHANCE ? "awn" : "gold";
        this.coins.push({
          x: p.x + 12 + i * 34,
          y: p.y - 28,
          w: 18,
          h: 18,
          kind,
          bob: ci++ * 0.7,
        });
      }
    }
    // a few rare AWN on higher platforms only (harder)
    for (let i = 0; i < 6; i++) {
      this.coins.push({
        x: 400 + i * 420,
        y: groundY - 200 - (i % 2) * 30,
        w: 20,
        h: 20,
        kind: "awn",
        bob: i,
      });
    }

    // goomba-like enemies
    for (let i = 0; i < 14; i++) {
      this.enemies.push({
        x: 250 + i * 210,
        y: groundY - 24,
        w: 24,
        h: 24,
        vx: (i % 2 === 0 ? -1 : 1) * (40 + (i % 3) * 15),
        alive: true,
      });
    }
  }

  private jumpPower() {
    let j = -420;
    if (this.powers.includes("mushroom")) j = -460;
    return j;
  }

  private moveSpeed() {
    return this.powers.includes("mushroom") ? 210 : 180;
  }

  update(dt: number, input: RunInput) {
    if (this.over) return;
    this.elapsed += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.fireCd = Math.max(0, this.fireCd - dt);

    const spd = this.moveSpeed();
    if (input.left) {
      this.player.vx = -spd;
      this.player.faces = -1;
    } else if (input.right) {
      this.player.vx = spd;
      this.player.faces = 1;
    } else {
      this.player.vx *= 0.78;
    }

    if (input.jump && this.player.onGround && !this.jumpLatch) {
      this.player.vy = this.jumpPower();
      this.player.onGround = false;
      this.jumpLatch = true;
      this.onSfx?.("jump");
    }
    if (!input.jump) this.jumpLatch = false;

    // glide
    if (this.powers.includes("leaf") && this.player.vy > 40 && input.jump) {
      this.player.vy = Math.min(this.player.vy, 70);
    }

    if (input.fire && this.powers.includes("fire_flower") && this.fireCd <= 0) {
      this.fireballs.push({
        x: this.player.x + this.player.w / 2,
        y: this.player.y + 8,
        vx: this.player.faces * 320,
        life: 1.4,
      });
      this.fireCd = 0.35;
    }

    this.player.vy += 1100 * dt;
    this.player.x += this.player.vx * dt;
    this.player.y += this.player.vy * dt;
    this.player.onGround = false;

    for (const p of this.platforms) {
      if (
        this.player.vy >= 0 &&
        this.player.x + this.player.w > p.x + 2 &&
        this.player.x < p.x + p.w - 2 &&
        this.player.y + this.player.h > p.y &&
        this.player.y + this.player.h < p.y + p.h + 18 &&
        this.player.y + this.player.h - this.player.vy * dt <= p.y + 4
      ) {
        this.player.y = p.y - this.player.h;
        this.player.vy = 0;
        this.player.onGround = true;
      }
    }

    this.player.x = Math.max(0, Math.min(this.worldLen - this.player.w, this.player.x));
    if (this.player.y > this.h + 80) {
      this.finish(false);
      return;
    }

    // coins
    this.coins = this.coins.filter((c) => {
      c.bob += dt;
      if (aabb(this.player, c)) {
        if (c.kind === "gold") {
          this.gold += 1;
          this.score += 10;
          this.onSfx?.("coin");
        } else {
          this.mined += 1;
          this.score += 100;
          this.onSfx?.("awn");
        }
        return false;
      }
      return true;
    });

    // enemies
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.x += e.vx * dt;
      if (e.x < 40 || e.x > this.worldLen - 40) e.vx *= -1;
      // stomp
      if (
        aabb(this.player, e) &&
        this.player.vy > 0 &&
        this.player.y + this.player.h < e.y + e.h * 0.55
      ) {
        e.alive = false;
        this.player.vy = -280;
        this.score += 50;
        this.onSfx?.("boom");
      } else if (aabb(this.player, e) && this.invuln <= 0) {
        this.player.hp -= 1;
        this.invuln = 1.2;
        this.player.vy = -220;
        this.onSfx?.("hit");
        if (this.player.hp <= 0) {
          this.finish(false);
          return;
        }
      }
    }

    for (const f of this.fireballs) {
      f.x += f.vx * dt;
      f.life -= dt;
      for (const e of this.enemies) {
        if (e.alive && aabb({ x: f.x, y: f.y, w: 10, h: 10 }, e)) {
          e.alive = false;
          f.life = -1;
          this.score += 40;
          this.onSfx?.("boom");
        }
      }
    }
    this.fireballs = this.fireballs.filter((f) => f.life > 0);

    this.camX = Math.max(0, Math.min(this.worldLen - this.w, this.player.x - this.w * 0.35));
    this.distance = Math.floor(this.player.x);

    if (this.player.x > this.worldLen - 80) {
      this.finish(true);
    }
  }

  private finish(won: boolean) {
    if (this.over) return;
    this.over = true;
    this.won = won;
    this.onOver?.({
      score: this.score + (won ? 200 : 0),
      gold: this.gold,
      mined: this.mined,
      distance: this.distance,
    });
  }

  draw(ctx: CanvasRenderingContext2D) {
    const { w, h } = this;
    // sky parallax
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#3a1470");
    sky.addColorStop(0.55, "#1a0730");
    sky.addColorStop(1, "#0a0418");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // hills
    ctx.fillStyle = "rgba(255,43,214,0.12)";
    for (let i = 0; i < 5; i++) {
      const hx = ((i * 280 - this.camX * 0.3) % (w + 300)) - 80;
      ctx.beginPath();
      ctx.ellipse(hx, h - 30, 120, 50, 0, Math.PI, 0);
      ctx.fill();
    }

    ctx.save();
    ctx.translate(-this.camX, 0);

    // platforms
    for (const p of this.platforms) {
      const g = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h);
      g.addColorStop(0, "#c77dff");
      g.addColorStop(1, "#5a1a7a");
      ctx.fillStyle = g;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = "rgba(125,249,255,0.35)";
      ctx.fillRect(p.x, p.y, p.w, 3);
    }

    // goal flag
    ctx.fillStyle = "#b8ff3c";
    ctx.fillRect(this.worldLen - 50, this.h - 160, 6, 120);
    ctx.beginPath();
    ctx.moveTo(this.worldLen - 44, this.h - 160);
    ctx.lineTo(this.worldLen - 14, this.h - 145);
    ctx.lineTo(this.worldLen - 44, this.h - 130);
    ctx.fill();

    // coins
    for (const c of this.coins) {
      const by = c.y + Math.sin(c.bob * 4) * 3;
      if (c.kind === "gold") {
        this.drawGoldCoin(ctx, c.x + 9, by + 9);
      } else {
        this.drawAwnCoin(ctx, c.x + 9, by + 9);
      }
    }

    // enemies
    for (const e of this.enemies) {
      if (!e.alive) continue;
      ctx.fillStyle = "#ff4d6d";
      ctx.beginPath();
      ctx.ellipse(e.x + e.w / 2, e.y + e.h / 2, e.w / 2, e.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillRect(e.x + 6, e.y + 8, 4, 4);
      ctx.fillRect(e.x + 14, e.y + 8, 4, 4);
    }

    for (const f of this.fireballs) {
      ctx.fillStyle = "#ff9f1c";
      ctx.shadowColor = "#ff2bd6";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(f.x, f.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // player = small old-man platformer mascot (Mario-like proportions + logo face)
    if (this.invuln <= 0 || Math.floor(this.elapsed * 14) % 2 === 0) {
      this.drawPlayer(ctx);
    }

    ctx.restore();

    // HUD
    ctx.fillStyle = "rgba(8,2,18,0.7)";
    ctx.fillRect(8, 8, w - 16, 44);
    ctx.fillStyle = "#ffd700";
    ctx.font = "700 13px Rajdhani,sans-serif";
    ctx.fillText(`GOLD ×${this.gold}`, 16, 28);
    ctx.fillStyle = "#7df9ff";
    ctx.fillText(`$AWN mined ×${this.mined}`, 110, 28);
    ctx.fillStyle = "#ff2bd6";
    ctx.fillText(`SCORE ${this.score}`, 16, 44);
    ctx.fillStyle = "#b8ff3c";
    ctx.fillText(`HP ${this.player.hp}`, w - 70, 28);

    if (this.over) {
      ctx.fillStyle = "rgba(8,2,18,0.7)";
      ctx.fillRect(0, 0, w, h);
      ctx.textAlign = "center";
      ctx.fillStyle = this.won ? "#b8ff3c" : "#ff2bd6";
      ctx.font = "800 24px Orbitron,sans-serif";
      ctx.fillText(this.won ? "FLAG CLEARED" : "RUN OVER", w / 2, h / 2 - 12);
      ctx.fillStyle = "#7df9ff";
      ctx.font = "600 14px Rajdhani,sans-serif";
      ctx.fillText(
        `Gold ${this.gold} · Mined $AWN ${this.mined} · Score ${this.score}`,
        w / 2,
        h / 2 + 16,
      );
      ctx.textAlign = "left";
    }
  }

  /** Classic Mario-style spinning gold coin. */
  private drawGoldCoin(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save();
    ctx.translate(x, y);
    const spin = 0.35 + Math.abs(Math.sin(this.elapsed * 5 + x * 0.05)) * 0.65;
    ctx.scale(spin, 1);
    const g = ctx.createRadialGradient(-2, -3, 1, 0, 0, 11);
    g.addColorStop(0, "#fff8c0");
    g.addColorStop(0.45, "#ffd700");
    g.addColorStop(1, "#a67c00");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fff6a0";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.strokeStyle = "#b8860b";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 6, 7, 0, 0, Math.PI * 2);
    ctx.stroke();
    if (spin > 0.55) {
      ctx.fillStyle = "#8b6914";
      ctx.font = "800 11px Orbitron,sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("$", 0, 1);
    }
    ctx.restore();
  }

  /** $AWN token medallion — clean circular 3D logo, spinning coin. */
  private drawAwnCoin(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const r = 12;
    ctx.save();
    ctx.translate(x, y);
    const spin = Math.sin(this.elapsed * 4.2 + x * 0.04);
    const sx = 0.22 + Math.abs(spin) * 0.78;
    ctx.scale(sx, 1);
    ctx.shadowColor = "rgba(255, 200, 60, 0.65)";
    ctx.shadowBlur = 10;
    if (this.logo && this.logo.complete && this.logo.naturalWidth > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(this.logo, -r, -r, r * 2, r * 2);
    } else {
      const g = ctx.createRadialGradient(-2, -2, 1, 0, 0, r);
      g.addColorStop(0, "#ffe9a0");
      g.addColorStop(1, "#c9a227");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1a0a00";
      ctx.font = "800 7px Orbitron,sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("$AWN", 0, 0);
    }
    ctx.restore();
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sx, 1);
    ctx.strokeStyle = "#f0c14a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Small Super-Mario-like old man: short legs/arms, stout torso,
   brown flat cap + jacket + light blue shirt; face = circular crop of logo portrait.
   */
  private drawPlayer(ctx: CanvasRenderingContext2D) {
    const p = this.player;
    const px = p.x;
    const py = p.y;
    const dir = p.faces;
    const moving = Math.abs(p.vx) > 18 && p.onGround;
    const walk = moving ? Math.sin(this.elapsed * 14) : 0;
    const jumpSquash = !p.onGround ? Math.min(1, Math.abs(p.vy) / 420) : 0;

    const headR = Math.max(7, p.w * 0.42);
    const bodyW = p.w * 0.72;
    const bodyH = p.h * 0.34;
    const legH = p.h * 0.22;
    const armH = p.h * 0.22;
    const cx = px + p.w / 2;
    const headCy = py + headR + 1;
    const bodyTop = headCy + headR - 2;
    const bodyBot = bodyTop + bodyH;
    const footY = py + p.h;

    ctx.save();
    // slight jump stretch
    if (jumpSquash > 0.05) {
      ctx.translate(cx, footY);
      ctx.scale(1 - jumpSquash * 0.08, 1 + jumpSquash * 0.06);
      ctx.translate(-cx, -footY);
    }

    // legs (brown trousers)
    const legW = bodyW * 0.32;
    const legGap = bodyW * 0.12;
    const legSwing = walk * 5;
    ctx.fillStyle = "#5c3a1e";
    // left
    ctx.fillRect(cx - legGap - legW - (dir > 0 ? legSwing : -legSwing) * 0.3, bodyBot - 1, legW, legH + 2);
    // right
    ctx.fillRect(cx + legGap + (dir > 0 ? legSwing : -legSwing) * 0.3, bodyBot - 1, legW, legH + 2);
    // shoes
    ctx.fillStyle = "#2a180c";
    ctx.fillRect(cx - legGap - legW - 1, footY - 4, legW + 2, 4);
    ctx.fillRect(cx + legGap - 1, footY - 4, legW + 2, 4);

    // torso — brown jacket
    const bx = cx - bodyW / 2;
    const jacket = ctx.createLinearGradient(bx, bodyTop, bx, bodyBot);
    jacket.addColorStop(0, "#8b5a2b");
    jacket.addColorStop(1, "#5c3a1e");
    ctx.fillStyle = jacket;
    ctx.fillRect(bx, bodyTop, bodyW, bodyH);
    // light blue shirt peek (collar / chest)
    ctx.fillStyle = "#7eb8e8";
    ctx.fillRect(cx - bodyW * 0.16, bodyTop + 2, bodyW * 0.32, bodyH * 0.55);
    ctx.fillStyle = "#a8d4f0";
    ctx.fillRect(cx - 1, bodyTop + 2, 2, bodyH * 0.5);

    // arms
    const armW = Math.max(3, p.w * 0.16);
    const armY = bodyTop + 3;
    const armSwing = walk * 4;
    ctx.fillStyle = "#8b5a2b";
    if (dir >= 0) {
      ctx.fillRect(bx - armW + 1, armY + armSwing, armW, armH);
      ctx.fillRect(bx + bodyW - 1, armY - armSwing, armW, armH);
    } else {
      ctx.fillRect(bx - armW + 1, armY - armSwing, armW, armH);
      ctx.fillRect(bx + bodyW - 1, armY + armSwing, armW, armH);
    }
    // hands (skin)
    ctx.fillStyle = "#e8b896";
    ctx.fillRect(bx - armW + 1, armY + armH - 2 + (dir >= 0 ? armSwing : -armSwing), armW, 3);
    ctx.fillRect(bx + bodyW - 1, armY + armH - 2 + (dir >= 0 ? -armSwing : armSwing), armW, 3);

    // head — circular face crop from $AWN logo (portrait region, not full coin)
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, headCy, headR, 0, Math.PI * 2);
    ctx.clip();
    if (this.logo && this.logo.complete && this.logo.naturalWidth > 0) {
      const lw = this.logo.naturalWidth;
      const lh = this.logo.naturalHeight;
      // Focus on face + cap (upper ~72% of medallion), skip $AWN text band
      const sx = lw * 0.12;
      const sy = lh * 0.02;
      const sw = lw * 0.76;
      const sh = lh * 0.72;
      if (dir < 0) {
        ctx.translate(cx, headCy);
        ctx.scale(-1, 1);
        ctx.translate(-cx, -headCy);
      }
      ctx.drawImage(this.logo, sx, sy, sw, sh, cx - headR, headCy - headR, headR * 2, headR * 2);
    } else {
      // fallback drawn face
      ctx.fillStyle = "#e8b896";
      ctx.fillRect(cx - headR, headCy - headR, headR * 2, headR * 2);
      ctx.fillStyle = "#5c3a1e";
      ctx.fillRect(cx - headR, headCy - headR, headR * 2, headR * 0.45);
      ctx.fillStyle = "#7eb8e8";
      ctx.fillRect(cx - 2, headCy + 2, 4, 3);
    }
    ctx.restore();

    // brown flat-cap brim silhouette over forehead
    ctx.fillStyle = "#5c3a1e";
    ctx.beginPath();
    ctx.ellipse(cx + dir * 1, headCy - headR * 0.55, headR * 0.95, headR * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + dir * headR * 0.35, headCy - headR * 0.35, headR * 0.55, headR * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();

    // outline so silhouette reads while moving
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, headCy, headR, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }
}
