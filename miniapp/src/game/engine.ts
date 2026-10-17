import type { AppliedStats } from "../lib/upgrades";
import { getDifficulty, type DifficultyDef, type DifficultyId } from "./difficulty";
import { drawJet, getShip, type ShipId, type WeaponId } from "./ships";
import {
  getSiegeLevel,
  SIEGE_REWARD,
  type SiegeLevelDef,
} from "./siegeLevels";

export type GameInput = {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  fire: boolean;
  pauseToggle: boolean;
  /** Trigger bomb (edge-triggered via latch). */
  bomb: boolean;
  /** Canvas pointer (mouse/touch) — ship eases toward this point when set. */
  aimX: number | null;
  aimY: number | null;
};

export type GameOverPayload = {
  score: number;
  wave: number;
  level: number;
  minedAwn: number;
};

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
  homing?: boolean;
  laser?: boolean;
};

type Enemy = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  kind: "fighter" | "bomber" | "ace" | "miniboss" | "boss" | "superboss";
  style: number;
  color: string;
  accent: string;
  phase: number;
  score: number;
  w: number;
  h: number;
};

export type PowerKind = "shield" | "rapid" | "weapon";
type Powerup = { x: number; y: number; kind: PowerKind; life: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string };

export const POWER_INFO: Record<
  PowerKind,
  { label: string; short: string; color: string; effect: string }
> = {
  shield: {
    label: "SCUDO",
    short: "Sphere",
    color: "#7df9ff",
    effect: "Sfera scudo — si rompe al colpo",
  },
  rapid: {
    label: "RAPID",
    short: "Fire+",
    color: "#ff2bd6",
    effect: "Cadenza ×1.8 per 6s (non stack)",
  },
  weapon: {
    label: "ARMA+",
    short: "Tier+",
    color: "#b8ff3c",
    effect: "Potenzia arma di 1 livello",
  },
};

/**
 * Weapon tier 0..4 (mega-brief):
 * 0 single → 1 double → 2 triple → 3 triple+missile → 4 four beams + missile.
 * Hit demotes one tier. Powerups only upgrade (never downgrade).
 */
export const WEAPON_TIER_MAX = 4;

/**
 * Enemy durability vs powered weapons.
 *
 * weaponFactor = ship.baseDamage * upgradeDamageMul * tierDpsMul * tempPowerMul
 * levelFactor  = 1 + (level - 1) * 0.28
 * hp = baseHp * diff.enemyHp * levelFactor * (0.65 + 0.55 * weaponFactor)
 *
 * So stronger weapons / higher levels → tougher enemies (no trivial melt).
 */
export function enemyHpScale(
  baseHp: number,
  diffHp: number,
  level: number,
  weaponFactor: number,
): number {
  const levelFactor = 1 + (Math.max(1, level) - 1) * 0.28;
  const weaponToughness = 0.65 + 0.55 * Math.max(0.5, weaponFactor);
  return Math.max(1, baseHp * diffHp * levelFactor * weaponToughness);
}

export class NeonSiegeEngine {
  w: number;
  h: number;
  shipId: ShipId;
  stats: AppliedStats;
  diff: DifficultyDef;
  difficultyId: DifficultyId;

  player = { x: 0, y: 0, shields: 1, invuln: 0, hasShieldSphere: false };
  bullets: Bullet[] = [];
  enemies: Enemy[] = [];
  powerups: Powerup[] = [];
  particles: Particle[] = [];
  floats: FloatText[] = [];
  score = 0;
  wave = 1;
  /** 1..4 sequential campaign levels. */
  level = 1;
  /** 0..1 progress within current level (bomb adds +0.5). */
  levelProgress = 0;
  /** Weapon upgrade tier 0..4. */
  weaponTier = 0;
  minedAwn = 0;
  awnFlash = 0;
  scroll = 0;
  fireCd = 0;
  rapidUntil = 0;
  paused = false;
  over = false;
  elapsed = 0;
  spawnT = 0;
  autoFire = true;
  activeWeaponNote = "";
  /** Armed bomb charges this match (0 or 1). */
  bombReady = 0;
  /** True after bomb detonated or purchase slot consumed for match. */
  bombUsedThisMatch = false;
  /** True after TonConnect purchase succeeded this match. */
  bombPurchasedThisMatch = false;
  private pauseLatch = false;
  private bombLatch = false;
  private bossSpawned = false;
  private transitioning = false;
  private transitionT = 0;
  private levelClearBanner = 0;

