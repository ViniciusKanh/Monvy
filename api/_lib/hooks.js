import { db } from './db.js';

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
