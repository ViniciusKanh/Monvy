import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { Toaster } from './components/Toaster.jsx';
import { toast } from './lib/toast.js';
import './index.css';

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
        <BrowserRouter>
          <AuthProvider>
            <App />
            <Toaster />
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
