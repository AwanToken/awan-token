/** Upgrade catalog — clear weapon / part effects for the shop menu */

export type UpgradeId =
  | "pulse_core"
  | "twin_lance"
  | "aegis_lattice"
  | "vector_drive"
  | "missile_bay"
  | "rail_kit";

export type UpgradeDef = {
  id: UpgradeId;
  name: string;
  /** Short chip shown on card */
  changes: string;
  blurb: string;
  priceTon: string;
  icon: "gun" | "shield" | "speed" | "missile" | "rail";
  stats: Partial<{ fireRate: number; damage: number; shields: number; speed: number }>;
};

export const UPGRADES: UpgradeDef[] = [
  {
    id: "pulse_core",
    name: "Pulse Core",
    changes: "ARMA → fuoco più veloce (+35%)",
    blurb: "Condensatori: la cadenza della tua arma di base aumenta.",
    priceTon: "0.15",
    icon: "gun",
    stats: { fireRate: 0.35 },
  },
  {
    id: "twin_lance",
    name: "Twin Lance Kit",
    changes: "ARMA → danno +40%",
    blurb: "Emitter duali: ogni colpo fa più danno (tutte le armi).",
    priceTon: "0.25",
    icon: "gun",
    stats: { damage: 0.4 },
  },
  {
    id: "aegis_lattice",
    name: "Aegis Lattice",
    changes: "SCUDO → +2 colpi",
    blurb: "Mesh hardlight: resisti a 2 hit in più prima del game over.",
    priceTon: "0.2",
    icon: "shield",
    stats: { shields: 2 },
  },
  {
    id: "vector_drive",
    name: "Vector Drive",
    changes: "MOTORE → +20% velocità",
    blurb: "Micro-thruster laterali: muovi più veloce sinistra/destra.",
    priceTon: "0.12",
    icon: "speed",
    stats: { speed: 0.2 },
  },
  {
    id: "missile_bay",
    name: "Missile Bay",
    changes: "ARMA → missili più spesso in-run",
    blurb: "Baia missili: +15% fire rate e più probabilità di drop MISSILE.",
    priceTon: "0.3",
    icon: "missile",
    stats: { fireRate: 0.15, damage: 0.1 },
  },
  {
    id: "rail_kit",
    name: "Rail Overcharge",
    changes: "ARMA → danno pesante +25%",
    blurb: "Kit rail: colpi più devastanti; combo ottima con Raven-S.",
    priceTon: "0.28",
    icon: "rail",
    stats: { damage: 0.25 },
  },
];

const key = (wallet: string) => `awn_upgrades_${wallet}`;

export function loadOwned(wallet: string | null): UpgradeId[] {
  if (!wallet) return [];
  try {
    const raw = localStorage.getItem(key(wallet));
    return raw ? (JSON.parse(raw) as UpgradeId[]) : [];
  } catch {
    return [];
  }
}

export function saveOwned(wallet: string, ids: UpgradeId[]) {
  localStorage.setItem(key(wallet), JSON.stringify(ids));
}

export function markOwned(wallet: string, id: UpgradeId) {
  const cur = loadOwned(wallet);
  if (!cur.includes(id)) {
    cur.push(id);
    saveOwned(wallet, cur);
  }
  return cur;
}

export type AppliedStats = {
  fireRateMul: number;
  damageMul: number;
  shields: number;
  speedMul: number;
};

export function applyUpgrades(owned: UpgradeId[]): AppliedStats {
  const stats: AppliedStats = {
    fireRateMul: 1,
    damageMul: 1,
    shields: 0,
    speedMul: 1,
  };
  for (const id of owned) {
    const u = UPGRADES.find((x) => x.id === id);
    if (!u) continue;
    if (u.stats.fireRate) stats.fireRateMul += u.stats.fireRate;
    if (u.stats.damage) stats.damageMul += u.stats.damage;
    if (u.stats.shields) stats.shields += u.stats.shields;
    if (u.stats.speed) stats.speedMul += u.stats.speed;
  }
  return stats;
}
