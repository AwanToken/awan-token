/** Original neon jet fighters — aircraft silhouettes (not geometric prisms). */

export type ShipId =
  | "viper_mk2"
  | "spectre_x"
  | "thunder_wing"
  | "raven_s"
  | "aurora_gt"
  | "iron_falcon";

export type WeaponId = "vulcan" | "twin_cannon" | "spread_burst" | "rail_lance" | "plasma_arc";

export type ShipDef = {
  id: ShipId;
  name: string;
  tagline: string;
  weapon: WeaponId;
  weaponLabel: string;
  color: string;
  accent: string;
  baseFireMs: number;
  baseDamage: number;
  baseSpeed: number;
  baseShields: number;
  /** Visual variant for drawJet */
  style: 1 | 2 | 3 | 4 | 5 | 6;
};

export const WEAPON_LABELS: Record<WeaponId, string> = {
  vulcan: "Vulcan — singolo rapido",
  twin_cannon: "Twin Cannon — doppia canna",
  spread_burst: "Spread Burst — ventaglio 3 colpi",
  rail_lance: "Rail Lance — colpo pesante",
  plasma_arc: "Plasma Arc — onda ampia",
};

export const SHIPS: ShipDef[] = [
  {
    id: "viper_mk2",
    name: "Viper Mk.II",
    tagline: "Caccia leggero · Virata rapida",
    weapon: "vulcan",
    weaponLabel: WEAPON_LABELS.vulcan,
    color: "#ff2bd6",
    accent: "#7df9ff",
    baseFireMs: 200,
    baseDamage: 1,
    baseSpeed: 300,
    baseShields: 1,
    style: 1,
  },
  {
    id: "spectre_x",
    name: "Spectre-X",
    tagline: "Intercettore stealth · Silhouette stretta",
    weapon: "twin_cannon",
    weaponLabel: WEAPON_LABELS.twin_cannon,
    color: "#7df9ff",
    accent: "#c77dff",
    baseFireMs: 260,
    baseDamage: 1.25,
    baseSpeed: 260,
    baseShields: 2,
    style: 2,
  },
  {
    id: "thunder_wing",
    name: "Thunder Wing",
    tagline: "Ala larga · Fuoco a ventaglio",
    weapon: "spread_burst",
    weaponLabel: WEAPON_LABELS.spread_burst,
    color: "#b8ff3c",
    accent: "#ff2bd6",
    baseFireMs: 320,
    baseDamage: 1.15,
    baseSpeed: 230,
    baseShields: 2,
    style: 3,
  },
  {
    id: "raven_s",
    name: "Raven-S",
    tagline: "Assalto · Cannone pesante",
    weapon: "rail_lance",
    weaponLabel: WEAPON_LABELS.rail_lance,
    color: "#c77dff",
    accent: "#7df9ff",
    baseFireMs: 380,
    baseDamage: 2.1,
    baseSpeed: 210,
    baseShields: 3,
    style: 4,
  },
  {
    id: "aurora_gt",
    name: "Aurora GT",
    tagline: "Elite · Plasma ad arco",
    weapon: "plasma_arc",
    weaponLabel: WEAPON_LABELS.plasma_arc,
    color: "#ff9f1c",
    accent: "#7df9ff",
    baseFireMs: 300,
    baseDamage: 1.5,
    baseSpeed: 250,
    baseShields: 2,
    style: 5,
  },
  {
    id: "iron_falcon",
    name: "Iron Falcon",
    tagline: "Corazzato · Twin + scudi",
    weapon: "twin_cannon",
    weaponLabel: WEAPON_LABELS.twin_cannon,
    color: "#e8f2ff",
    accent: "#ff2bd6",
    baseFireMs: 290,
    baseDamage: 1.4,
    baseSpeed: 200,
    baseShields: 4,
    style: 6,
  },
];

export function getShip(id: ShipId): ShipDef {
  return SHIPS.find((s) => s.id === id) ?? SHIPS[0]!;
}

