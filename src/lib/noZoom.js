// Bloqueia o zoom da pagina (Ctrl/Cmd + "+" / "-", Ctrl + roda do mouse,
// pinca no trackpad/Safari e pinca no mobile). O Monvy e um sistema com layout
// em grid pensado para 100%; o zoom do navegador quebra a distribuicao dos
// componentes. Ctrl/Cmd + 0 continua liberado para quem ja tinha um zoom salvo
// voltar ao 100%. O zoom pelo menu do navegador nao pode ser bloqueado por JS.
const ZOOM_KEYS = new Set(['+', '=', '-', '_', 'Add', 'Subtract']);
const ZOOM_CODES = new Set(['Equal', 'Minus', 'NumpadAdd', 'NumpadSubtract']);

export function installNoZoom() {
  if (typeof window === 'undefined' || window.__monvyNoZoom) return;
  window.__monvyNoZoom = true;

  window.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    if (ZOOM_KEYS.has(e.key) || ZOOM_CODES.has(e.code)) e.preventDefault();
  }, { capture: true });

  // Ctrl + roda (e pinca no trackpad do Chrome/Edge, que chega como wheel+ctrlKey)
  window.addEventListener('wheel', (e) => { if (e.ctrlKey || e.metaKey) e.preventDefault(); }, { passive: false, capture: true });

  // Safari (gestos de pinca no trackpad/iOS)
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
  }

  // Pinca com dois dedos no mobile
  document.addEventListener('touchmove', (e) => { if (e.touches && e.touches.length > 1) e.preventDefault(); }, { passive: false });
}
