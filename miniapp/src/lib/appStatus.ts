import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

export type AppStatusValue = "live" | "coming";
export type GameId = "siege" | "run";

export type AppStatusConfig = {
  global: AppStatusValue;
  games: Record<GameId, AppStatusValue>;
  message: Partial<Record<"it" | "en" | "ru" | "zh", string>>;
};

export type AppStatusOverride = {
  global?: AppStatusValue;
  games?: Partial<Record<GameId, AppStatusValue>>;
};

const LS_KEY = "awn_app_status_override";

const DEFAULT_STATUS: AppStatusConfig = {
  global: "live",
  games: { siege: "live", run: "live" },
  message: {
    it: "Stiamo aggiornando l'app. Torna a breve — in arrivo!",
    en: "We're updating the app. Back soon — coming soon!",
    ru: "Мы обновляем приложение. Скоро вернёмся — скоро!",
    zh: "应用升级中，稍后再来 — 即将上线！",
  },
};

let remote: AppStatusConfig = {
  ...DEFAULT_STATUS,
  games: { ...DEFAULT_STATUS.games },
  message: { ...DEFAULT_STATUS.message },
};
let override: AppStatusOverride = readOverride();
let cachedEffective: AppStatusConfig = mergeFrom(remote, override);
const listeners = new Set<() => void>();

function mergeFrom(
  base: AppStatusConfig,
  ov: AppStatusOverride,
): AppStatusConfig {
  return {
    global: ov.global ?? base.global,
    games: {
      siege: ov.games?.siege ?? base.games.siege,
      run: ov.games?.run ?? base.games.run,
    },
    message: { ...base.message },
  };
}

function isStatus(v: unknown): v is AppStatusValue {
  return v === "live" || v === "coming";
}

function readOverride(): AppStatusOverride {
  // Public Owner toggles were removed — clear legacy browser overrides so
  // only public/app-status.json (admin-controlled) decides Coming Soon / Live.
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    /* ignore */
  }
  return {};
}

function writeOverride(next: AppStatusOverride) {
  override = next;
  try {
    if (!next.global && !next.games?.siege && !next.games?.run) {
      localStorage.removeItem(LS_KEY);
    } else {
      localStorage.setItem(LS_KEY, JSON.stringify(next));
    }
  } catch {
    /* ignore */
  }
  emit();
}

function emit() {
  cachedEffective = mergeFrom(remote, override);
  listeners.forEach((l) => l());
}

function normalizeRemote(data: unknown): AppStatusConfig {
  const base: AppStatusConfig = {
    global: DEFAULT_STATUS.global,
    games: { ...DEFAULT_STATUS.games },
    message: { ...DEFAULT_STATUS.message },
  };
  if (!data || typeof data !== "object") return base;
  const d = data as Record<string, unknown>;
  if (isStatus(d.global)) base.global = d.global;
  if (d.games && typeof d.games === "object") {
    const g = d.games as Record<string, unknown>;
    if (isStatus(g.siege)) base.games.siege = g.siege;
    if (isStatus(g.run)) base.games.run = g.run;
  }
  if (d.message && typeof d.message === "object") {
    const m = d.message as Record<string, unknown>;
    for (const k of ["it", "en", "ru", "zh"] as const) {
      if (typeof m[k] === "string") base.message[k] = m[k];
    }
  }
  return base;
}

export function getEffectiveStatus(): AppStatusConfig {
  return cachedEffective;
}

export function getOverride(): AppStatusOverride {
  return {
    global: override.global,
    games: override.games ? { ...override.games } : undefined,
  };
}

export function hasOverride(): boolean {
  return Boolean(override.global || override.games?.siege || override.games?.run);
}

export function isGlobalComing(status = cachedEffective): boolean {
  return status.global === "coming";
}

export function isGameComing(id: GameId, status = cachedEffective): boolean {
  return status.global === "coming" || status.games[id] === "coming";
}

export function statusMessage(
  lang: "it" | "en" | "ru" | "zh",
  status = cachedEffective,
): string {
  return (
    status.message[lang] ||
    status.message.en ||
    status.message.it ||
    DEFAULT_STATUS.message.en!
  );
}

export function setGlobalStatus(value: AppStatusValue) {
  writeOverride({ ...override, global: value, games: override.games ? { ...override.games } : undefined });
}

export function setGameStatus(id: GameId, value: AppStatusValue) {
  writeOverride({
    ...override,
    games: { ...(override.games || {}), [id]: value },
  });
}

export function setAllStatus(value: AppStatusValue) {
  writeOverride({
    global: value,
    games: { siege: value, run: value },
  });
}

export function clearOverrides() {
  writeOverride({});
}

export function subscribeAppStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let fetchPromise: Promise<AppStatusConfig> | null = null;

export async function fetchAppStatus(): Promise<AppStatusConfig> {
  if (!fetchPromise) {
    fetchPromise = (async () => {
      try {
        const res = await fetch(`/app-status.json?t=${Date.now()}`, {
          cache: "no-store",
        });
        if (res.ok) {
          remote = normalizeRemote(await res.json());
          emit();
        }
      } catch {
        /* keep previous / default */
      }
      return cachedEffective;
    })();
  }
  return fetchPromise;
}

function getSnapshot(): AppStatusConfig {
  return cachedEffective;
}

/** Subscribe to effective status (remote JSON + localStorage overrides). */
export function useAppStatus() {
  const status = useSyncExternalStore(subscribeAppStatus, getSnapshot, getSnapshot);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchAppStatus().finally(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setGlobal = useCallback((value: AppStatusValue) => setGlobalStatus(value), []);
  const setGame = useCallback((id: GameId, value: AppStatusValue) => setGameStatus(id, value), []);
  const setAll = useCallback((value: AppStatusValue) => setAllStatus(value), []);
  const clear = useCallback(() => clearOverrides(), []);

  return {
    status,
    ready,
    override: getOverride(),
    hasOverride: hasOverride(),
    setGlobal,
    setGame,
    setAll,
    clearOverrides: clear,
    isGlobalComing: isGlobalComing(status),
    isSiegeComing: isGameComing("siege", status),
    isRunComing: isGameComing("run", status),
  };
}
