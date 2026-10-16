import { EXPLORER, MINTER, NETWORK } from "../config";
import { useI18n } from "../i18n/I18nContext";
import { openExternal } from "../lib/telegram";

type PhaseStatus = "done" | "live" | "next" | "later";

type Phase = {
  id: string;
  status: PhaseStatus;
  title: string;
  body: string;
  bullets: string[];
};

export function RoadmapScreen() {
  const { t } = useI18n();
  const r = t.roadmap;

  const phases: Phase[] = [
    {
      id: "token",
      status: "live",
      title: r.p1Title,
      body: r.p1Body,
      bullets: [r.p1b1, r.p1b2, r.p1b3],
    },
    {
      id: "limits",
      status: "live",
      title: r.p2Title,
      body: r.p2Body,
      bullets: [r.p2b1, r.p2b2, r.p2b3],
    },
    {
      id: "tax",
      status: "live",
      title: r.p3Title,
      body: r.p3Body,
      bullets: [r.p3b1, r.p3b2, r.p3b3],
    },
    {
      id: "claim",
      status: "live",
      title: r.p4Title,
      body: r.p4Body,
      bullets: [r.p4b1, r.p4b2, r.p4b3],
    },
    {
      id: "games",
      status: "live",
      title: r.p5Title,
      body: r.p5Body,
      bullets: [r.p5b1, r.p5b2, r.p5b3],
    },
    {
      id: "mainnet",
      status: "next",
      title: r.p6Title,
      body: r.p6Body,
      bullets: [r.p6b1, r.p6b2, r.p6b3],
    },
  ];

  const statusLabel = (s: PhaseStatus) => {
    if (s === "live" || s === "done") return r.badgeLive;
    if (s === "next") return r.badgeNext;
    return r.badgeLater;
  };

  return (
    <section className="panel roadmap-panel fade-in">
      <p className="eyebrow">{r.eyebrow}</p>
      <h2 className="panel-title">{r.title}</h2>
      <p className="lede">{r.lede}</p>

      <div className="roadmap-network">
        <span className={`net-pill ${NETWORK}`}>{NETWORK}</span>
        <button
          type="button"
          className="link-btn"
          onClick={() => openExternal(`${EXPLORER}/${MINTER}`)}
        >
          {r.viewContract}
        </button>
      </div>

      <ol className="roadmap-timeline">
        {phases.map((p, i) => (
          <li key={p.id} className={`roadmap-step status-${p.status}`}>
            <div className="roadmap-rail" aria-hidden>
              <span className="roadmap-dot">{i + 1}</span>
              {i < phases.length - 1 && <span className="roadmap-line" />}
            </div>
            <div className="roadmap-card">
              <div className="roadmap-card-head">
                <h3>{p.title}</h3>
                <span className={`roadmap-badge ${p.status}`}>{statusLabel(p.status)}</span>
              </div>
              <p className="roadmap-body">{p.body}</p>
              <ul className="roadmap-bullets">
                {p.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>

      <div className="roadmap-spec">
        <h3 className="sub-title">{r.specTitle}</h3>
        <dl className="roadmap-spec-grid">
          <div>
            <dt>{r.specBuy}</dt>
            <dd>on-chain % {r.specOfPool}</dd>
          </div>
          <div>
            <dt>{r.specSell}</dt>
            <dd>min(% {r.specOfPool}, % {r.specOfHold})</dd>
          </div>
          <div>
            <dt>{r.specTax}</dt>
            <dd>config → {r.specTaxDest}</dd>
          </div>
          <div>
            <dt>{r.specClaim}</dt>
            <dd>7d + 24h</dd>
          </div>
          <div>
            <dt>{r.specGames}</dt>
            <dd>{r.specGamesVal}</dd>
          </div>
          <div>
            <dt>{r.specNetwork}</dt>
            <dd>{NETWORK}</dd>
          </div>
        </dl>
        <p className="hint">{r.disclaimer}</p>
      </div>
    </section>
  );
}
