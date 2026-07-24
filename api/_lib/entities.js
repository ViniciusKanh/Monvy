import { db, newId, nowIso } from './db.js';
import { ENTITIES, JSON_FIELDS, BOOL_FIELDS } from './schema.js';

const _cols = {}; // cache de colunas por tabela

function sqlName(entity) {
  const n = ENTITIES[entity];
  if (!n) throw new Error('Entidade invalida: ' + entity);
  return n;
}
function rawName(entity) {
  return sqlName(entity).replace(/"/g, '');
}

async function columns(entity) {
  const raw = rawName(entity);
  if (_cols[raw]) return _cols[raw];
  const r = await db().execute(`PRAGMA table_info(${sqlName(entity)})`);
  _cols[raw] = r.rows.map((row) => row.name);
  return _cols[raw];
}

function isJsonField(entity, col) {
  return (JSON_FIELDS[entity] || []).includes(col);
}
function isBoolField(entity, col) {
  return (BOOL_FIELDS[entity] || []).includes(col);
}

// Converte valor JS -> valor para o banco
function toDb(entity, col, val) {
  if (val === undefined) return null;
  if (isJsonField(entity, col)) return JSON.stringify(val ?? (Array.isArray(val) ? [] : {}));
  if (isBoolField(entity, col)) return val ? 1 : 0;
  if (typeof val === 'boolean') return val ? 1 : 0;
  return val;
}

// Converte linha do banco -> objeto JS
function fromDb(entity, row) {
  const out = { ...row };
  for (const col of JSON_FIELDS[entity] || []) {
    if (typeof out[col] === 'string') {
      try { out[col] = JSON.parse(out[col]); } catch { /* keep */ }
    }
  }
  for (const col of BOOL_FIELDS[entity] || []) {
    if (out[col] !== undefined && out[col] !== null) out[col] = !!out[col];
  }
  return out;
}

export async function listRows(entity, ownerId, filters = {}) {
  const cols = await columns(entity);
  const where = ['(is_deleted IS NULL OR is_deleted = 0)'];
  const args = [];
  if (cols.includes('created_by_id')) { where.push('created_by_id = ?'); args.push(ownerId); }
  for (const [k, v] of Object.entries(filters)) {
    if (cols.includes(k)) { where.push(`${k} = ?`); args.push(v); }
  }
  const orderCol = cols.includes('date') ? 'date' : (cols.includes('created_date') ? 'created_date' : cols[0]);
  const sql = `SELECT * FROM ${sqlName(entity)} WHERE ${where.join(' AND ')} ORDER BY ${orderCol} DESC`;
  const r = await db().execute({ sql, args });
  return r.rows.map((row) => fromDb(entity, row));
}

export async function getRow(entity, ownerId, id) {
  const r = await db().execute({
    sql: `SELECT * FROM ${sqlName(entity)} WHERE id = ?`,
    args: [id],
  });
  if (!r.rows.length) return null;
  const row = fromDb(entity, r.rows[0]);
  if (row.created_by_id && ownerId && row.created_by_id !== ownerId) return null;
  return row;
}

export async function createRow(entity, ownerId, data) {
  const cols = await columns(entity);
  const now = nowIso();
  const record = { ...data };
  record.id = newId();
  if (cols.includes('created_date')) record.created_date = now;
  if (cols.includes('updated_date')) record.updated_date = now;
  if (cols.includes('created_by_id')) record.created_by_id = ownerId;

  const useCols = cols.filter((c) => record[c] !== undefined);
  const placeholders = useCols.map(() => '?').join(', ');
  const args = useCols.map((c) => toDb(entity, c, record[c]));
  await db().execute({
    sql: `INSERT INTO ${sqlName(entity)} (${useCols.join(', ')}) VALUES (${placeholders})`,
    args,
  });
  return getRow(entity, ownerId, record.id);
}

export async function bulkCreate(entity, ownerId, items) {
  const out = [];
  for (const it of items) out.push(await createRow(entity, ownerId, it));
  return out;
}

export async function updateRow(entity, ownerId, id, data) {
  const existing = await getRow(entity, ownerId, id);
  if (!existing) return null;
  const cols = await columns(entity);
  const patch = { ...data };
  if (cols.includes('updated_date')) patch.updated_date = nowIso();
  delete patch.id; delete patch.created_by_id; delete patch.created_date;

  const useCols = cols.filter((c) => patch[c] !== undefined);
  if (!useCols.length) return existing;
  const setClause = useCols.map((c) => `${c} = ?`).join(', ');
  const args = useCols.map((c) => toDb(entity, c, patch[c]));
  args.push(id);
  await db().execute({
    sql: `UPDATE ${sqlName(entity)} SET ${setClause} WHERE id = ?`,
    args,
  });
  return getRow(entity, ownerId, id);
}

export async function deleteRow(entity, ownerId, id) {
  const existing = await getRow(entity, ownerId, id);
  if (!existing) return false;
  const cols = await columns(entity);
  if (cols.includes('is_deleted')) {
    await db().execute({ sql: `UPDATE ${sqlName(entity)} SET is_deleted = 1 WHERE id = ?`, args: [id] });
  } else {
    await db().execute({ sql: `DELETE FROM ${sqlName(entity)} WHERE id = ?`, args: [id] });
  }
  return true;
}
