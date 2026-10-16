import { useCallback, useState, type FormEvent } from "react";
import { useI18n } from "../i18n/I18nContext";
import { ensureAudio, isGameMuted, setGameMuted } from "../lib/audio";
import {
  DEFAULT_PLAYLISTS,
  isSpotifyMuted,
  isSpotifyPanelOpen,
  loadSpotifyUrl,
  parseSpotifyUrl,
  saveSpotifyUrl,
  setSpotifyMuted,
  setSpotifyPanelOpen,
} from "../lib/spotify";

type Props = {
  /** Smaller FAB/bar (e.g. fullscreen play). Close panel ≠ mute. */
  compact?: boolean;
};

export function AudioDock({ compact = false }: Props) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState(() => isSpotifyPanelOpen());
  const [gameMuted, setGameMutedState] = useState(() => isGameMuted());
  const [spotifyMuted, setSpotifyMutedState] = useState(() => isSpotifyMuted());
  const [urlInput, setUrlInput] = useState(() => loadSpotifyUrl());
  const [activeUrl, setActiveUrl] = useState(() => loadSpotifyUrl());

  const parsed = parseSpotifyUrl(activeUrl);
  /** Embed stays mounted whenever unmuted + valid URL (close ≠ mute). */
  const keepEmbed = Boolean(parsed && !spotifyMuted);
  const playingBg = keepEmbed && !open;
  const showChrome = expanded || open;

  const toggleGame = useCallback(() => {
    void ensureAudio();
    const next = !isGameMuted();
    setGameMuted(next);
    setGameMutedState(next);
  }, []);

  const toggleSpotify = useCallback(() => {
    const next = !isSpotifyMuted();
    setSpotifyMuted(next);
    setSpotifyMutedState(next);
  }, []);

  const openPanel = useCallback(() => {
    setOpen(true);
    setSpotifyPanelOpen(true);
    setExpanded(true);
  }, []);

  const closePanel = useCallback(() => {
    setOpen(false);
    setSpotifyPanelOpen(false);
    setExpanded(false);
  }, []);

  const applyUrl = useCallback((raw: string) => {
    const p = parseSpotifyUrl(raw);
    if (!p) return false;
    saveSpotifyUrl(p.openUrl);
    setUrlInput(p.openUrl);
    setActiveUrl(p.openUrl);
    setSpotifyMuted(false);
    setSpotifyMutedState(false);
    return true;
  }, []);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    applyUrl(urlInput);
  };

  return (
    <div
      className={`audio-dock${compact ? " compact" : ""}${open ? " open" : ""}${
        showChrome ? " expanded" : " collapsed"
      }${playingBg ? " playing-bg" : ""}`}
      role="region"
      aria-label={t.audio.spotifyTitle}
    >
      {!showChrome && (
        <button
          type="button"
          className={`audio-dock-fab${playingBg ? " live" : ""}`}
          title={playingBg ? t.audio.playingBg : t.audio.openSpotify}
          aria-label={playingBg ? t.audio.playingBg : t.audio.openSpotify}
          aria-expanded={false}
          onClick={() => setExpanded(true)}
        >
          <span aria-hidden>♫</span>
        </button>
      )}

      {showChrome && (
        <div className="audio-dock-bar">
          <button
            type="button"
            className={`audio-dock-btn${gameMuted ? " muted" : ""}`}
            title={t.audio.muteGame}
            aria-pressed={gameMuted}
            onClick={toggleGame}
          >
            <span className="audio-dock-ico" aria-hidden>
              {gameMuted ? "🔇" : "🔊"}
            </span>
            <span className="audio-dock-label">{t.audio.muteGame}</span>
          </button>
          <button
            type="button"
            className={`audio-dock-btn${spotifyMuted ? " muted" : ""}`}
            title={t.audio.muteSpotify}
            aria-pressed={spotifyMuted}
            onClick={toggleSpotify}
          >
            <span className="audio-dock-ico" aria-hidden>
              {spotifyMuted ? "🔇" : "🎵"}
            </span>
            <span className="audio-dock-label">{t.audio.muteSpotify}</span>
          </button>
          <button
            type="button"
            className={`audio-dock-btn spotify-toggle${open ? " active" : ""}`}
            title={open ? t.audio.close : t.audio.openSpotify}
            aria-expanded={open}
            onClick={() => (open ? closePanel() : openPanel())}
          >
            <span className="audio-dock-ico" aria-hidden>
              {open ? "✕" : "♫"}
            </span>
            <span className="audio-dock-label">
              {open ? t.audio.close : t.audio.openSpotify}
            </span>
          </button>
          {!open && (
            <button
              type="button"
              className="audio-dock-btn audio-dock-collapse"
              title={t.audio.close}
              aria-label={t.audio.close}
              onClick={() => setExpanded(false)}
            >
              <span className="audio-dock-ico" aria-hidden>
                –
              </span>
            </button>
          )}
        </div>
      )}

      {open && (
        <div className="audio-dock-panel">
          <div className="audio-dock-panel-head">
            <strong>{t.audio.spotifyTitle}</strong>
            <button
              type="button"
              className="audio-dock-close"
              aria-label={t.audio.close}
              title={t.audio.close}
              onClick={closePanel}
            >
              <span className="audio-dock-close-label">{t.audio.close}</span>
              <span aria-hidden> ×</span>
            </button>
          </div>
          <form className="audio-dock-form" onSubmit={onSubmit}>
            <label className="sr-only" htmlFor="awn-spotify-url">
              {t.audio.pasteLink}
            </label>
            <input
              id="awn-spotify-url"
              type="url"
              className="audio-dock-input"
              placeholder={t.audio.pasteLink}
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              autoComplete="off"
            />
            <button type="submit" className="audio-dock-go">
              OK
            </button>
          </form>
          <div className="audio-dock-presets">
            {DEFAULT_PLAYLISTS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`audio-dock-preset${
                  parsed?.id === p.id ? " active" : ""
                }`}
                onClick={() => applyUrl(p.url)}
              >
                {p.label}
              </button>
            ))}
          </div>
          {!keepEmbed && (
            <p className="audio-dock-hint">
              {spotifyMuted ? t.audio.muteSpotify : t.audio.pasteLink}
            </p>
          )}
          {keepEmbed && (
            <p className="audio-dock-hint soft">{t.audio.playingBg}</p>
          )}
        </div>
      )}

      {/* Mounted while unmuted: visible in panel, visually hidden when closed (keeps playing). */}
      {keepEmbed && parsed && (
        <iframe
          key={parsed.embedUrl}
          className={`audio-dock-embed${open ? "" : " bg-playing"}`}
          src={`${parsed.embedUrl}?utm_source=generator&theme=0`}
          title={t.audio.spotifyTitle}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          tabIndex={open ? 0 : -1}
          aria-hidden={!open}
        />
      )}
    </div>
  );
}