  onGameOver?: (p: GameOverPayload) => void;
  onSfx?: (kind: "shoot" | "hit" | "power" | "boom" | "awn" | "bomb") => void;
  /** UI can show buy-bomb prompt when player taps bomb without a charge. */
  onBombNeedPurchase?: () => void;

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
    this.refreshWeaponNote();
  }

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
  }

  levelDef(): SiegeLevelDef {
    return getSiegeLevel(this.level);
  }

  /** Grant one bomb after successful 2 TON → keeper payment (max 1/match). */
  grantPurchasedBomb(): boolean {
    if (this.bombPurchasedThisMatch || this.bombUsedThisMatch) return false;
    this.bombPurchasedThisMatch = true;
    this.bombReady = 1;
    this.floats.push({
      x: this.w / 2,
      y: this.h * 0.4,
      life: 1.6,
      text: "BOMB ARMED",
      color: "#ff9f1c",
    });
    return true;
  }

  private ship() {
    return getShip(this.shipId);
  }

  /**
   * Relative DPS / punch vs stock Viper (dmg 1, tier 0).
   * Used both for shoot damage and enemy HP toughness.
   */
  private weaponFactor(): number {
    const ship = this.ship();
    const tierMul = 1 + this.weaponTier * 0.38;
    let temp = 1;
    if (this.elapsed < this.rapidUntil) temp *= 1.35;
    return ship.baseDamage * this.stats.damageMul * this.diff.playerDmg * tierMul * temp;
  }

  private fireInterval() {
    const base = this.ship().baseFireMs / this.stats.fireRateMul;
    let mul = 1;
    if (this.elapsed < this.rapidUntil) mul *= 0.55;
    // Higher tiers shoot a bit faster but not broken
    mul *= Math.max(0.72, 1 - this.weaponTier * 0.04);
    return base * mul;
  }

  private damage() {
    let d = this.ship().baseDamage * this.stats.damageMul * this.diff.playerDmg;
    d *= 1 + this.weaponTier * 0.22;
    if (this.elapsed < this.rapidUntil) d *= 1.1;
    return d;
  }

  private refreshWeaponNote() {
    const labels = [
      "T0 · Colpo singolo",
      "T1 · Doppia canna",
      "T2 · Triplo ventaglio",
      "T3 · Triplo + missile",
      "T4 · 4 laser + missile",
    ];
    const shipNote = this.ship().weaponLabel.split("—")[0]?.trim() ?? "Arma";
    this.activeWeaponNote = `${shipNote} · ${labels[this.weaponTier] ?? "T0"}`;
  }

  private scaleEnemyHp(baseHp: number): number {
    return enemyHpScale(baseHp, this.diff.enemyHp, this.level, this.weaponFactor());
  }

  private awardAwn(amount: number, x: number, y: number) {
    if (amount <= 0) return;
    this.minedAwn = Math.round((this.minedAwn + amount) * 10) / 10;
    this.awnFlash = 1.1;
    this.floats.push({
      x,
      y: y - 10,
      life: 1.45,
      text: `+${amount} $AWN`,
      color: "#b8ff3c",
    });
    this.explode(x, y, "#b8ff3c", 12);
    this.onSfx?.("awn");
  }

  private spawnEnemy(
    kind: Enemy["kind"],
    x?: number,
    y?: number,
  ): Enemy {
    const lv = this.levelDef();
    const es = this.diff.enemySpeed;
    const palette = [
      { color: lv.enemyTint, accent: lv.accent },
      { color: "#6b3a5c", accent: "#ff2bd6" },
      { color: "#3d5c45", accent: "#b8ff3c" },
      { color: "#5c4a7a", accent: "#c77dff" },
    ][Math.floor(Math.random() * 4)]!;

    const hpBase =
      kind === "superboss"
        ? 55 + this.level * 18 + this.wave * 2
        : kind === "boss"
          ? 36 + this.level * 10 + this.wave * 3
          : kind === "miniboss"
            ? 22 + this.level * 6 + this.wave
            : kind === "ace"
              ? 8 + this.wave * 0.55
              : kind === "bomber"
                ? 6 + this.wave * 0.45
                : 3 + this.wave * 0.28;

    const hp = this.scaleEnemyHp(hpBase);
    const scoreBase =
      kind === "superboss"
        ? 1200 + this.level * 200
        : kind === "boss"
          ? 700 + this.wave * 50
          : kind === "miniboss"
            ? 400
            : kind === "ace"
              ? 120
              : kind === "bomber"
                ? 90
                : 45;

    const isBig = kind === "boss" || kind === "superboss" || kind === "miniboss";
    return {
      x: x ?? 36 + Math.random() * (this.w - 72),
      y: y ?? -30 - Math.random() * 80,
      vx: (Math.random() - 0.5) * (kind === "ace" ? 160 : kind === "superboss" ? 40 : 50) * es,
      vy:
        (kind === "superboss" || kind === "boss"
          ? 28
          : kind === "miniboss"
            ? 36
            : kind === "bomber"
              ? 48
              : 62 + Math.random() * 30 + this.wave * 1.5) * es,
      hp,
      maxHp: hp,
      kind,
      style: 1 + Math.floor(Math.random() * 6),
      color:
        kind === "superboss"
          ? "#7a1020"
          : kind === "boss"
            ? "#5a1a7a"
            : kind === "miniboss"
              ? "#1a4a6a"
              : palette.color,
      accent:
        kind === "superboss"
          ? "#ff9f1c"
          : kind === "boss"
            ? "#ff2bd6"
            : kind === "miniboss"
              ? "#7df9ff"
              : palette.accent,
      phase: Math.random() * Math.PI * 2,
      score: Math.floor(scoreBase * this.diff.scoreMul),
      w: kind === "superboss" ? 64 : kind === "boss" ? 52 : kind === "miniboss" ? 40 : kind === "bomber" ? 28 : 22,
      h: kind === "superboss" ? 48 : kind === "boss" ? 40 : kind === "miniboss" ? 34 : 26,
    };
  }

  private spawnWave() {
    if (this.transitioning || this.bossSpawned) return;

    const lv = this.levelDef();
    // End-of-level boss when progress full
    if (this.levelProgress >= 1) {
      this.spawnLevelBoss();
      return;
    }

    const n = Math.max(
      2,
      Math.min(Math.floor((3 + Math.floor(this.wave * 0.9)) * this.diff.spawnMul), 11),
    );
    for (let i = 0; i < n; i++) {
      let kind: Enemy["kind"] = "fighter";
      // Occasional miniboss mid-level
      if (i === 0 && this.wave % 3 === 0 && this.levelProgress > 0.25 && this.levelProgress < 0.95) {
        kind = "miniboss";
      } else if (Math.random() > 0.82) kind = "ace";
      else if (Math.random() > 0.55) kind = "bomber";
      this.enemies.push(this.spawnEnemy(kind, undefined, -30 - Math.random() * 90 - i * 22));
    }

    this.wave += 1;
    this.levelProgress = Math.min(1, this.levelProgress + 1 / Math.max(1, lv.wavesToBoss));
  }

  private spawnLevelBoss() {
    if (this.bossSpawned) return;
    this.bossSpawned = true;
    this.enemies = this.enemies.filter((e) => e.kind === "superboss" || e.kind === "boss");
    // Easy: no superboss — regular boss only
    const kind: Enemy["kind"] =
      this.difficultyId === "easy" ? "boss" : "superboss";
    // 1v1 arena: clear fodder, center boss
    this.enemies = [];
    this.enemies.push(this.spawnEnemy(kind, this.w / 2, -40));
    this.floats.push({
      x: this.w / 2,
      y: this.h * 0.28,
      life: 2,
      text: kind === "superboss" ? "SUPER BOSS" : "BOSS",
      color: kind === "superboss" ? "#ff9f1c" : "#ff2bd6",
    });
  }

  private startLevelTransition() {
    this.transitioning = true;
    this.transitionT = 0;
    this.bossSpawned = false;
    this.levelClearBanner = 2.2;
    this.enemies = [];
    this.bullets = this.bullets.filter((b) => b.ally);
  }

  private finishLevelTransition() {
    if (this.level >= 4) {
      // Campaign complete — victory via surviving; keep endless wave pressure lightly
      this.level = 4;
      this.levelProgress = 0;
      this.transitioning = false;
      this.floats.push({
        x: this.w / 2,
        y: this.h * 0.35,
        life: 2.5,
        text: "CORE CLEARED",
        color: "#b8ff3c",
      });
      return;
    }
    this.level += 1;
    this.levelProgress = 0;
    this.transitioning = false;
    this.player.y = this.h + 40;
    this.floats.push({
      x: this.w / 2,
      y: this.h * 0.32,
      life: 2,
      text: `LEVEL ${this.level} · ${this.levelDef().nameIt}`,
      color: this.levelDef().accent,
    });
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

  /** Detonate bomb: clear enemies, +20 $AWN, +0.5 level progress. */
  private detonateBomb() {
    if (this.bombReady <= 0 || this.over || this.transitioning) return;
    this.bombReady = 0;
    this.bombUsedThisMatch = true;
    this.onSfx?.("bomb");

    for (const e of this.enemies) {
      this.score += Math.floor(e.score * 0.5);
      this.explode(e.x, e.y, "#ff9f1c", e.kind === "superboss" ? 36 : 18);
    }
    this.enemies = [];
    this.bullets = this.bullets.filter((b) => b.ally);
    this.awardAwn(SIEGE_REWARD.bomb, this.player.x, this.player.y - 20);
    this.levelProgress = Math.min(1, this.levelProgress + 0.5);
    this.floats.push({
      x: this.w / 2,
      y: this.h * 0.38,
      life: 1.8,
      text: "BOMB · +½ LVL",
      color: "#ff9f1c",
    });
    // Screen flash particles
    for (let i = 0; i < 40; i++) {
      this.explode(Math.random() * this.w, Math.random() * this.h * 0.7, "#ff9f1c", 1);
    }
  }

  private tryBombInput(input: GameInput) {
    if (input.bomb && !this.bombLatch) {
      this.bombLatch = true;
      if (this.bombReady > 0) {
        this.detonateBomb();
      } else if (!this.bombPurchasedThisMatch && !this.bombUsedThisMatch) {
        this.onBombNeedPurchase?.();
      }
    } else if (!input.bomb) {
      this.bombLatch = false;
    }
  }

  private shoot() {
    const dmg = this.damage();
    const ship = this.ship();
    const tier = this.weaponTier;
    const col =
      ship.weapon === "rail_lance"
        ? "#c77dff"
        : ship.weapon === "plasma_arc"
          ? "#ff9f1c"
          : ship.weapon === "spread_burst"
            ? "#b8ff3c"
            : ship.weapon === "twin_cannon"
              ? "#7df9ff"
              : "#ff2bd6";

    const mk = (
      ox: number,
      ovy = -440,
      ovx = 0,
      bw = 3,
      bh = 11,
      extra?: Partial<Bullet>,
    ) => {
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
        ...extra,
      });
    };

    // Ship-flavored patterns by weapon identity at each tier
    const flavor = ship.weapon as WeaponId;

    if (tier <= 0) {
      mk(0, flavor === "rail_lance" ? -520 : -440, 0, flavor === "rail_lance" ? 5 : 3, flavor === "rail_lance" ? 18 : 11);
    } else if (tier === 1) {
      mk(-8);
      mk(8);
    } else if (tier === 2) {
      mk(0, -430);
      mk(-12, -400, -55);
      mk(12, -400, 55);
    } else if (tier === 3) {
      mk(0, -430);
      mk(-12, -400, -55);
      mk(12, -400, 55);
      mk(0, -380, 0, 4, 10, { homing: true, color: "#ff9f1c" });
    } else {
      // Max T4: 4 continuous-style beams + 1 missile (ship accent)
      const laser = flavor === "rail_lance" || flavor === "plasma_arc";
      const beamH = laser ? 22 : 14;
      const beamW = laser ? 4 : 3;
      mk(-18, -500, -12, beamW, beamH, { laser: true });
      mk(-6, -520, -4, beamW, beamH, { laser: true });
      mk(6, -520, 4, beamW, beamH, { laser: true });
      mk(18, -500, 12, beamW, beamH, { laser: true });
      mk(0, -360, 0, 5, 12, { homing: true, color: "#ff9f1c" });
      // Last missile hits harder
      const last = this.bullets[this.bullets.length - 1];
      if (last) last.dmg = dmg * 1.35;
    }
  }

  private onPlayerHit() {
    // Shield sphere absorbs one hit without demoting weapon
    if (this.player.hasShieldSphere) {
      this.player.hasShieldSphere = false;
      this.player.invuln = 0.9;
      this.explode(this.player.x, this.player.y, "#7df9ff", 14);
      this.onSfx?.("power");
      return;
    }
    this.player.shields -= 1;
    this.player.invuln = 1.15;
    // Hit demotes weapon one tier
    if (this.weaponTier > 0) {
      this.weaponTier -= 1;
      this.refreshWeaponNote();
      this.floats.push({
        x: this.player.x,
        y: this.player.y - 28,
        life: 1.1,
        text: "ARMA -1",
        color: "#ff4d6d",
      });
    }
    this.explode(this.player.x, this.player.y, "#ff2bd6", 16);
    if (this.player.shields < 0) {
      this.over = true;
      this.onGameOver?.({
        score: this.score,
        wave: this.wave,
        level: this.level,
        minedAwn: this.minedAwn,
      });
    }
  }

  private onEnemyKilled(e: Enemy) {
    this.score += e.score;
    this.explode(e.x, e.y, e.accent, e.kind === "superboss" ? 36 : e.kind === "boss" ? 28 : 14);
    this.onSfx?.("boom");

    if (e.kind === "miniboss") {
      this.awardAwn(SIEGE_REWARD.miniboss, e.x, e.y);
    } else if (e.kind === "superboss" || e.kind === "boss") {
      if (e.kind === "superboss") this.awardAwn(SIEGE_REWARD.superboss, e.x, e.y);
      else this.awardAwn(SIEGE_REWARD.miniboss, e.x, e.y); // easy boss still rewards
      this.startLevelTransition();
      return;
    }

    if (Math.random() < 0.32) {
      const kinds: PowerKind[] = ["shield", "rapid", "weapon"];
      this.powerups.push({
        x: e.x,
        y: e.y,
        kind: kinds[Math.floor(Math.random() * kinds.length)]!,
        life: 10,
      });
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
    this.levelClearBanner = Math.max(0, this.levelClearBanner - dt);

    this.tryBombInput(input);

    // Level transition: fly up off-screen, then re-enter from bottom
    if (this.transitioning) {
      this.transitionT += dt;
      this.player.y -= 220 * dt;
      if (this.transitionT > 1.1) {
        this.finishLevelTransition();
      }
      this.updateFx(dt);
      return;
    }

    // Re-entry ease after level bump
    if (this.player.y > this.h * 0.82) {
      this.player.y += (this.h * 0.82 - this.player.y) * Math.min(1, 4 * dt);
    }

    this.refreshWeaponNote();

    const spd = this.speed();
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
    if (!this.bossSpawned && (this.spawnT <= 0 || this.enemies.length === 0)) {
      this.spawnWave();
      this.spawnT = this.diff.waveGap + Math.random() * 2;
    }

    // Homing missiles
    for (const b of this.bullets) {
      if (b.ally && b.homing) {
        let best: Enemy | null = null;
        let bestD = 9999;
        for (const e of this.enemies) {
          const d = Math.hypot(e.x - b.x, e.y - b.y);
          if (d < bestD) {
            bestD = d;
            best = e;
          }
        }
        if (best) {
          const ang = Math.atan2(best.y - b.y, best.x - b.x);
          const sp = Math.hypot(b.vx, b.vy) || 420;
          b.vx = Math.cos(ang) * sp;
          b.vy = Math.sin(ang) * sp;
        }
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
    this.bullets = this.bullets.filter(
      (b) => b.y > -40 && b.y < this.h + 40 && b.x > -30 && b.x < this.w + 30,
    );

    for (const e of this.enemies) {
      e.phase += dt;
      if (e.kind === "ace") {
        e.x += Math.sin(e.phase * 3.2) * 100 * dt + e.vx * dt * 0.25;
        e.y += e.vy * dt;
      } else if (e.kind === "superboss" || e.kind === "boss" || e.kind === "miniboss") {
        e.x += Math.sin(e.phase * (e.kind === "superboss" ? 0.9 : 1.1)) * 70 * dt;
        e.y += e.vy * dt;
        if (e.y > this.h * 0.22) e.vy = Math.min(e.vy, 8);
        const fireRate =
          (e.kind === "superboss" ? 2.2 : e.kind === "boss" ? 1.5 : 1.1) * this.diff.enemyFireMul;
        if (Math.random() < dt * fireRate) {
          const spread = e.kind === "superboss" ? 3 : 1;
          for (let s = 0; s < spread; s++) {
            this.bullets.push({
              x: e.x + (s - (spread - 1) / 2) * 14,
              y: e.y + 18,
              vx: (Math.random() - 0.5) * (e.kind === "superboss" ? 90 : 50),
              vy: (220 + this.wave * 6) * this.diff.enemySpeed,
              dmg: 1,
              ally: false,
              w: e.kind === "superboss" ? 5 : 4,
              h: 9,
              color: e.kind === "superboss" ? "#ff9f1c" : "#ff4d6d",
            });
          }
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
          if (!b.laser) b.y = -999;
          this.explode(e.x, e.y - 4, b.color, 5);
          this.onSfx?.("hit");
          if (e.hp <= 0) this.onEnemyKilled(e);
        }
      }
    }
    this.enemies = this.enemies.filter((e) => e.hp > 0);

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
      if (hit) this.onPlayerHit();
    }

    for (const p of this.powerups) {
      p.y += 65 * dt;
      p.life -= dt;
      if (Math.hypot(p.x - this.player.x, p.y - this.player.y) < 26) {
        if (p.kind === "shield") this.player.hasShieldSphere = true;
        if (p.kind === "rapid") this.rapidUntil = this.elapsed + 6; // non-stackable refresh
        if (p.kind === "weapon") {
          this.weaponTier = Math.min(WEAPON_TIER_MAX, this.weaponTier + 1);
          this.refreshWeaponNote();
        }
        p.life = -1;
        this.explode(p.x, p.y, POWER_INFO[p.kind].color, 10);
        this.onSfx?.("power");
      }
    }
    this.powerups = this.powerups.filter((p) => p.life > 0 && p.y < this.h + 20);

    this.updateFx(dt);
  }

  private speed() {
    return this.ship().baseSpeed * this.stats.speedMul;
  }

  private updateFx(dt: number) {
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

  private depthScale(y: number) {
    const t = Math.max(0, Math.min(1, y / this.h));
    return 0.45 + t * 0.95;
  }

  draw(ctx: CanvasRenderingContext2D) {
    const { w, h } = this;
    const lv = this.levelDef();
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, lv.bgTop);
    g.addColorStop(0.35, lv.bgMid);
    g.addColorStop(1, lv.bgBot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2 + Math.sin(this.elapsed * 0.4) * 8;
    const horizon = h * 0.18;
    ctx.strokeStyle = `${lv.accent}38`;
    ctx.lineWidth = 1;
    for (let i = -6; i <= 6; i++) {
      ctx.beginPath();
      ctx.moveTo(cx, horizon);
      ctx.lineTo(cx + i * (w * 0.22), h + 20);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(125,249,255,0.18)";
    for (let i = 0; i < 14; i++) {
      const t = (i / 14 + this.scroll * 0.0007) % 1;
      const y = horizon + t * t * (h - horizon);
      const half = t * w * 0.48;
      ctx.beginPath();
      ctx.moveTo(cx - half, y);
      ctx.lineTo(cx + half, y);
      ctx.stroke();
    }

    for (let i = 0; i < 60; i++) {
      const depth = 0.3 + (i % 5) * 0.15;
      const sx = (i * 97 + Math.sin(this.elapsed + i) * 4) % w;
      const sy = (i * 53 + this.scroll * depth) % h;
      ctx.fillStyle = i % 3 === 0 ? "rgba(255,43,214,0.55)" : "rgba(125,249,255,0.55)";
      ctx.beginPath();
      ctx.arc(sx, sy, depth * 2.2, 0, Math.PI * 2);
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
      const bob = Math.sin(this.elapsed * 5 + p.x) * 3;
      ctx.translate(0, bob);
      this.drawPowerup(ctx, p);
      ctx.restore();
    }

    for (const b of this.bullets) {
      const sc = this.depthScale(b.y);
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = b.laser ? 16 : 12;
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, b.w * sc * (b.laser ? 1.2 : 1), (b.h / 2) * sc * (b.laser ? 1.4 : 1), 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    const sorted = [...this.enemies].sort((a, b) => a.y - b.y);
    for (const e of sorted) {
      const base =
        e.kind === "superboss"
          ? 1.85
          : e.kind === "boss"
            ? 1.55
            : e.kind === "miniboss"
              ? 1.35
              : e.kind === "bomber"
                ? 1.15
                : 0.95;
      const sc = this.depthScale(e.y) * base;
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
      if (e.kind === "superboss" || e.kind === "boss" || e.kind === "miniboss") {
        ctx.fillStyle = e.accent;
        ctx.font = "700 10px Rajdhani,sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(
          e.kind === "superboss" ? "SUPER BOSS" : e.kind === "boss" ? "BOSS" : "MINI",
          e.x,
          e.y - 24 * sc,
        );
        // HP bar
        const pct = Math.max(0, e.hp / e.maxHp);
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(e.x - 28, e.y - 32 * sc, 56, 4);
        ctx.fillStyle = e.accent;
        ctx.fillRect(e.x - 28, e.y - 32 * sc, 56 * pct, 4);
        ctx.textAlign = "left";
      }
    }

    // Shield sphere
    if (this.player.hasShieldSphere) {
      ctx.strokeStyle = "rgba(125,249,255,0.75)";
      ctx.lineWidth = 2;
      ctx.shadowColor = "#7df9ff";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(this.player.x, this.player.y, 26 + Math.sin(this.elapsed * 6) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    if (this.player.invuln <= 0 || Math.floor(this.elapsed * 12) % 2 === 0) {
      const bank = Math.sin(this.elapsed * 2) * 0.02;
      ctx.save();
      ctx.translate(this.player.x, this.player.y);
      ctx.rotate(bank);
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
    ctx.fillText(`LVL ${this.level}/4 · ${lv.name}`, 10, 34);
    ctx.fillText(`WAVE ${this.wave} · SH ${Math.max(0, this.player.shields)}`, 10, 50);
    ctx.fillStyle = "#ff9f1c";
    ctx.fillText(`BOMB ${this.bombReady} · T${this.weaponTier}`, 10, 66);
    // level progress bar
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(10, 72, 100, 5);
    ctx.fillStyle = lv.accent;
    ctx.fillRect(10, 72, 100 * this.levelProgress, 5);

    if (this.minedAwn > 0 || this.awnFlash > 0) {
      const flash = this.awnFlash > 0;
      ctx.fillStyle = flash ? "#b8ff3c" : "rgba(184,255,60,0.85)";
      ctx.font = flash ? "800 14px Orbitron,sans-serif" : "700 12px Rajdhani,sans-serif";
      ctx.fillText(`$AWN ${this.minedAwn}`, 10, 92);
    }

    ctx.fillStyle = "rgba(8,2,18,0.72)";
    ctx.fillRect(8, h - 52, w - 16, 40);
    ctx.strokeStyle = "rgba(255,43,214,0.55)";
    ctx.strokeRect(8, h - 52, w - 16, 40);
    ctx.fillStyle = "#7df9ff";
    ctx.font = "700 11px Orbitron,sans-serif";
    ctx.fillText("ARMA ATTIVA", 16, h - 34);
    ctx.fillStyle = "#f2e9ff";
    ctx.font = "600 12px Rajdhani,sans-serif";
    ctx.fillText(this.activeWeaponNote.slice(0, 44), 16, h - 16);

    if (this.levelClearBanner > 0) {
      ctx.fillStyle = "rgba(8,2,18,0.45)";
      ctx.fillRect(0, h * 0.35, w, 48);
      ctx.fillStyle = lv.accent;
      ctx.font = "800 20px Orbitron,sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("LEVEL CLEAR", w / 2, h * 0.35 + 32);
      ctx.textAlign = "left";
    }

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
      ctx.fillText(`Final score ${this.score} · L${this.level}`, w / 2, h / 2 + 18);
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
    ctx.fillStyle = "rgba(8,2,18,0.9)";
    ctx.strokeStyle = info.color;
    ctx.lineWidth = 2;
    roundRect(ctx, -22, -14, 44, 28, 6);
    ctx.fill();
    ctx.stroke();
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
