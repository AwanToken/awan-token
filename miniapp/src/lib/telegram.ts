/** Thin wrapper around window.Telegram.WebApp */

export type TelegramUserInfo = {
  id: number;
  username?: string;
  first_name?: string;
};

/** Persisted / owner-panel friendly shape (camelCase). */
export type TelegramIdentity = {
  id: number;
  username?: string;
  firstName?: string;
};

export function getWebApp(): TelegramWebApp | null {
  return typeof window !== "undefined" ? window.Telegram?.WebApp ?? null : null;
}

export function initTelegram() {
  const wa = getWebApp();
  if (!wa) return false;
  try {
    wa.ready();
    wa.expand();
    // Lock chrome to dark neon — Telegram light theme was bleeding pink/white into the UI
    const dark = "#070312";
    wa.setHeaderColor?.(dark);
    wa.setBackgroundColor?.(dark);
    document.documentElement.style.backgroundColor = dark;
    document.body.style.backgroundColor = dark;
  } catch {
    /* browser preview without Telegram */
  }
  return true;
}

/** Current Telegram Mini App user from `initDataUnsafe` (null outside Telegram). */
export function getTelegramUser(): TelegramUserInfo | null {
  const u = getWebApp()?.initDataUnsafe?.user;
  if (!u || typeof u.id !== "number") return null;
  return {
    id: u.id,
    username: u.username,
    first_name: u.first_name,
  };
}

export function toTelegramIdentity(user: TelegramUserInfo | null | undefined): TelegramIdentity | undefined {
  if (!user) return undefined;
  return {
    id: user.id,
    username: user.username,
    firstName: user.first_name,
  };
}

/** `@username` or `FirstName · id:123` when username missing. */
export function formatTelegramHandle(
  identity: TelegramIdentity | TelegramUserInfo | null | undefined,
): string {
  if (!identity) return "";
  const username =
    "username" in identity && identity.username
      ? identity.username
      : undefined;
  if (username) return `@${username.replace(/^@/, "")}`;
  const first =
    "firstName" in identity
      ? identity.firstName
      : "first_name" in identity
        ? identity.first_name
        : undefined;
  if (first) return `${first} · id:${identity.id}`;
  return `id:${identity.id}`;
}

export function haptic(style: "light" | "medium" | "heavy" = "light") {
  try {
    getWebApp()?.HapticFeedback?.impactOccurred(style);
  } catch {
    /* ignore */
  }
}

export function openExternal(url: string) {
  const wa = getWebApp();
  if (wa?.openLink) {
    wa.openLink(url);
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
