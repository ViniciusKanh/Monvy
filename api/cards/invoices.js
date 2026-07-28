import { db, ensureSchema, newId, nowIso } from '../_lib/db.js';
import { getAuth, sendJson, readBody } from '../_lib/auth.js';
import { createRow } from '../_lib/entities.js';
import { recalcAllAccounts } from '../_lib/hooks.js';

const pad = (n) => String(n).padStart(2, '0');
function addMonth(month, delta) { let [y, m] = month.split('-').map(Number); m += delta; while (m > 12) { m -= 12; y++; } while (m < 1) { m += 12; y--; } return `${y}-${pad(m)}`; }

// POST /api/cards/invoices  { action: 'generate' } | { action: 'pay', invoiceId, accountId }
export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Metodo nao permitido' });
  try {
    await ensureSchema();
    const auth = getAuth(req);
    if (!auth) return sendJson(res, 401, { error: 'Nao autenticado' });
    const o = auth.sub;
    const body = await readBody(req);

    if (body.action === 'pay') {
      const inv = (await db().execute({ sql: 'SELECT * FROM CreditCardInvoice WHERE id = ? AND created_by_id = ?', args: [body.invoiceId, o] })).rows[0];
      if (!inv) return sendJson(res, 404, { error: 'Fatura nao encontrada' });
      if (inv.status === 'paid') return sendJson(res, 400, { error: 'Fatura ja paga' });
      const card = (await db().execute({ sql: 'SELECT name FROM CreditCard WHERE id = ?', args: [inv.card_id] })).rows[0];
      const total = Number(inv.total_amount || 0);
      // pagamento vira um lancamento real (cash) que debita a conta
      const tx = await createRow('Transaction', o, {
        date: nowIso().slice(0, 10), amount: total, type: 'expense', account_id: body.accountId,
        description: `Fatura ${inv.competence_month} - ${card?.name || 'cartao'}`, status: 'completed',
      });
      await db().execute({ sql: `UPDATE CreditCardInvoice SET status='paid', paid_date=?, paid_amount=?, payment_transaction_id=?, updated_date=? WHERE id=?`, args: [nowIso().slice(0, 10), total, tx.id, nowIso(), inv.id] });
      await recalcAllAccounts(o);
      return sendJson(res, 200, { ok: true });
    }

    // generate: agrupa compras por cartao + competencia e faz upsert das faturas
    const cards = (await db().execute({ sql: 'SELECT id, closing_day, due_day FROM CreditCard WHERE created_by_id = ? AND (is_deleted IS NULL OR is_deleted=0)', args: [o] })).rows;
    const cardMap = Object.fromEntries(cards.map((c) => [c.id, c]));
    const groups = (await db().execute({
      sql: `SELECT card_id, COALESCE(competence_month, substr(date,1,7)) AS cm, COALESCE(SUM(amount),0) AS total, COUNT(*) AS n
            FROM CreditCardTransaction WHERE created_by_id = ? AND (is_deleted IS NULL OR is_deleted=0)
            GROUP BY card_id, cm`,
      args: [o],
    })).rows;
    const existing = (await db().execute({ sql: 'SELECT id, card_id, competence_month, status FROM CreditCardInvoice WHERE created_by_id = ?', args: [o] })).rows;
    const exMap = {}; existing.forEach((e) => { exMap[`${e.card_id}|${e.competence_month}`] = e; });
    const today = nowIso().slice(0, 10);
    let created = 0, updated = 0;

    for (const g of groups) {
      const card = cardMap[g.card_id]; if (!card) continue;
      const cm = g.cm;
      const closing = `${cm}-${pad(Math.min(28, card.closing_day || 1))}`;
      const dueMonth = (card.due_day || 10) < (card.closing_day || 1) ? addMonth(cm, 1) : cm;
      const due = `${dueMonth}-${pad(Math.min(28, card.due_day || 10))}`;
      const ex = exMap[`${g.card_id}|${cm}`];
      if (ex) {
        if (ex.status !== 'paid') {
          const status = due < today ? 'overdue' : 'open';
          await db().execute({ sql: `UPDATE CreditCardInvoice SET total_amount=?, closing_date=?, due_date=?, status=?, updated_date=? WHERE id=?`, args: [Number(g.total), closing, due, status, nowIso(), ex.id] });
          updated++;
        }
      } else {
        const status = due < today ? 'overdue' : 'open';
        await db().execute({
          sql: `INSERT INTO CreditCardInvoice (id,card_id,competence_month,total_amount,due_date,closing_date,status,created_by_id,created_date,updated_date)
                VALUES (?,?,?,?,?,?,?,?,?,?)`,
          args: [newId(), g.card_id, cm, Number(g.total), due, closing, status, o, nowIso(), nowIso()],
        });
        created++;
      }
    }
    return sendJson(res, 200, { ok: true, created, updated });
  } catch (e) { return sendJson(res, 500, { error: e.message }); }
}
