import { useI18n } from "../i18n/I18nContext";
import { statusMessage, useAppStatus } from "../lib/appStatus";

/** Soft full-app gate when global status is "coming" (from public/app-status.json). */
export function ComingSoonOverlay() {
  const { t, lang } = useI18n();
  const { isGlobalComing, status } = useAppStatus();

  if (!isGlobalComing) return null;

  return (
    <div className="coming-soon-overlay" role="dialog" aria-modal="true">
      <div className="coming-soon-card">
        <p className="eyebrow">{t.games.globalUpdating}</p>
        <h2 className="panel-title">{t.games.comingSoonBadge}</h2>
        <p className="lede">{statusMessage(lang, status)}</p>
        <p className="hint">{t.roadmap.disclaimer}</p>
      </div>
    </div>
  );
}
