import { createClient } from '@libsql/client';
import { SCHEMA_STATEMENTS, MIGRATIONS } from './schema.js';

let _client = null;
let _schemaReady = false;

export function db() {
  if (!_client) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url) throw new Error('TURSO_DATABASE_URL nao configurada');
    _client = withRetry(createClient({ url, authToken }));
  }
  return _client;
}

// O Turso as vezes responde 502/503/504 por alguns instantes (ex.: banco "acordando"
// ou troca de no). Sem retry, qualquer tela que abre nesse momento mostra
// "SERVER_ERROR: Server returned HTTP status 502". Repetimos ate 3x com espera curta
// apenas para erros transitorios de servidor/rede; erros de SQL sobem na hora.
const TRANSIENT = /HTTP status 50[234]|SERVER_ERROR|fetch failed|ECONNRESET|ETIMEDOUT|socket hang up/i;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function withRetry(client) {
  const wrap = (fn) => async (...args) => {
    let lastErr;
    for (let attempt = 0; attempt < 3; attempt++) {
      try { return await fn(...args); }
      catch (e) {
        lastErr = e;
        const msg = `${e?.code || ''} ${e?.message || ''} ${e?.cause?.message || ''}`;
        if (!TRANSIENT.test(msg) || attempt === 2) break;
        await sleep(250 * (attempt + 1) ** 2);
      }
    }
    throw lastErr;
  };
  client.execute = wrap(client.execute.bind(client));
  if (typeof client.batch === 'function') client.batch = wrap(client.batch.bind(client));
  return client;
}

// Garante que todas as tabelas existam (idempotente). Roda 1x por cold start.
export async function ensureSchema() {
  if (_schemaReady) return;
  const c = db();
  for (const stmt of SCHEMA_STATEMENTS) {
    await c.execute(stmt);
  }
  // migrations versionadas (idempotentes)
  let applied = [];
  try {
    const r = await c.execute({ sql: "SELECT value FROM Setting WHERE key = 'migrations_applied'", args: [] });
    if (r.rows[0]?.value) applied = JSON.parse(r.rows[0].value);
  } catch { applied = []; }
  for (const m of MIGRATIONS) {
    if (applied.includes(m.id)) continue;
    for (const stmt of m.statements) { try { await c.execute(stmt); } catch (e) { /* ja existe */ } }
    applied.push(m.id);
  }
  await c.execute({ sql: "INSERT INTO Setting (key, value) VALUES ('migrations_applied', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", args: [JSON.stringify(applied)] });
  _schemaReady = true;
}

export function newId() {
  // ID curto ordenavel: timestamp base36 + random
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10)
  );
}

export function nowIso() {
  return new Date().toISOString();
}
