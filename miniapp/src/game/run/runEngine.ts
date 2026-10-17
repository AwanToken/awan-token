import { AWN_TOKEN_DROP_CHANCE } from "../../lib/gameEconomy";
import type { RunPowerId } from "../../lib/gameEconomy";
import { getRunLevel, type BossKind, type RunLevelDef } from "./runLevels";

export type RunInput = {
  left: boolean;
  right: boolean;
  down: boolean;
  jump: boolean;
  /** Fireball or leaf glide (secondary power). */
  action: boolean;
};

export type RunResult = {
  score: number;
  gold: number;
  mined: number;
  distance: number;
  level: number;
  won: boolean;
};

type Rect = { x: number; y: number; w: number; h: number };
type Coin = Rect & { kind: "gold" | "awn"; bob: number };
type Enemy = Rect & { vx: number; alive: boolean };
type Fireball = { x: number; y: number; vx: number; vy: number; life: number };
type PickupKind = "mushroom" | "fire" | "star" | "leaf" | "magnet" | "boost";
type Pickup = Rect & { kind: PickupKind; bob: number; vx: number; grounded: boolean };

type BrickKind = "solid" | "breakable" | "question" | "empty";
type Brick = Rect & {
  kind: BrickKind;
  /** Hidden item for question/breakable. */
  loot?: PickupKind;
  bump: number;
};

type BossSphere = { x: number; y: number; vx: number; vy: number; life: number; r: number };

type BossState = {
  kind: BossKind;
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  shootTimer: number;
  invuln: number;
  phase: number;
  alive: boolean;
};

const TILE = 28;

