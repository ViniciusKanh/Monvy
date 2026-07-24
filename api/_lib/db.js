import { createClient } from '@libsql/client';
import { SCHEMA_STATEMENTS, SAFE_ALTERS } from './schema.js';

let _client = null;
let _schemaReady = false;

export function db() {
  if (!_client) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url) throw new Error('TURSO_DATABASE_URL nao configurada');
    _client = createClient({ url, authToken });
  }
  return _client;
}

// Garante que todas as tabelas existam (idempotente). Roda 1x por cold start.
export async function ensureSchema() {
  if (_schemaReady) return;
  const c = db();
  for (const stmt of SCHEMA_STATEMENTS) {
    await c.execute(stmt);
  }
  for (const stmt of SAFE_ALTERS) {
    try { await c.execute(stmt); } catch (e) { /* coluna ja existe */ }
  }
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
