import { useCallback, useEffect, useState } from "react";
import { useI18n } from "../i18n/I18nContext";
import {
  adminPrizeNote,
  countExportableWallets,
  exportTopPrizeJson,
  getTop,
  type ScoreEntry,
} from "../lib/leaderboard";

export function LeaderboardScreen() {
  const { t } = useI18n();
  const [rows, setRows] = useState<ScoreEntry[]>([]);
  const [copied, setCopied] = useState(false);
  const [exportErr, setExportErr] = useState("");

  useEffect(() => {
    setRows(getTop(20));
  }, []);

  const exportable = countExportableWallets(10);

  const copyPrizeJson = useCallback(async () => {
    setExportErr("");
    try {
      const json = exportTopPrizeJson(10);
      const parsed = JSON.parse(json) as { prizes: unknown[] };
      if (!parsed.prizes?.length) {
        setExportErr(t.board.exportEmpty);
        return;
      }
      await navigator.clipboard.writeText(json);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch (e) {
      setExportErr(e instanceof Error ? e.message : String(e));
    }
  }, [t.board.exportEmpty]);

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
        <button
          type="button"
          className="neon-btn buy"
          style={{ marginTop: 10 }}
          disabled={exportable === 0}
          onClick={() => void copyPrizeJson()}
        >
          {copied ? t.board.exportCopied : t.board.exportBtn}
        </button>
        {exportable === 0 && <p className="hint">{t.board.exportNeedWallet}</p>}
        {exportErr && <p className="hint err">{exportErr}</p>}
      </div>
    </section>
  );
}