function aabb(a: Rect, b: Rect) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function circleHit(cx: number, cy: number, r: number, box: Rect) {
  const nx = Math.max(box.x, Math.min(cx, box.x + box.w));
  const ny = Math.max(box.y, Math.min(cy, box.y + box.h));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

export class AwnRunEngine {
  w: number;
  h: number;
  powers: RunPowerId[];
  logo: HTMLImageElement | null;

  level = 1;
  camX = 0;
  player = { x: 40, y: 0, vx: 0, vy: 0, w: 22, h: 34, onGround: false, faces: 1, hp: 1 };
  platforms: Rect[] = [];
  bricks: Brick[] = [];
  coins: Coin[] = [];
  enemies: Enemy[] = [];
  fireballs: Fireball[] = [];
  pickups: Pickup[] = [];
  spheres: BossSphere[] = [];
  boss: BossState | null = null;
  score = 0;
  gold = 0;
  mined = 0;
  distance = 0;
  elapsed = 0;
  invuln = 0;
  over = false;
  won = false;
  paused = false;
  inBoss = false;
  jumpLatch = false;
  actionLatch = false;
  fireCd = 0;
  worldLen = 2200;
  arenaStart = 2200;
  totalLen = 2700;
  levelBanner = 0;
  bossBanner = 0;
  checkpointX = 0;
  reachedCheckpoint = false;
  tempMagnet = 0;
  tempBoost = 0;
  tempFire = 0;
  tempLeaf = 0;
  private baseHp = 1;
  private groundY = 0;

  onSfx?: (k: "coin" | "awn" | "jump" | "hit" | "boom" | "power" | "break") => void;
  onOver?: (r: RunResult) => void;

  constructor(w: number, h: number, powers: RunPowerId[], logo: HTMLImageElement | null) {
    this.w = w;
    this.h = h;
    this.powers = [...powers];
    this.logo = logo;
    this.applyMushroomSize();
    if (powers.includes("star")) this.invuln = 3.5;
    if (powers.includes("fire_flower")) this.tempFire = Math.max(this.tempFire, 9999);
    if (powers.includes("leaf")) this.tempLeaf = Math.max(this.tempLeaf, 9999);
    this.player.y = h - 80;
    this.loadLevel(1, true);
  }

  /** True when player can damage bosses / shoot fireballs. */
  hasFire(): boolean {
    return this.powers.includes("fire_flower") || this.tempFire > 0;
  }

  hasLeaf(): boolean {
    return this.powers.includes("leaf") || this.tempLeaf > 0;
  }

  /** Grant a power mid-run (AWN shop or TON emergency). */
  grantPower(id: RunPowerId) {
    if (!this.powers.includes(id)) this.powers.push(id);
    if (id === "mushroom") {
      this.applyMushroomSize();
      this.player.hp = Math.max(this.player.hp, this.baseHp);
    }
    if (id === "fire_flower") this.tempFire = Math.max(this.tempFire, 9999);
    if (id === "leaf") this.tempLeaf = Math.max(this.tempLeaf, 9999);
    if (id === "star") this.invuln = Math.max(this.invuln, 4);
    this.onSfx?.("power");
  }

  setPaused(v: boolean) {
    this.paused = v;
  }

  levelDef(): RunLevelDef {
    return getRunLevel(this.level);
  }

  private applyMushroomSize() {
    if (this.powers.includes("mushroom")) {
      this.player.w = 28;
      this.player.h = 42;
      this.baseHp = 2;
      if (this.player.hp < 2) this.player.hp = 2;
    } else {
      this.baseHp = 1;
    }
  }

  private loadLevel(id: number, fresh: boolean) {
    this.level = Math.max(1, Math.min(4, id));
    const lv = this.levelDef();
    this.worldLen = lv.worldLen;
    this.arenaStart = lv.worldLen;
    this.totalLen = lv.worldLen + lv.arenaW;
    this.checkpointX = lv.checkpointX;
    this.reachedCheckpoint = false;
    this.platforms = [];
    this.bricks = [];
    this.coins = [];
    this.enemies = [];
    this.fireballs = [];
    this.pickups = [];
    this.spheres = [];
    this.boss = null;
    this.inBoss = false;
    this.camX = 0;
    this.player.x = 40;
    this.player.y = this.h - 80;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.onGround = false;
    if (!fresh) {
      this.player.hp = Math.max(this.player.hp, this.baseHp);
    }
    this.buildLevel(lv);
    this.levelBanner = fresh && id === 1 ? 1.8 : 2.1;
    this.bossBanner = 0;
  }

  private buildLevel(lv: RunLevelDef) {
    this.groundY = this.h - 40;
    const groundY = this.groundY;
    this.platforms.push({ x: 0, y: groundY, w: this.totalLen, h: 40 });

    const pads: [number, number, number][] = [];
    const span = this.worldLen - 280;
    for (let i = 0; i < lv.padCount; i++) {
      const t = (i + 1) / (lv.padCount + 1);
      const x = 140 + t * span + (i % 3) * 22;
      const heightBand = 72 + (i % 5) * 26 + (lv.id - 1) * 6;
      const y = groundY - heightBand;
      const w = 70 + (i % 4) * 20 - (lv.id > 2 && i % 5 === 0 ? 14 : 0);
      pads.push([x, y, Math.max(52, w)]);
    }
    for (const [x, y, w] of pads) {
      this.platforms.push({ x, y, w, h: 14 });
    }

    // Brick / question clusters — climbable and smashable from below
    const lootCycle: PickupKind[] = ["mushroom", "fire", "star", "leaf", "magnet", "boost"];
    for (let c = 0; c < lv.brickClusters; c++) {
      const baseX = 220 + (c / lv.brickClusters) * (this.worldLen - 400) + (c % 2) * 40;
      const rowY = groundY - (110 + (c % 3) * 48);
      const cols = 3 + (c % 3);
      for (let j = 0; j < cols; j++) {
        const kind: BrickKind =
          j === Math.floor(cols / 2)
            ? "question"
            : c % 2 === 0 && j % 2 === 0
              ? "breakable"
              : "solid";
        const loot =
          kind === "question" || kind === "breakable"
            ? lootCycle[(c + j) % lootCycle.length]
            : undefined;
        this.bricks.push({
          x: baseX + j * TILE,
          y: rowY,
          w: TILE,
          h: TILE,
          kind,
          loot,
          bump: 0,
        });
      }
      // Second row for climbing
      if (c % 2 === 1) {
        this.bricks.push({
          x: baseX + TILE,
          y: rowY - TILE - 4,
          w: TILE,
          h: TILE,
          kind: "question",
          loot: lootCycle[(c + 2) % lootCycle.length],
          bump: 0,
        });
      }
    }

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
    for (let i = 0; i < lv.rareAwnCount; i++) {
      this.coins.push({
        x: 320 + i * Math.floor(this.worldLen / (lv.rareAwnCount + 1)),
        y: groundY - 200 - (i % 3) * 30,
        w: 20,
        h: 20,
        kind: "awn",
        bob: i,
      });
    }

    const spacing = Math.floor(this.worldLen / (lv.enemyCount + 1));
    for (let i = 0; i < lv.enemyCount; i++) {
      const spd = (40 + (i % 3) * 15 + lv.id * 8) * lv.enemySpeedMul;
      this.enemies.push({
        x: 220 + i * spacing,
        y: groundY - 24,
        w: 24,
        h: 24,
        vx: (i % 2 === 0 ? -1 : 1) * spd,
        alive: true,
      });
    }

    const kinds: PickupKind[] = ["magnet", "boost", "star", "fire"];
    for (let i = 0; i < lv.pickupCount; i++) {
      const pad = pads[i % pads.length];
      const kind = kinds[i % kinds.length]!;
      this.pickups.push({
        x: (pad?.[0] ?? 300) + 20 + (i % 2) * 30,
        y: (pad?.[1] ?? groundY - 100) - 36,
        w: 22,
        h: 22,
        kind,
        bob: i * 0.9,
        vx: 0,
        grounded: true,
      });
    }

    // Checkpoint flag platform
    this.platforms.push({
      x: lv.checkpointX - 40,
      y: groundY - 90,
      w: 80,
      h: 14,
    });
  }

  private spawnBoss() {
    if (this.boss) return;
    const lv = this.levelDef();
    const b = lv.boss;
    const aw = lv.arenaW;
    this.boss = {
      kind: b.kind,
      x: this.arenaStart + aw * 0.55,
      y: this.groundY - 90,
      w: 70,
      h: 80,
      hp: b.hp,
      maxHp: b.hp,
      shootTimer: 1.2,
      invuln: 0,
      phase: 0,
      alive: true,
    };
    this.inBoss = true;
    this.bossBanner = 2.4;
    this.onSfx?.("power");
  }

  private jumpPower() {
    let j = -420;
    if (this.powers.includes("mushroom")) j = -460;
    return j;
  }

  private moveSpeed() {
    let spd = this.powers.includes("mushroom") ? 200 : 175;
    if (this.tempBoost > 0) spd *= 1.35;
    return spd;
  }

  private canFire() {
    return this.hasFire();
  }

  private advanceOrWin() {
    if (this.level >= 4) {
      this.finish(true);
      return;
    }
    this.score += 200 + this.level * 75;
    this.onSfx?.("power");
    this.loadLevel(this.level + 1, false);
  }

  update(dt: number, input: RunInput) {
    if (this.over || this.paused) return;
    this.elapsed += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.fireCd = Math.max(0, this.fireCd - dt);
    this.levelBanner = Math.max(0, this.levelBanner - dt);
    this.bossBanner = Math.max(0, this.bossBanner - dt);
    this.tempMagnet = Math.max(0, this.tempMagnet - dt);
    this.tempBoost = Math.max(0, this.tempBoost - dt);
    // Permanent run powers stay at 9999; only timed pickups decay below that
    if (this.tempFire < 9000) this.tempFire = Math.max(0, this.tempFire - dt);
    if (this.tempLeaf < 9000) this.tempLeaf = Math.max(0, this.tempLeaf - dt);
    for (const b of this.bricks) {
      if (b.bump > 0) b.bump = Math.max(0, b.bump - dt * 4);
    }

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

    // Leaf glide: jump held OR action held when leaf equipped
    const gliding =
      this.hasLeaf() &&
      this.player.vy > 40 &&
      (input.jump || (input.action && !this.canFire()));
    if (gliding) {
      this.player.vy = Math.min(this.player.vy, 68);
    }

    // Action button: fireball when fire available
    if (input.action && this.canFire() && this.fireCd <= 0 && !this.actionLatch) {
      this.fireballs.push({
        x: this.player.x + this.player.w / 2,
        y: this.player.y + 10,
        vx: this.player.faces * 340,
        vy: 40,
        life: 1.6,
      });
      this.fireCd = 0.32;
      this.actionLatch = true;
      this.onSfx?.("boom");
    }
    if (!input.action) this.actionLatch = false;

    this.player.vy += 1100 * dt;
    if (input.down && !this.player.onGround) {
      this.player.vy += 400 * dt;
    }

    this.player.x += this.player.vx * dt;
    this.player.y += this.player.vy * dt;
    this.player.onGround = false;

    this.resolveSolidCollisions(dt);
    this.resolveBrickHits(dt);

    const maxX = this.inBoss
      ? this.totalLen - this.player.w - 8
      : this.totalLen - this.player.w;
    this.player.x = Math.max(0, Math.min(maxX, this.player.x));
    if (this.inBoss) {
      this.player.x = Math.max(this.arenaStart + 8, this.player.x);
    }

    if (this.player.y > this.h + 80) {
      if (this.reachedCheckpoint && !this.inBoss) {
        this.respawnAtCheckpoint();
      } else {
        this.finish(false);
      }
      return;
    }

    if (!this.reachedCheckpoint && this.player.x >= this.checkpointX) {
      this.reachedCheckpoint = true;
      this.score += 25;
    }

    // Enter boss arena
    if (!this.inBoss && this.player.x >= this.arenaStart - 20) {
      this.player.x = this.arenaStart + 40;
      this.spawnBoss();
    }

    this.updateCoins(dt);
    this.updatePickups(dt);
    this.updateEnemies(dt);
    this.updateFireballs(dt);
    this.updateBoss(dt);
    this.updateSpheres(dt);

    if (this.inBoss) {
      this.camX = Math.max(
        this.arenaStart - 20,
        Math.min(this.totalLen - this.w, this.arenaStart + 10),
      );
    } else {
      this.camX = Math.max(0, Math.min(this.totalLen - this.w, this.player.x - this.w * 0.35));
    }

    this.distance = Math.floor(this.player.x + (this.level - 1) * 6000);
  }

  private respawnAtCheckpoint() {
    this.player.x = this.checkpointX;
    this.player.y = this.groundY - this.player.h - 4;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.hp = Math.max(1, this.baseHp);
    this.invuln = 2;
    this.onSfx?.("hit");
  }

  private resolveSolidCollisions(dt: number) {
    const solids: Rect[] = [
      ...this.platforms,
      ...this.bricks.filter((b) => b.kind !== "breakable" || true),
    ];
    // All bricks are solid until broken (removed from array)
    for (const p of solids) {
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

    // Side / ceiling collisions with bricks
    for (const b of this.bricks) {
      if (!aabb(this.player, b)) continue;
      const overlapL = this.player.x + this.player.w - b.x;
      const overlapR = b.x + b.w - this.player.x;
      const overlapT = this.player.y + this.player.h - b.y;
      const overlapB = b.y + b.h - this.player.y;
      const minX = Math.min(overlapL, overlapR);
      const minY = Math.min(overlapT, overlapB);
      if (minX < minY) {
        if (overlapL < overlapR) this.player.x = b.x - this.player.w;
        else this.player.x = b.x + b.w;
        this.player.vx = 0;
      } else if (this.player.vy < 0 && overlapB < overlapT) {
        // handled in resolveBrickHits
      } else if (overlapT <= overlapB && this.player.vy >= 0) {
        this.player.y = b.y - this.player.h;
        this.player.vy = 0;
        this.player.onGround = true;
      }
    }
  }

  private resolveBrickHits(_dt: number) {
    if (this.player.vy >= 0) return;
    const head: Rect = {
      x: this.player.x + 4,
      y: this.player.y,
      w: this.player.w - 8,
      h: 8,
    };
    for (const b of this.bricks) {
      if (!aabb(head, b)) continue;
      if (this.player.y >= b.y + b.h - 14) {
        this.player.y = b.y + b.h;
        this.player.vy = 40;
        b.bump = 1;
        this.hitBrick(b);
        break;
      }
    }
  }

  private hitBrick(b: Brick) {
    if (b.kind === "solid" || b.kind === "empty") {
      this.onSfx?.("hit");
      return;
    }
    if (b.kind === "question") {
      if (b.loot) this.spawnLoot(b.x + b.w / 2 - 11, b.y - 28, b.loot);
      b.kind = "empty";
      b.loot = undefined;
      this.onSfx?.("power");
      this.score += 20;
      return;
    }
    if (b.kind === "breakable") {
      if (b.loot) this.spawnLoot(b.x + b.w / 2 - 11, b.y - 8, b.loot);
      this.onSfx?.("break");
      this.score += 15;
      this.bricks = this.bricks.filter((x) => x !== b);
    }
  }

  private spawnLoot(x: number, y: number, kind: PickupKind) {
    this.pickups.push({
      x,
      y,
      w: 22,
      h: 22,
      kind,
      bob: 0,
      vx: this.player.faces * 40,
      grounded: false,
    });
  }

  private updateCoins(dt: number) {
    if (this.tempMagnet > 0) {
      for (const c of this.coins) {
        const cx = c.x + c.w / 2;
        const cy = c.y + c.h / 2;
        const px = this.player.x + this.player.w / 2;
        const py = this.player.y + this.player.h / 2;
        const dx = px - cx;
        const dy = py - cy;
        const dist = Math.hypot(dx, dy);
        if (dist < 120 && dist > 1) {
          c.x += (dx / dist) * 220 * dt;
          c.y += (dy / dist) * 220 * dt;
        }
      }
    }
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
  }

  private updatePickups(dt: number) {
    this.pickups = this.pickups.filter((p) => {
      p.bob += dt;
      if (!p.grounded) {
        p.y -= 40 * dt;
        p.x += p.vx * dt;
        if (p.bob > 0.45) p.grounded = true;
      }
      if (!aabb(this.player, p)) return true;
      this.applyPickup(p.kind);
      this.onSfx?.("power");
      this.score += 30;
      return false;
    });
  }

  private updateEnemies(dt: number) {
    if (this.inBoss) return;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.x += e.vx * dt;
      if (e.x < 40 || e.x > this.worldLen - 40) e.vx *= -1;
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
        this.hurtPlayer(-220);
        if (this.over) return;
      }
    }
  }

  private updateFireballs(dt: number) {
    for (const f of this.fireballs) {
      f.x += f.vx * dt;
      f.vy += 600 * dt;
      f.y += f.vy * dt;
      f.life -= dt;
      if (f.y > this.groundY - 8) {
        f.y = this.groundY - 8;
        f.vy = -180;
      }
      for (const e of this.enemies) {
        if (e.alive && aabb({ x: f.x - 5, y: f.y - 5, w: 10, h: 10 }, e)) {
          e.alive = false;
          f.life = -1;
          this.score += 40;
          this.onSfx?.("boom");
        }
      }
      if (this.boss?.alive && this.boss.invuln <= 0) {
        if (
          aabb(
            { x: f.x - 5, y: f.y - 5, w: 10, h: 10 },
            { x: this.boss.x, y: this.boss.y, w: this.boss.w, h: this.boss.h },
          )
        ) {
          this.boss.hp -= 1;
          this.boss.invuln = 0.45;
          f.life = -1;
          this.score += 80;
          this.onSfx?.("boom");
          if (this.boss.hp <= 0) {
            this.boss.alive = false;
            this.boss.phase = 0;
            this.score += 300 + this.level * 100;
            this.onSfx?.("power");
          }
        }
      }
    }
    this.fireballs = this.fireballs.filter((f) => f.life > 0 && f.x > this.camX - 40 && f.x < this.camX + this.w + 80);
  }

  private updateBoss(dt: number) {
    if (!this.boss || !this.boss.alive) {
      if (this.inBoss && this.boss && !this.boss.alive) {
        this.boss.phase += dt;
        if (this.boss.phase > 1.2) {
          this.inBoss = false;
          this.advanceOrWin();
        }
      }
      return;
    }
    const lv = this.levelDef();
    const b = this.boss;
    b.invuln = Math.max(0, b.invuln - dt);
    b.phase += dt;
    // Bob / pace in arena
    const mid = this.arenaStart + lv.arenaW * 0.62;
    b.x = mid + Math.sin(b.phase * 1.1) * (lv.arenaW * 0.18);
    b.y = this.groundY - b.h - 8 + Math.sin(b.phase * 2.2) * 6;

    b.shootTimer -= dt;
    if (b.shootTimer <= 0) {
      b.shootTimer = lv.boss.shootCd;
      this.fireBossSpheres(lv);
    }

    // Contact damage
    if (
      this.invuln <= 0 &&
      aabb(this.player, { x: b.x, y: b.y, w: b.w, h: b.h })
    ) {
      this.hurtPlayer(-260);
    }
  }

  private fireBossSpheres(lv: RunLevelDef) {
    if (!this.boss) return;
    const n = lv.boss.sphereCount;
    const px = this.player.x + this.player.w / 2;
    const py = this.player.y + this.player.h / 2;
    const bx = this.boss.x + this.boss.w / 2;
    const by = this.boss.y + this.boss.h * 0.4;
    for (let i = 0; i < n; i++) {
      const ang =
        Math.atan2(py - by, px - bx) + (i - (n - 1) / 2) * 0.28;
      const spd = lv.boss.sphereSpeed;
      this.spheres.push({
        x: bx,
        y: by,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 4.5,
        r: 11,
      });
    }
    this.onSfx?.("hit");
  }

  private updateSpheres(dt: number) {
    this.spheres = this.spheres.filter((s) => {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      if (s.life <= 0) return false;
      if (this.invuln <= 0 && circleHit(s.x, s.y, s.r, this.player)) {
        this.hurtPlayer(this.player.faces * -80);
        return false;
      }
      return s.y < this.h + 40 && s.x > this.arenaStart - 80 && s.x < this.totalLen + 40;
    });
  }

  private hurtPlayer(knockVy: number) {
    this.player.hp -= 1;
    this.invuln = 1.25;
    this.player.vy = knockVy;
    this.onSfx?.("hit");
    if (this.player.hp <= 0) {
      if (this.reachedCheckpoint && !this.inBoss) {
        this.respawnAtCheckpoint();
      } else {
        this.finish(false);
      }
    }
  }

  private applyPickup(kind: PickupKind) {
    if (kind === "magnet") this.tempMagnet = Math.max(this.tempMagnet, 8);
    if (kind === "boost") this.tempBoost = Math.max(this.tempBoost, 6);
    if (kind === "star") this.invuln = Math.max(this.invuln, 4);
    if (kind === "fire") {
      if (this.powers.includes("fire_flower")) this.tempFire = 9999;
      else this.tempFire = Math.max(this.tempFire < 9000 ? this.tempFire : 0, 14);
    }
    if (kind === "leaf") {
      if (this.powers.includes("leaf")) this.tempLeaf = 9999;
      else this.tempLeaf = Math.max(this.tempLeaf < 9000 ? this.tempLeaf : 0, 16);
    }
    if (kind === "mushroom") {
      if (!this.powers.includes("mushroom")) this.powers.push("mushroom");
      this.applyMushroomSize();
      this.player.hp = Math.max(this.player.hp, this.baseHp);
    }
  }

  private finish(won: boolean) {
    if (this.over) return;
    this.over = true;
    this.won = won;
    this.paused = false;
    this.onOver?.({
      score: this.score + (won ? 500 : 0),
      gold: this.gold,
      mined: this.mined,
      distance: this.distance,
      level: this.level,
      won,
    });
  }

  draw(ctx: CanvasRenderingContext2D) {
    const { w, h } = this;
    const lv = this.levelDef();
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, lv.bgTop);
    sky.addColorStop(0.55, lv.bgMid);
    sky.addColorStop(1, lv.bgBot);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = `${lv.accent}18`;
    for (let i = 0; i < 6; i++) {
      const hx = ((i * 300 - this.camX * 0.25) % (w + 320)) - 80;
      ctx.beginPath();
      ctx.ellipse(hx, h - 28, 130, 55, 0, Math.PI, 0);
      ctx.fill();
    }

    ctx.save();
    ctx.translate(-this.camX, 0);

    for (const p of this.platforms) {
      const g = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h);
      g.addColorStop(0, lv.platformTop);
      g.addColorStop(1, lv.platformBot);
      ctx.fillStyle = g;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = `${lv.accent}59`;
      ctx.fillRect(p.x, p.y, p.w, 3);
    }

    for (const b of this.bricks) {
      this.drawBrick(ctx, b, lv);
    }

    // Checkpoint
    if (!this.inBoss) {
      const cx = this.checkpointX;
      ctx.fillStyle = this.reachedCheckpoint ? "#b8ff3c" : "#7df9ff";
      ctx.fillRect(cx, this.groundY - 70, 5, 70);
      ctx.beginPath();
      ctx.moveTo(cx + 5, this.groundY - 70);
      ctx.lineTo(cx + 36, this.groundY - 58);
      ctx.lineTo(cx + 5, this.groundY - 46);
      ctx.fill();
    }

    // Arena gate hint
    if (!this.inBoss) {
      ctx.fillStyle = lv.accent;
      ctx.fillRect(this.arenaStart - 8, this.h - 160, 6, 120);
      ctx.font = "700 10px Rajdhani,sans-serif";
      ctx.fillText("BOSS", this.arenaStart - 18, this.h - 168);
    }

    for (const c of this.coins) {
      const by = c.y + Math.sin(c.bob * 4) * 3;
      if (c.kind === "gold") this.drawGoldCoin(ctx, c.x + 9, by + 9);
      else this.drawAwnCoin(ctx, c.x + 9, by + 9);
    }

    for (const p of this.pickups) {
      const by = p.y + Math.sin(p.bob * 5) * 4;
      this.drawPickup(ctx, p.x + 11, by + 11, p.kind, lv.accent);
    }

    for (const e of this.enemies) {
      if (!e.alive || this.inBoss) continue;
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

    for (const s of this.spheres) {
      const g = ctx.createRadialGradient(s.x - 3, s.y - 3, 1, s.x, s.y, s.r);
      g.addColorStop(0, "#fff");
      g.addColorStop(0.4, lv.boss.accent);
      g.addColorStop(1, lv.boss.color);
      ctx.fillStyle = g;
      ctx.shadowColor = lv.boss.accent;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    if (this.boss) this.drawBoss(ctx, this.boss, lv);

    if (this.invuln <= 0 || Math.floor(this.elapsed * 14) % 2 === 0) {
      this.drawPlayer(ctx);
    }

    ctx.restore();

    // HUD
    ctx.fillStyle = "rgba(8,2,18,0.72)";
    ctx.fillRect(8, 8, w - 16, 52);
    ctx.fillStyle = "#ffd700";
    ctx.font = "700 12px Rajdhani,sans-serif";
    ctx.fillText(`GOLD ×${this.gold}`, 16, 26);
    ctx.fillStyle = "#7df9ff";
    ctx.fillText(`$AWN ×${this.mined}`, 100, 26);
    ctx.fillStyle = "#ff2bd6";
    ctx.fillText(`SCORE ${this.score}`, 16, 44);
    ctx.fillStyle = lv.accent;
    ctx.fillText(`L${this.level}/4`, w - 118, 26);
    ctx.fillStyle = "#b8ff3c";
    ctx.fillText(`HP ${this.player.hp}`, w - 58, 26);

    const buffs: string[] = [];
    if (this.hasFire()) buffs.push("FIRE");
    if (this.hasLeaf()) buffs.push("LEAF");
    if (this.tempMagnet > 0 && this.tempMagnet < 9000) buffs.push(`MAG`);
    if (this.tempBoost > 0) buffs.push(`SPD`);
    if (this.invuln > 0.2) buffs.push(`★`);
    if (buffs.length) {
      ctx.fillStyle = "rgba(125,249,255,0.9)";
      ctx.font = "600 11px Rajdhani,sans-serif";
      ctx.fillText(buffs.join(" · "), 100, 44);
    }

    if (this.boss?.alive) {
      const barW = w - 48;
      const pct = this.boss.hp / this.boss.maxHp;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(24, 66, barW, 12);
      ctx.fillStyle = lv.boss.accent;
      ctx.fillRect(24, 66, barW * pct, 12);
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.strokeRect(24, 66, barW, 12);
      ctx.fillStyle = "#fff";
      ctx.font = "700 10px Rajdhani,sans-serif";
      ctx.fillText(`${lv.boss.nameIt}  ${this.boss.hp}/${this.boss.maxHp}`, 28, 76);
      if (!this.hasFire()) {
        ctx.fillStyle = "#ff9f1c";
        ctx.font = "700 11px Rajdhani,sans-serif";
        ctx.fillText("⚠ Fiore di fuoco richiesto · PAUSE", 24, 96);
      }
    }

    if (this.levelBanner > 0 && !this.over && !this.inBoss) {
      ctx.fillStyle = "rgba(8,2,18,0.55)";
      ctx.fillRect(0, h * 0.38, w, 54);
      ctx.textAlign = "center";
      ctx.fillStyle = lv.accent;
      ctx.font = "800 16px Orbitron,sans-serif";
      ctx.fillText(`LEVEL ${this.level}/4 · ${lv.name}`, w / 2, h * 0.38 + 34);
      ctx.textAlign = "left";
    }

    if (this.bossBanner > 0 && this.boss) {
      ctx.fillStyle = "rgba(8,2,18,0.6)";
      ctx.fillRect(0, h * 0.34, w, 64);
      ctx.textAlign = "center";
      ctx.fillStyle = lv.boss.accent;
      ctx.font = "800 17px Orbitron,sans-serif";
      ctx.fillText(lv.boss.nameIt.toUpperCase(), w / 2, h * 0.34 + 28);
      ctx.fillStyle = "#ffd7a0";
      ctx.font = "600 12px Rajdhani,sans-serif";
      ctx.fillText("Solo il fiore di fuoco danneggia il boss!", w / 2, h * 0.34 + 50);
      ctx.textAlign = "left";
    }

    if (this.paused) {
      ctx.fillStyle = "rgba(8,2,18,0.45)";
      ctx.fillRect(0, 0, w, h);
    }

    if (this.over) {
      ctx.fillStyle = "rgba(8,2,18,0.72)";
      ctx.fillRect(0, 0, w, h);
      ctx.textAlign = "center";
      ctx.fillStyle = this.won ? "#b8ff3c" : "#ff2bd6";
      ctx.font = "800 22px Orbitron,sans-serif";
      ctx.fillText(this.won ? "RUNAWAN CLEAR" : "RUN OVER", w / 2, h / 2 - 16);
      ctx.fillStyle = "#7df9ff";
      ctx.font = "600 13px Rajdhani,sans-serif";
      ctx.fillText(
        `L${this.level}/4 · Gold ${this.gold} · $AWN ${this.mined} · Score ${this.score}`,
        w / 2,
        h / 2 + 14,
      );
      ctx.textAlign = "left";
    }
  }

  private drawBrick(ctx: CanvasRenderingContext2D, b: Brick, lv: RunLevelDef) {
    const bumpY = b.bump > 0 ? -6 * b.bump : 0;
    const y = b.y + bumpY;
    if (b.kind === "question") {
      const g = ctx.createLinearGradient(b.x, y, b.x, y + b.h);
      g.addColorStop(0, "#ffd76a");
      g.addColorStop(1, "#c47820");
      ctx.fillStyle = g;
      ctx.fillRect(b.x, y, b.w, b.h);
      ctx.strokeStyle = "#fff3c0";
      ctx.strokeRect(b.x + 0.5, y + 0.5, b.w - 1, b.h - 1);
      ctx.fillStyle = "#5a2a00";
      ctx.font = "800 16px Orbitron,sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("?", b.x + b.w / 2, y + b.h / 2 + 1);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    } else if (b.kind === "empty") {
      ctx.fillStyle = "#6a5040";
      ctx.fillRect(b.x, y, b.w, b.h);
      ctx.strokeStyle = "#3a2818";
      ctx.strokeRect(b.x + 0.5, y + 0.5, b.w - 1, b.h - 1);
    } else {
      ctx.fillStyle = lv.brickColor;
      ctx.fillRect(b.x, y, b.w, b.h);
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.strokeRect(b.x + 0.5, y + 0.5, b.w - 1, b.h - 1);
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.beginPath();
      ctx.moveTo(b.x + 2, y + b.h / 2);
      ctx.lineTo(b.x + b.w - 2, y + b.h / 2);
      ctx.moveTo(b.x + b.w / 2, y + 2);
      ctx.lineTo(b.x + b.w / 2, y + b.h - 2);
      ctx.stroke();
      if (b.kind === "breakable") {
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.fillRect(b.x + 4, y + 4, 6, 6);
      }
    }
  }

  private drawBoss(ctx: CanvasRenderingContext2D, boss: BossState, lv: RunLevelDef) {
    const flash = boss.invuln > 0 && Math.floor(this.elapsed * 20) % 2 === 0;
    if (flash) return;
    const cx = boss.x + boss.w / 2;
    const cy = boss.y + boss.h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    const col = lv.boss.color;
    const acc = lv.boss.accent;

    if (boss.kind === "octopus") {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(0, -8, 32, 28, 0, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI - Math.PI * 0.1;
        const tx = Math.cos(a) * 28;
        const ty = 18 + Math.sin(this.elapsed * 3 + i) * 6;
        ctx.strokeStyle = acc;
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 10, 10);
        ctx.quadraticCurveTo(tx * 0.6, ty + 10, tx, ty + 22);
        ctx.stroke();
      }
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(-10, -12, 7, 0, Math.PI * 2);
      ctx.arc(10, -12, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1a0820";
      ctx.beginPath();
      ctx.arc(-9, -11, 3, 0, Math.PI * 2);
      ctx.arc(11, -11, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (boss.kind === "werewolf") {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(0, 4, 26, 34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-18, -28);
      ctx.lineTo(-8, -48);
      ctx.lineTo(-2, -26);
      ctx.moveTo(18, -28);
      ctx.lineTo(8, -48);
      ctx.lineTo(2, -26);
      ctx.fill();
      ctx.fillStyle = "#ff6b6b";
      ctx.beginPath();
      ctx.arc(-10, -8, 4, 0, Math.PI * 2);
      ctx.arc(10, -8, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = acc;
      ctx.fillRect(-8, 8, 16, 6);
    } else if (boss.kind === "medusa") {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(0, 0, 28, 36, 0, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI * 0.85 + (i / 6) * Math.PI * 0.9;
        ctx.strokeStyle = acc;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 18, Math.sin(a) * 20 - 10);
        ctx.quadraticCurveTo(
          Math.cos(a) * 36,
          Math.sin(a) * 30 - 20 + Math.sin(this.elapsed * 5 + i) * 8,
          Math.cos(a) * 42,
          Math.sin(a) * 18 - 8,
        );
        ctx.stroke();
      }
      ctx.fillStyle = "#ffe08a";
      ctx.beginPath();
      ctx.arc(-9, -4, 5, 0, Math.PI * 2);
      ctx.arc(9, -4, 5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // minotaur
      ctx.fillStyle = col;
      ctx.fillRect(-28, -20, 56, 55);
      ctx.beginPath();
      ctx.arc(0, -28, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = acc;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-16, -36);
      ctx.quadraticCurveTo(-40, -60, -28, -20);
      ctx.moveTo(16, -36);
      ctx.quadraticCurveTo(40, -60, 28, -20);
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.fillRect(-12, -32, 8, 6);
      ctx.fillRect(4, -32, 8, 6);
    }
    ctx.restore();
  }

  private drawPickup(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    kind: PickupKind,
    accent: string,
  ) {
    ctx.save();
    ctx.translate(x, y);
    ctx.shadowColor = accent;
    ctx.shadowBlur = 12;
    const colors: Record<PickupKind, string> = {
      magnet: "#7df9ff",
      boost: "#b8ff3c",
      star: "#ffd700",
      fire: "#ff9f1c",
      mushroom: "#ff6b8a",
      leaf: "#7dffb0",
    };
    ctx.fillStyle = colors[kind];
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#12061f";
    ctx.font = "800 9px Orbitron,sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const glyph =
      kind === "magnet"
        ? "M"
        : kind === "boost"
          ? "S"
          : kind === "star"
            ? "★"
            : kind === "fire"
              ? "F"
              : kind === "mushroom"
                ? "🍄"
                : "🍃";
    ctx.fillText(glyph, 0, 1);
    ctx.restore();
  }

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
    if (spin > 0.55) {
      ctx.fillStyle = "#8b6914";
      ctx.font = "800 11px Orbitron,sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("$", 0, 1);
    }
    ctx.restore();
  }

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
    if (jumpSquash > 0.05) {
      ctx.translate(cx, footY);
      ctx.scale(1 - jumpSquash * 0.08, 1 + jumpSquash * 0.06);
      ctx.translate(-cx, -footY);
    }

    const legW = bodyW * 0.32;
    const legGap = bodyW * 0.12;
    const legSwing = walk * 5;
    ctx.fillStyle = "#5c3a1e";
    ctx.fillRect(cx - legGap - legW - (dir > 0 ? legSwing : -legSwing) * 0.3, bodyBot - 1, legW, legH + 2);
    ctx.fillRect(cx + legGap + (dir > 0 ? legSwing : -legSwing) * 0.3, bodyBot - 1, legW, legH + 2);
    ctx.fillStyle = "#2a180c";
    ctx.fillRect(cx - legGap - legW - 1, footY - 4, legW + 2, 4);
    ctx.fillRect(cx + legGap - 1, footY - 4, legW + 2, 4);

    const bx = cx - bodyW / 2;
    const jacket = ctx.createLinearGradient(bx, bodyTop, bx, bodyBot);
    jacket.addColorStop(0, this.hasFire() ? "#c45a2b" : "#8b5a2b");
    jacket.addColorStop(1, "#5c3a1e");
    ctx.fillStyle = jacket;
    ctx.fillRect(bx, bodyTop, bodyW, bodyH);
    ctx.fillStyle = this.hasFire() ? "#ff9f1c" : "#7eb8e8";
    ctx.fillRect(cx - bodyW * 0.16, bodyTop + 2, bodyW * 0.32, bodyH * 0.55);

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

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, headCy, headR, 0, Math.PI * 2);
    ctx.clip();
    if (this.logo && this.logo.complete && this.logo.naturalWidth > 0) {
      const lw = this.logo.naturalWidth;
      const lh = this.logo.naturalHeight;
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
      ctx.fillStyle = "#e8b896";
      ctx.fillRect(cx - headR, headCy - headR, headR * 2, headR * 2);
    }
    ctx.restore();

    if (this.hasLeaf()) {
      ctx.fillStyle = "#7dffb0";
      ctx.beginPath();
      ctx.ellipse(cx - dir * 4, headCy - headR - 2, 10, 4, dir * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "#5c3a1e";
    ctx.beginPath();
    ctx.ellipse(cx + dir * 1, headCy - headR * 0.55, headR * 0.95, headR * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
