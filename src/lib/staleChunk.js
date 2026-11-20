import { toast } from './toast.js';

// Depois de um novo deploy, uma aba aberta antigamente pode tentar buscar um
// chunk (JS dividido por rota/import dinamico) que ja nao existe mais no build
// atual — aparece como "Failed to fetch dynamically imported module" e afins.
// Helpers compartilhados entre o handler global (main.jsx) e pontos de import
// dinamico especificos (ex.: leitura de fatura em PDF nos Cartões).
export function isStaleChunkError(reason) {
  const msg = String(reason?.message || reason || '');
  return /fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Loading chunk .* failed|ChunkLoadError/i.test(msg);
}

export function reloadOnceForFreshVersion() {
  const key = 'monvy_stale_chunk_reload_at';
  const last = Number(sessionStorage.getItem(key) || 0);
  if (Date.now() - last < 15000) return false; // ja tentamos ha pouco, nao insiste (evita loop)
  sessionStorage.setItem(key, String(Date.now()));
  toast.info('Nova versão do Monvy disponível — atualizando a página...');
  setTimeout(() => window.location.reload(), 600);
  return true;
}
