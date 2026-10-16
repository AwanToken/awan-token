import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { LANGS, translations, type Dict, type Lang } from "./translations";

const LS_LANG = "awn_miniapp_lang";

function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(LS_LANG) as Lang | null;
    if (saved && translations[saved]) return saved;
  } catch {
    /* ignore */
  }
  const nav = (navigator.language || "en").toLowerCase();
  if (nav.startsWith("it")) return "it";
  if (nav.startsWith("ru")) return "ru";
  if (nav.startsWith("zh")) return "zh";
  return "en";
}

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Dict;
  langs: typeof LANGS;
};

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => detectLang());

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(LS_LANG, l);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({
      lang,
      setLang,
      t: translations[lang],
      langs: LANGS,
    }),
    [lang, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n outside provider");
  return ctx;
}
