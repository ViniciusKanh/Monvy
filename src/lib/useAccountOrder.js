import { useCallback, useState } from 'react';

const KEY = 'monvy_account_order';

function read() {
  try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}

// Ordem manual das contas (arrastar e soltar) é uma preferência pessoal de
// exibição, guardada no dispositivo — sem precisar de coluna no banco,
// no mesmo espírito do useFavoriteAccounts.
export function useAccountOrder() {
  const [order, setOrder] = useState(read);

  const persist = useCallback((next) => {
    setOrder(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }, []);

  // Aplica a ordem manual salva sobre uma lista de contas: contas já
  // ordenadas antes permanecem na frente; contas novas (sem ordem salva)
  // são anexadas ao final, preservando a ordem recebida.
  const applyOrder = useCallback((accounts) => {
    if (!order.length) return accounts;
    const byId = new Map(accounts.map((a) => [a.id, a]));
    const ordered = order.map((id) => byId.get(id)).filter(Boolean);
    const known = new Set(order);
    const rest = accounts.filter((a) => !known.has(a.id));
    return [...ordered, ...rest];
  }, [order]);

  // Move a conta `draggedId` para a posição de `targetId`, a partir da
  // lista atualmente exibida (já na ordem visível na tela).
  const moveTo = useCallback((visibleIds, draggedId, targetId) => {
    if (draggedId === targetId) return;
    const ids = [...visibleIds];
    const from = ids.indexOf(draggedId);
    const to = ids.indexOf(targetId);
    if (from === -1 || to === -1) return;
    ids.splice(from, 1);
    ids.splice(to, 0, draggedId);
    persist(ids);
  }, [persist]);

  const hasCustomOrder = order.length > 0;
  const resetOrder = useCallback(() => persist([]), [persist]);

  return { order, applyOrder, moveTo, hasCustomOrder, resetOrder };
}