/** Draw jet fighter. facing up = player, down = enemy coming at you */
export function drawJet(
  ctx: CanvasRenderingContext2D,
  opts: {
    color: string;
    accent: string;
    style: number;
    x: number;
    y: number;
    scale?: number;
    facing?: "up" | "down";
    enemy?: boolean;
  },
) {
  const scale = opts.scale ?? 1;
  const facing = opts.facing ?? "up";
  ctx.save();
  ctx.translate(opts.x, opts.y);
  if (facing === "down") ctx.rotate(Math.PI);
  ctx.scale(scale, scale);

  ctx.shadowColor = opts.color;
  ctx.shadowBlur = opts.enemy ? 10 : 16;

  // engine glow (aft)
  const eg = ctx.createRadialGradient(0, 14, 1, 0, 18, 12);
  eg.addColorStop(0, opts.accent);
  eg.addColorStop(1, "transparent");
  ctx.fillStyle = eg;
  ctx.beginPath();
  ctx.ellipse(0, 16, 5, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineJoin = "round";
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = opts.accent;
  ctx.fillStyle = opts.color;

  const s = opts.style;
  ctx.beginPath();
  if (s === 1) {
    // Viper — pointed nose, swept wings
    ctx.moveTo(0, -18);
    ctx.lineTo(5, -4);
    ctx.lineTo(16, 6);
    ctx.lineTo(6, 4);
    ctx.lineTo(5, 14);
    ctx.lineTo(0, 10);
    ctx.lineTo(-5, 14);
    ctx.lineTo(-6, 4);
    ctx.lineTo(-16, 6);
    ctx.lineTo(-5, -4);
  } else if (s === 2) {
    // Spectre — long thin
    ctx.moveTo(0, -20);
    ctx.lineTo(4, -6);
    ctx.lineTo(12, 2);
    ctx.lineTo(4, 2);
    ctx.lineTo(3, 15);
    ctx.lineTo(0, 11);
    ctx.lineTo(-3, 15);
    ctx.lineTo(-4, 2);
    ctx.lineTo(-12, 2);
    ctx.lineTo(-4, -6);
  } else if (s === 3) {
    // Thunder — wide wings
    ctx.moveTo(0, -16);
    ctx.lineTo(6, -2);
    ctx.lineTo(22, 8);
    ctx.lineTo(8, 6);
    ctx.lineTo(6, 14);
    ctx.lineTo(0, 10);
    ctx.lineTo(-6, 14);
    ctx.lineTo(-8, 6);
    ctx.lineTo(-22, 8);
    ctx.lineTo(-6, -2);
  } else if (s === 4) {
    // Raven — delta
    ctx.moveTo(0, -17);
    ctx.lineTo(18, 12);
    ctx.lineTo(4, 8);
    ctx.lineTo(0, 14);
    ctx.lineTo(-4, 8);
    ctx.lineTo(-18, 12);
  } else if (s === 5) {
    // Aurora — twin boom feel
    ctx.moveTo(0, -18);
    ctx.lineTo(7, -2);
    ctx.lineTo(14, 4);
    ctx.lineTo(10, 12);
    ctx.lineTo(4, 6);
    ctx.lineTo(3, 14);
    ctx.lineTo(0, 10);
    ctx.lineTo(-3, 14);
    ctx.lineTo(-4, 6);
    ctx.lineTo(-10, 12);
    ctx.lineTo(-14, 4);
    ctx.lineTo(-7, -2);
  } else {
    // Iron Falcon — bulky
    ctx.moveTo(0, -15);
    ctx.lineTo(8, -2);
    ctx.lineTo(17, 4);
    ctx.lineTo(10, 8);
    ctx.lineTo(8, 15);
    ctx.lineTo(0, 11);
    ctx.lineTo(-8, 15);
    ctx.lineTo(-10, 8);
    ctx.lineTo(-17, 4);
    ctx.lineTo(-8, -2);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // canopy
  ctx.shadowBlur = 6;
  ctx.fillStyle = opts.accent;
  ctx.beginPath();
  ctx.ellipse(0, -4, 3.2, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // wing guns hint
  ctx.fillStyle = opts.accent;
  ctx.fillRect(-14, 2, 3, 5);
  ctx.fillRect(11, 2, 3, 5);

  ctx.restore();
}

/** @deprecated alias */
export function drawShip(
  ctx: CanvasRenderingContext2D,
  ship: ShipDef,
  x: number,
  y: number,
  scale = 1,
  facing: "up" | "down" = "up",
) {
  drawJet(ctx, {
    color: ship.color,
    accent: ship.accent,
    style: ship.style,
    x,
    y,
    scale,
    facing,
  });
}
