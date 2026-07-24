import { db, newId, nowIso } from './db.js';

// Recalcula current_balance de todas as contas do usuario a partir do
// initial_balance + soma das transacoes (income/expense/transfer).
export async function recalcAllAccounts(ownerId) {
  const accs = await db().execute({
    sql: `SELECT id, initial_balance FROM Account
          WHERE created_by_id = ? AND (is_deleted IS NULL OR is_deleted = 0)`,
    args: [ownerId],
  });
  for (const acc of accs.rows) {
    const id = acc.id;
    const init = Number(acc.initial_balance || 0);

    const inc = await sumTx(ownerId, `account_id = ? AND type = 'income'`, [id]);
    const exp = await sumTx(ownerId, `account_id = ? AND type = 'expense'`, [id]);
    const outT = await sumTx(ownerId, `account_id = ? AND type = 'transfer'`, [id]);
    const inT = await sumTx(ownerId, `account_to_id = ? AND type = 'transfer'`, [id]);

    const balance = init + inc - exp - outT + inT;
    await db().execute({
      sql: `UPDATE Account SET current_balance = ?, updated_date = ? WHERE id = ?`,
      args: [balance, new Date().toISOString(), id],
    });
  }
}

async function sumTx(ownerId, cond, extraArgs) {
  const r = await db().execute({
    sql: `SELECT COALESCE(SUM(amount),0) AS total FROM "Transaction"
          WHERE created_by_id = ? AND (is_deleted IS NULL OR is_deleted = 0)
          AND (status = 'completed' OR status IS NULL) AND ${cond}`,
    args: [ownerId, ...extraArgs],
  });
  return Number(r.rows[0]?.total || 0);
}


// Materializa lancamentos fixos mensais em registros reais ate o mes atual (idempotente)
export async function materializeRecurrences(owner) {
  const nowMonth = new Date().toISOString().slice(0, 7);
  const parents = (await db().execute({
    sql: `SELECT * FROM "Transaction" WHERE created_by_id = ? AND (is_deleted IS NULL OR is_deleted=0)
          AND is_fixed = 1 AND recurrence = 'monthly' AND (parent_transaction_id IS NULL OR parent_transaction_id = '')`,
    args: [owner],
  })).rows;
  for (const p of parents) {
    const origMonth = String(p.date).slice(0, 7);
    if (origMonth >= nowMonth) continue;
    const children = (await db().execute({ sql: `SELECT date FROM "Transaction" WHERE created_by_id = ? AND parent_transaction_id = ?`, args: [owner, p.id] })).rows;
    const have = new Set(children.map((c) => String(c.date).slice(0, 7)));
    have.add(origMonth);
    const day = String(p.date).slice(8, 10) || '01';
    let [y, m] = origMonth.split('-').map(Number);
    let guard = 0;
    while (guard++ < 120) {
      m++; if (m > 12) { m = 1; y++; }
      const mk = `${y}-${String(m).padStart(2, '0')}`;
      if (mk > nowMonth) break;
      if (have.has(mk)) continue;
      const now = nowIso();
      await db().execute({
        sql: `INSERT INTO "Transaction" (id,date,amount,type,account_id,account_to_id,category_id,description,is_fixed,recurrence,parent_transaction_id,tags,status,created_by_id,created_date,updated_date)
              VALUES (?,?,?,?,?,?,?,?,0,'none',?, '[]','pending',?,?,?)`,
        args: [newId(), `${mk}-${day}`, p.amount, p.type, p.account_id, p.account_to_id, p.category_id, p.description, p.id, owner, now, now],
      });
    }
  }
}
