import { useState, useEffect } from 'react';

const KEY = 'monvy_hide_balances';
const listeners = new Set();

// Hook compartilhado: esconder/mostrar saldos em qualquer tela, sincronizado.
export function useHideBalances() {
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } });
  useEffect(() => { const fn = (v) => setHidden(v); listeners.add(fn); return () => { listeners.delete(fn); }; }, []);
  const toggle = () => {
    setHidden((prev) => {
      const v = !prev;
      try { localStorage.setItem(KEY, v ? '1' : '0'); } catch { /* ignore */ }
      listeners.forEach((f) => f(v));
      return v;
    });
  };
  return [hidden, toggle];
}
