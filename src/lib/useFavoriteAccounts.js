import { useCallback, useState } from 'react';

const KEY = 'monvy_favorite_accounts';

function read() {
  try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}

// Favoritos de conta são uma preferência pessoal de exibição (ordenar/realçar
// no dashboard); guardados no dispositivo, sem precisar de coluna no banco.
export function useFavoriteAccounts() {
  const [ids, setIds] = useState(read);
  const toggle = useCallback((id) => {
    setIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);
  const isFavorite = useCallback((id) => ids.includes(id), [ids]);
  return { favoriteIds: ids, isFavorite, toggle };
}
