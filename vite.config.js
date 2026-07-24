import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

// Carrega .env em process.env para as funcoes de API rodarem no dev local
function loadEnv() {
  const p = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !(m[1] in process.env)) {
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      process.env[m[1]] = v;
    }
  }
}

// Mapeia a URL para o arquivo da funcao (mesma logica do Vercel)
function resolveHandler(pathname) {
  if (pathname.startsWith('/api/auth/')) return 'api/auth/[action].js';
  if (pathname.startsWith('/api/entities/')) return 'api/entities/[...path].js';
  if (pathname.startsWith('/api/admin/')) return 'api/admin/[...slug].js';
  if (pathname.startsWith('/api/ai/')) return 'api/ai/[action].js';
  if (pathname === '/api/cards/invoices') return 'api/cards/invoices.js';
  if (pathname === '/api/cron/reminders') return 'api/cron/reminders.js';
  if (pathname === '/api/reports/email') return 'api/reports/email.js';
  if (pathname === '/api/bootstrap') return 'api/bootstrap.js';
  if (pathname === '/api/summary') return 'api/summary.js';
  return null;
}

// Plugin: executa as funcoes serverless dentro do dev server do Vite
function apiDevServer() {
  return {
    name: 'monvy-api-dev',
    configureServer(server) {
      loadEnv();
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) return next();
        const send = (code, obj) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)); };
        try {
          const u = new URL(req.url, 'http://localhost');
          const file = resolveHandler(u.pathname);
          if (!file) return send(404, { error: 'Rota nao encontrada' });
          req.query = Object.fromEntries(u.searchParams.entries());
          const mod = await server.ssrLoadModule('/' + file);
          await mod.default(req, res);
        } catch (e) {
          server.config.logger.error('[api] ' + (e.stack || e.message));
          send(500, { error: e.message });
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), apiDevServer()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: { port: 5173 },
});
