import { db, ensureSchema, newId, nowIso } from '../_lib/db.js';
import { getAuth, sendJson, readBody } from '../_lib/auth.js';
import { pluggyConfigured, createConnectToken, getItem, deleteItem, listAccounts, listTransactions } from '../_lib/pluggy.js';

async function connections(o) {
  const r = await db().execute({ sql: `SELECT * FROM BankConnection WHERE created_by_id=? AND (is_deleted IS NULL OR is_deleted=0) ORDER BY created_date DESC`, args: [o] });
  return r.rows;
}

// GET /api/integrations/status -> { configured, connectUrl, connections:[...] }
export async function status(req, res) {
  await ensureSchema();
  const auth = getAuth(req); if (!auth) return sendJson(res, 401, { error: 'Nao autenticado' });
  const conns = await connections(auth.sub);
  return sendJson(res, 200, {
    configured: pluggyConfigured(),
    // URL do widget pode ser sobrescrita por env se a versao mudar
    connectUrl: process.env.PLUGGY_CONNECT_URL || 'https://cdn.pluggy.ai/pluggy-connect/latest/pluggy-connect.js',
    connections: conns.map((c) => ({ id: c.id, item_id: c.item_id, institution: c.institution, image_url: c.image_url, status: c.status, last_synced_at: c.last_synced_at })),
  });
}

// POST /api/integrations/connect-token  { itemId? } -> { accessToken }
export async function connectToken(req, res) {
  await ensureSchema();
  const auth = getAuth(req); if (!auth) return sendJson(res, 401, { error: 'Nao autenticado' });
  if (!pluggyConfigured()) return sendJson(res, 400, { error: 'Pluggy nao configurado no servidor.' });
  try {
    const { itemId } = await readBody(req);
    const accessToken = await createConnectToken({ itemId, clientUserId: auth.sub });
    return sendJson(res, 200, { accessToken });
  } catch (e) { return sendJson(res, 502, { error: e.message }); }
}

// POST /api/integrations/save-item  { itemId } -> guarda a conexao
export async function saveItem(req, res) {
  await ensureSchema();
  const auth = getAuth(req); if (!auth) return sendJson(res, 401, { error: 'Nao autenticado' });
  const o = auth.sub;
  try {
    const { itemId } = await readBody(req);
    if (!itemId) return sendJson(res, 400, { error: 'itemId ausente' });
    const item = await getItem(itemId);
    const inst = item?.connector?.name || 'Instituicao';
    const img = item?.connector?.imageUrl || null;
    const st = item?.status || 'UPDATED';
    const existing = (await db().execute({ sql: `SELECT id FROM BankConnection WHERE created_by_id=? AND item_id=?`, args: [o, itemId] })).rows[0];
    if (existing) {
      await db().execute({ sql: `UPDATE BankConnection SET institution=?, image_url=?, status=?, is_deleted=0, updated_date=? WHERE id=?`, args: [inst, img, st, nowIso(), existing.id] });
    } else {
      await db().execute({ sql: `INSERT INTO BankConnection (id,provider,item_id,connector_id,institution,image_url,status,created_by_id,created_date,updated_date) VALUES (?,?,?,?,?,?,?,?,?,?)`, args: [newId(), 'pluggy', itemId, String(item?.connector?.id || ''), inst, img, st, o, nowIso(), nowIso()] });
    }
    return sendJson(res, 200, { ok: true, institution: inst });
  } catch (e) { return sendJson(res, 502, { error: e.message }); }
}

// POST /api/integrations/transactions  { from, to } -> transacoes agregadas dos bancos conectados
export async function transactions(req, res) {
  await ensureSchema();
  const auth = getAuth(req); if (!auth) return sendJson(res, 401, { error: 'Nao autenticado' });
  const o = auth.sub;
  try {
    const { from, to } = await readBody(req);
    const conns = await connections(o);
    const out = [];
    for (const c of conns) {
      try {
        const accounts = await listAccounts(c.item_id);
        for (const a of accounts) {
          const txs = await listTransactions(a.id, { from, to });
          for (const t of txs) out.push({ ...t, institution: c.institution, account: a.name || a.type });
        }
        await db().execute({ sql: `UPDATE BankConnection SET last_synced_at=?, updated_date=? WHERE id=?`, args: [nowIso(), nowIso(), c.id] });
      } catch (e) { /* uma conexao com erro nao derruba as demais */ }
    }
    return sendJson(res, 200, { transactions: out, count: out.length });
  } catch (e) { return sendJson(res, 502, { error: e.message }); }
}

// POST /api/integrations/disconnect  { id } -> revoga no Pluggy + remove
export async function disconnect(req, res) {
  await ensureSchema();
  const auth = getAuth(req); if (!auth) return sendJson(res, 401, { error: 'Nao autenticado' });
  const o = auth.sub;
  try {
    const { id } = await readBody(req);
    const row = (await db().execute({ sql: `SELECT * FROM BankConnection WHERE id=? AND created_by_id=?`, args: [id, o] })).rows[0];
    if (!row) return sendJson(res, 404, { error: 'Conexao nao encontrada' });
    try { await deleteItem(row.item_id); } catch { /* ja pode ter sido removido no Pluggy */ }
    await db().execute({ sql: `UPDATE BankConnection SET is_deleted=1, updated_date=? WHERE id=?`, args: [nowIso(), id] });
    return sendJson(res, 200, { ok: true });
  } catch (e) { return sendJson(res, 500, { error: e.message }); }
}
