import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { LangProvider } from './context/LangContext.jsx';
import { Toaster } from './components/Toaster.jsx';
import { toast } from './lib/toast.js';
import { isStaleChunkError, reloadOnceForFreshVersion } from './lib/staleChunk.js';
import './index.css';
import { installNoZoom } from './lib/noZoom.js';

// Sistema com layout fixo em grid: sem zoom do navegador (Ctrl +/-, Ctrl+roda, pinca)
installNoZoom();

// Depois de um novo deploy, uma aba aberta antigamente pode tentar buscar um
// chunk (JS dividido por rota/import dinamico) que ja nao existe mais no build
// atual. Isso aparece como "Failed to fetch dynamically imported module" ou
// "error loading dynamically imported module". Nao recarregamos sem avisar:
// mostramos um aviso e recarregamos uma unica vez (evita loop infinito).
window.addEventListener('vite:preloadError', (e) => { e.preventDefault(); reloadOnceForFreshVersion(); });
window.addEventListener('unhandledrejection', (e) => { if (isStaleChunkError(e.reason) && reloadOnceForFreshVersion()) e.preventDefault(); });

// Erros de qualquer query/mutation viram toast visivel (nada mais falha em silencio)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000, gcTime: 5 * 60_000 },
    mutations: { retry: 0 },
  },
  queryCache: new QueryCache({
    onError: (err) => { if (err?.status !== 401) toast.error(err?.message || 'Erro ao carregar dados'); },
  }),
  mutationCache: new MutationCache({
    onError: (err) => toast.error(err?.message || 'Erro ao salvar'),
  }),
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LangProvider>
          <BrowserRouter>
            <AuthProvider>
              <App />
              <Toaster />
            </AuthProvider>
          </BrowserRouter>
        </LangProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
