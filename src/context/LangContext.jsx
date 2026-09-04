import { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { LANGS, translate } from '../lib/i18n.js';

const LangContext = createContext(null);
const KEY = 'monvy_lang';

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved && LANGS.some((l) => l.code === saved)) return saved;
      const nav = (navigator.language || 'pt').slice(0, 2);
      return LANGS.some((l) => l.code === nav) ? nav : 'pt';
    } catch { return 'pt'; }
  });

  useEffect(() => {
    const meta = LANGS.find((l) => l.code === lang) || LANGS[0];
    const root = document.documentElement;
    root.setAttribute('lang', lang);
    root.setAttribute('dir', meta.dir || 'ltr');
    try { localStorage.setItem(KEY, lang); } catch { /* ignore */ }
  }, [lang]);

  const setLang = useCallback((code) => { if (LANGS.some((l) => l.code === code)) setLangState(code); }, []);
  const t = useCallback((key, fallback) => translate(lang, key, fallback), [lang]);

  return <LangContext.Provider value={{ lang, setLang, t, langs: LANGS }}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  // Fallback seguro caso algum componente seja montado fora do provider
  if (!ctx) return { lang: 'pt', setLang: () => {}, t: (k, f) => (f != null ? f : k), langs: LANGS };
  return ctx;
}

// Atalho para quem só precisa da função de tradução
export const useT = () => useLang().t;
