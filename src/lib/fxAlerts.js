// Watchlist de cambio salva localmente (localStorage). Sem backend.
const KEY = 'monvy_fx_alerts';

export function getFxAlerts() {
  try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
export function setFxAlerts(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignore */ }
}
export function addFxAlert(alert) {
  const list = getFxAlerts();
  list.push({ id: `${alert.code}-${alert.dir}-${Date.now()}`, ...alert });
  setFxAlerts(list);
  return list;
}
export function removeFxAlert(id) {
  const list = getFxAlerts().filter((a) => a.id !== id);
  setFxAlerts(list);
  return list;
}
// avalia se um alerta foi atingido dado o valor atual
export function isHit(alert, current) {
  if (!current) return false;
  return alert.dir === 'above' ? current >= alert.value : current <= alert.value;
}
