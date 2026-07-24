// Mini pub/sub de notificacoes (funciona fora de componentes React tambem)
let listeners = [];
let id = 0;
export function subscribe(fn) { listeners.push(fn); return () => { listeners = listeners.filter((l) => l !== fn); }; }
function emit(type, message) {
  const t = { id: ++id, type, message: String(message || '') };
  listeners.forEach((l) => l(t));
}
export const toast = {
  success: (m) => emit('success', m),
  error: (m) => emit('error', m),
  info: (m) => emit('info', m),
};
