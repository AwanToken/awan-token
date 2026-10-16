import { SHIPS, drawShip, type ShipId } from "../game/ships";
import { DIFFICULTIES, type DifficultyId } from "../game/difficulty";
import { useEffect, useRef } from "react";
import { useI18n } from "../i18n/I18nContext";

type Props = {
  selected: ShipId;
  onSelect: (id: ShipId) => void;
  difficulty: DifficultyId;
  onDifficulty: (d: DifficultyId) => void;
  onLaunch: () => void;
};

function ShipPreview({ id, active }: { id: ShipId; active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const ship = SHIPS.find((s) => s.id === id)!;
    ctx.clearRect(0, 0, c.width, c.height);
    const g = ctx.createRadialGradient(48, 48, 4, 48, 48, 44);
    g.addColorStop(0, "rgba(255,43,214,0.28)");
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 96, 96);
    drawShip(ctx, ship, 48, 50, active ? 1.55 : 1.35, "up");
  }, [id, active]);
  return <canvas ref={ref} width={96} height={96} className="ship-preview" />;
}

export function HangarScreen({
  selected,
  onSelect,
  difficulty,
  onDifficulty,
  onLaunch,
}: Props) {
  const { t } = useI18n();
  const sel = SHIPS.find((s) => s.id === selected) ?? SHIPS[0]!;

  return (
    <section className="panel hangar-panel fade-in">
      <p className="eyebrow">{t.hangar.eyebrow}</p>
      <h2 className="panel-title">{t.hangar.title}</h2>
      <p className="lede">{t.hangar.lede}</p>

      <div className="diff-block">
        <p className="diff-title">Difficoltà (max 3)</p>
        <div className="diff-row">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.id}
              type="button"
              className={`diff-btn ${difficulty === d.id ? "active" : ""}`}
              onClick={() => onDifficulty(d.id)}
            >
              <strong>{d.labelIt}</strong>
              <span>{d.blurb}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="ship-grid ship-grid-wide">
        {SHIPS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`ship-card ${selected === s.id ? "active" : ""}`}
            onClick={() => onSelect(s.id)}
          >
            <ShipPreview id={s.id} active={selected === s.id} />
            <div>
              <strong>{s.name}</strong>
              <span>{s.tagline}</span>
              <em className="weapon-chip">{s.weaponLabel}</em>
              <small>
                FR {s.baseFireMs}ms · DMG {s.baseDamage} · SPD {s.baseSpeed} · SH {s.baseShields}
              </small>
            </div>
          </button>
        ))}
      </div>

      <div className="loadout-banner">
        <strong>{sel.name}</strong>
        <span>Arma di serie: {sel.weaponLabel}</span>
        <span className="hint">In volo i drop (SCUDO / RAPID / SPREAD / MISSILE / RAIL) cambiano l’arma attiva.</span>
      </div>

      <button type="button" className="neon-btn buy launch-btn" onClick={onLaunch}>
        {t.hangar.launch}
      </button>
    </section>
  );
}
