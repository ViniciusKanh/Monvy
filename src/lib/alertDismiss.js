// Dispensa de alertas COMPUTADOS (que não têm linha no banco).
// Guarda por id a "assinatura" (título+texto) dispensada. O alerta volta a
// aparecer só se mudar de conteúdo (ou seja, é um alerta novo/atualizado).

const KEY = 'monvy_dismissed_alerts';

function readAll() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
function writeAll(obj) {
  try { localStorage.setItem(KEY, JSON.stringify(obj)); } catch { /* ignore */ }
}

export const sigOf = (a) => `${a.title || ''}|${a.text || ''}`;

export function isDismissed(a) {
  const all = readAll();
  return all[a.id] === sigOf(a);
}

export function dismissAlert(a) {
  const all = readAll();
  all[a.id] = sigOf(a);
  writeAll(all);
}

export function dismissMany(alerts) {
  const all = readAll();
  for (const a of alerts) all[a.id] = sigOf(a);
  writeAll(all);
}
