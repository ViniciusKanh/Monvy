import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);
const KEY = 'monvy_theme';
const ACCENT_KEY = 'monvy_accent';

// Paletas de destaque (accent). rgb em "R G B" (usado por --acc) e primary em HSL.
export const ACCENTS = [
  { k: 'emerald', label: 'Esmeralda', rgb: '16 185 129', primary: '158 64% 42%', hex: '#10b981' },
  { k: 'blue', label: 'Azul', rgb: '59 130 246', primary: '217 91% 60%', hex: '#3b82f6' },
  { k: 'violet', label: 'Violeta', rgb: '139 92 246', primary: '258 90% 66%', hex: '#8b5cf6' },
  { k: 'indigo', label: 'Indigo', rgb: '99 102 241', primary: '239 84% 67%', hex: '#6366f1' },
  { k: 'teal', label: 'Teal', rgb: '20 184 166', primary: '173 80% 40%', hex: '#14b8a6' },
  { k: 'rose', label: 'Rosa', rgb: '244 63 94', primary: '347 77% 60%', hex: '#f43f5e' },
  { k: 'amber', label: 'Ambar', rgb: '245 158 11', primary: '38 92% 50%', hex: '#f59e0b' },
  { k: 'sky', label: 'Ciano', rgb: '14 165 233', primary: '199 89% 48%', hex: '#0ea5e9' },
];

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem(KEY) || 'light'; } catch { return 'light'; } });
  const [accent, setAccent] = useState(() => { try { return localStorage.getItem(ACCENT_KEY) || 'emerald'; } catch { return 'emerald'; } });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('light', theme !== 'dark');
    try { localStorage.setItem(KEY, theme); } catch {}
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    const a = ACCENTS.find((x) => x.k === accent) || ACCENTS[0];
    if (a.k === 'emerald') { root.style.removeProperty('--acc'); root.style.removeProperty('--primary'); }
    else { root.style.setProperty('--acc', a.rgb); root.style.setProperty('--primary', a.primary); }
    try { localStorage.setItem(ACCENT_KEY, accent); } catch {}
  }, [accent]);

  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  return <ThemeContext.Provider value={{ theme, setTheme, toggle, accent, setAccent }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
