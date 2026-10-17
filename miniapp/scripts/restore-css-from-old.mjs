import fs from "fs";

const oldMin = fs.readFileSync(
  "c:/Users/admin/Desktop/awann-token/_old-miniapp-build/assets/index--fl1q3oa.css",
  "utf8",
);

function beautify(css) {
  return (
    css
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\}/g, "}\n")
      .replace(/\{/g, " {\n  ")
      .replace(/;/g, ";\n  ")
      .replace(/\n\s*\n/g, "\n")
      .replace(/  \}/g, "}")
      .trim() + "\n"
  );
}

const base = beautify(oldMin);

const additive = `
/* ===== Additive features on restored Oct-16 visual base ===== */

/* Gecko-style market panel: chart + metrics */
.tm-panel {
  margin-bottom: 14px;
}
.tm-head {
  margin-bottom: 8px;
}
.tm-pair {
  margin: 0;
  font-size: 0.72rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
}
.tm-price-line {
  margin: 4px 0 0;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px 12px;
}
.tm-price-main {
  font-family: var(--font-display);
  font-size: 1.15rem;
  color: var(--cyan);
  text-shadow: 0 0 14px rgba(125, 249, 255, 0.35);
}
.tm-price-usd {
  font-size: 0.9rem;
  color: var(--text);
  opacity: 0.9;
}
.tm-change {
  font-size: 0.85rem;
  font-weight: 700;
}
.tm-change.tm-up {
  color: var(--lime);
}
.tm-change.tm-down {
  color: var(--danger);
}
.tm-layout {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.tm-chart-col {
  width: 100%;
  min-width: 0;
}
.tm-chart-frame {
  border: 1px solid rgba(255, 43, 214, 0.35);
  background: rgba(0, 0, 0, 0.35);
  padding: 8px 4px 4px;
  box-shadow: inset 0 0 30px rgba(125, 249, 255, 0.05);
}
.tm-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  width: 100%;
}
@media (min-width: 640px) {
  .tm-metrics {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
.tm-metric {
  border: 1px solid rgba(125, 249, 255, 0.14);
  background: rgba(255, 43, 214, 0.06);
  padding: 7px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.tm-metric-k {
  font-size: 0.62rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.07em;
}
.tm-metric-v {
  font-size: 0.82rem;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tm-metric-sub {
  font-size: 0.62rem;
  color: var(--muted);
  line-height: 1.2;
}
.tm-contract {
  grid-column: 1 / -1;
}
.tm-contract-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.tm-contract-row .tm-metric-v {
  flex: 1;
}
.tm-copy {
  flex-shrink: 0;
  padding: 4px 10px;
  font-size: 0.7rem;
}

/* Game hub tiles — same size Siege / RunAwan */
.game-pick.siege,
.game-pick.run {
  align-items: stretch;
  min-height: 118px;
}
.gp-art-row {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
}
.gp-copy {
  flex: 1;
  min-width: 0;
  text-align: left;
}
.gp-game-art {
  width: 88px;
  height: 88px;
  flex-shrink: 0;
  border-radius: 12px;
  border: 1px solid rgba(125, 249, 255, 0.45);
  box-shadow: 0 0 16px rgba(125, 249, 255, 0.25);
  background: #050210;
  display: block;
}
.game-pick.run .gp-game-art {
  border-color: rgba(255, 200, 60, 0.5);
  box-shadow: 0 0 16px rgba(255, 200, 60, 0.28);
}
.gp-ship-tag {
  display: block;
  margin-top: 4px;
  font-size: 0.72rem;
  letter-spacing: 0.04em;
  color: var(--lime);
  font-family: var(--font-display);
}
.run-hero-art {
  width: 88px;
  height: 88px;
  border-radius: 12px;
  border: 2px solid rgba(255, 200, 60, 0.55);
  box-shadow: 0 0 18px rgba(255, 200, 60, 0.32);
  background: #050210;
  flex-shrink: 0;
  display: block;
}
.run-levels-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 2px 0 6px;
}
.run-level-chip {
  font-family: var(--font-display);
  font-size: 0.68rem;
  letter-spacing: 0.04em;
  padding: 4px 8px;
  border: 1px solid rgba(255, 43, 214, 0.45);
  background: rgba(8, 2, 18, 0.55);
  color: var(--text);
}
.run-lives-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  margin: 4px 0 10px;
  padding: 10px 12px;
  border: 1px solid rgba(125, 249, 255, 0.28);
  background: linear-gradient(
    120deg,
    rgba(255, 43, 214, 0.08),
    rgba(125, 249, 255, 0.06)
  );
}
.run-lives-count {
  font-size: 0.92rem;
}
.run-lives-count em {
  font-style: normal;
  color: var(--muted);
  font-size: 0.78rem;
}
.run-lives-row .neon-btn {
  margin: 0;
  white-space: nowrap;
}
.eco-wallet-panel {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 4px 0 8px;
}
.eco-wallet-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 0.72rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--magenta);
}
.eco-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 16px;
  padding: 10px 12px;
  margin: 0;
  border: 1px solid rgba(255, 200, 60, 0.28);
  background: rgba(255, 200, 60, 0.06);
  font-size: 0.85rem;
}
.eco-strip strong {
  color: var(--cyan);
  font-family: var(--font-display);
}
.eco-threshold {
  font-style: normal;
  opacity: 0.65;
  font-size: 0.8em;
}
.eco-claim-progress {
  height: 6px;
  border: 1px solid rgba(125, 249, 255, 0.25);
  background: rgba(8, 2, 18, 0.6);
  overflow: hidden;
}
.eco-claim-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--magenta), var(--cyan));
  transition: width 0.35s ease;
}
.eco-claim-btn {
  align-self: stretch;
  margin-top: 2px;
}
.eco-claim-btn:disabled {
  opacity: 0.45;
}
.coming-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 2;
  padding: 4px 8px;
  font-family: var(--font-display);
  font-size: 0.65rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #1a0a12;
  background: linear-gradient(135deg, #ffc83c, #ff4d6d);
  border: 1px solid rgba(255, 255, 255, 0.35);
  pointer-events: none;
}

/* Keep classic look; only prevent nav label overlap */
.cyber-nav {
  grid-template-columns: repeat(6, minmax(0, 1fr));
}
.nav-tab {
  min-width: 0;
  max-width: 100%;
  font-size: 0.55rem;
  letter-spacing: 0.02em;
  padding: 0 2px 10px;
  line-height: 1.15;
  white-space: normal;
  overflow: hidden;
}
`;

const out =
  "/* Restored visual base from Oct 16 miniapp build (recycle bin $R6OM59D) */\n" +
  base +
  "\n" +
  additive;

fs.writeFileSync(
  "c:/Users/admin/Desktop/awann-token/miniapp/src/index.css",
  out,
  "utf8",
);
console.log("OK bytes", out.length);
