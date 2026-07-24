import { db, ensureSchema } from './_lib/db.js';
import { getAuth, sendJson } from './_lib/auth.js';

// GET /api/summary?month=YYYY-MM  -> totais agregados no banco (escalavel)
export default async function handler(req, res) {
  try {
    await ensureSchema();
    const auth = getAuth(req);
    if (!auth) return sendJson(res, 401, { error: 'Nao autenticado' });
    const o = auth.sub;
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const done = `(status = 'completed' OR status IS NULL)`;

    const totals = await db().execute({
      sql: `SELECT
              COALESCE(SUM(CASE WHEN type='income' THEN amount END),0) AS inc,
              COALESCE(SUM(CASE WHEN type='expense' THEN amount END),0) AS exp,
              COALESCE(SUM(CASE WHEN type='income' AND ${done} THEN amount END),0) AS inc_done,
              COALESCE(SUM(CASE WHEN type='expense' AND ${done} THEN amount END),0) AS exp_done,
              COUNT(*) AS n
            FROM "Transaction"
            WHERE created_by_id = ? AND (is_deleted IS NULL OR is_deleted=0) AND substr(date,1,7) = ?`,
      args: [o, month],
    });
    const byCat = await db().execute({
      sql: `SELECT category_id, COALESCE(SUM(amount),0) AS total
            FROM "Transaction"
            WHERE created_by_id = ? AND (is_deleted IS NULL OR is_deleted=0) AND type='expense' AND substr(date,1,7) = ?
            GROUP BY category_id ORDER BY total DESC`,
      args: [o, month],
    });
    const bal = await db().execute({
      sql: `SELECT COALESCE(SUM(current_balance),0) AS total FROM Account WHERE created_by_id = ? AND (is_deleted IS NULL OR is_deleted=0)`,
      args: [o],
    });
    const t = totals.rows[0];
    return sendJson(res, 200, {
      month,
      income: Number(t.inc), expense: Number(t.exp),
      incomeDone: Number(t.inc_done), expenseDone: Number(t.exp_done),
      net: Number(t.inc) - Number(t.exp), count: Number(t.n),
      totalBalance: Number(bal.rows[0].total),
      byCategory: byCat.rows.map((r) => ({ category_id: r.category_id, total: Number(r.total) })),
    });
  } catch (e) { return sendJson(res, 500, { error: e.message }); }
}
