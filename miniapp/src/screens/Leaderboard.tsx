import { useEffect, useState } from "react";
import { useI18n } from "../i18n/I18nContext";
import { adminPrizeNote, getTop, type ScoreEntry } from "../lib/leaderboard";

export function LeaderboardScreen() {
  const { t } = useI18n();
  const [rows, setRows] = useState<ScoreEntry[]>([]);

  useEffect(() => {
    setRows(getTop(20));
  }, []);

  return (
    <section className="panel board-panel fade-in">
      <p className="eyebrow">{t.board.eyebrow}</p>
      <h2 className="panel-title">{t.board.title}</h2>
      <p className="lede">{t.board.lede}</p>

      <ol className="lb-list">
        {rows.length === 0 && <li className="hint">{t.board.empty}</li>}
        {rows.map((r, i) => (
          <li key={`${r.at}-${r.score}-${i}`}>
            <span className="lb-rank">#{i + 1}</span>
            <span className="lb-name">{r.name}</span>
            <span className="lb-ship">{r.ship}</span>
            <strong className="lb-score">{r.score}</strong>
          </li>
        ))}
      </ol>

      <div className="admin-note">
        <strong>{t.board.prize}</strong>
        <p>{adminPrizeNote()}</p>
        <p className="hint">{t.board.prizeHint}</p>
      </div>
    </section>
  );
}
