/** Spotify Embed helpers — public links only, no OAuth. */

const LS_URL = "awn_spotify_url";
const LS_MUTE = "awn_mute_spotify";
const LS_PANEL = "awn_spotify_panel_open";

export type SpotifyKind = "playlist" | "track" | "album" | "artist" | "episode" | "show";

export type ParsedSpotify = {
  kind: SpotifyKind;
  id: string;
  embedUrl: string;
  openUrl: string;
};

const KINDS: SpotifyKind[] = [
  "playlist",
  "track",
  "album",
  "artist",
  "episode",
  "show",
];

/** Curated chill / game playlists (public Spotify embeds). */
export const DEFAULT_PLAYLISTS: { id: string; label: string; url: string }[] = [
  {
    id: "37i9dQZF1DX4sWSpwq3LiO",
    label: "Peaceful Piano",
    url: "https://open.spotify.com/playlist/37i9dQZF1DX4sWSpwq3LiO",
  },
  {
    id: "37i9dQZF1DX3Ogo9pFvBkY",
    label: "Ambient Relaxation",
    url: "https://open.spotify.com/playlist/37i9dQZF1DX3Ogo9pFvBkY",
  },
  {
    id: "37i9dQZF1DWZeKCadgRdKQ",
    label: "Deep Focus",
    url: "https://open.spotify.com/playlist/37i9dQZF1DWZeKCadgRdKQ",
  },
  {
    id: "37i9dQZF1DX8Uebhn9wZrY",
    label: "Chill Hits",
    url: "https://open.spotify.com/playlist/37i9dQZF1DX8Uebhn9wZrY",
  },
];

export function parseSpotifyUrl(raw: string): ParsedSpotify | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "");
  if (host !== "open.spotify.com" && host !== "spotify.link") {
    // Allow bare embed paths pasted as path-only after host normalize
    if (!host.includes("spotify")) return null;
  }

  // /embed/playlist/ID or /playlist/ID or /intl-xx/playlist/ID
  const parts = url.pathname.split("/").filter(Boolean);
  let kind: SpotifyKind | null = null;
  let id: string | null = null;

  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]!;
    if (p === "embed" && i + 2 < parts.length) {
      const k = parts[i + 1] as SpotifyKind;
      if (KINDS.includes(k)) {
        kind = k;
        id = parts[i + 2]!.split("?")[0]!;
        break;
      }
    }
    if (KINDS.includes(p as SpotifyKind) && i + 1 < parts.length) {
      kind = p as SpotifyKind;
      id = parts[i + 1]!.split("?")[0]!;
      break;
    }
  }

  if (!kind || !id || !/^[a-zA-Z0-9]+$/.test(id)) return null;

  return {
    kind,
    id,
    embedUrl: `https://open.spotify.com/embed/${kind}/${id}`,
    openUrl: `https://open.spotify.com/${kind}/${id}`,
  };
}

export function toEmbedUrl(raw: string): string | null {
  return parseSpotifyUrl(raw)?.embedUrl ?? null;
}

export function loadSpotifyUrl(): string {
  try {
    return localStorage.getItem(LS_URL) || "";
  } catch {
    return "";
  }
}

export function saveSpotifyUrl(url: string): void {
  try {
    if (url) localStorage.setItem(LS_URL, url);
    else localStorage.removeItem(LS_URL);
  } catch {
    /* ignore */
  }
}

/** Default: muted until user opens Spotify. */
export function isSpotifyMuted(): boolean {
  try {
    const v = localStorage.getItem(LS_MUTE);
    if (v === null) return true;
    return v === "1";
  } catch {
    return true;
  }
}

export function setSpotifyMuted(v: boolean): void {
  try {
    localStorage.setItem(LS_MUTE, v ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/** Default: panel closed so it does not block the view. */
export function isSpotifyPanelOpen(): boolean {
  try {
    return localStorage.getItem(LS_PANEL) === "1";
  } catch {
    return false;
  }
}

export function setSpotifyPanelOpen(v: boolean): void {
  try {
    localStorage.setItem(LS_PANEL, v ? "1" : "0");
  } catch {
    /* ignore */
  }
}
