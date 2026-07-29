import { db, ensureSchema } from '../_lib/db.js';
import { sendJson } from '../_lib/auth.js';
import { getMailConfig } from '../_lib/settings.js';
import { sendMail, tpl, itemsTable, itemRow } from '../_lib/mailer.js';

const brl = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
const fmtDate = (d) => new Date(String(d).slice(0, 10) + 'T00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

// Cron diario: envia lembretes de faturas/lancamentos a vencer (3 dias) e vencidos
export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const ok = req.headers.authorization === `Bearer ${secret}` || req.query.key === secret;
    if (!ok) return sendJson(res, 401, { error: 'Nao autorizado' });
  }
  try {
    await ensureSchema();
    const cfg = await getMailConfig();
    if (!cfg.enabled || !cfg.notifyAlerts) return sendJson(res, 200, { skipped: 'envio desabilitado' });

    const today = new Date(); const t0 = today.toISOString().slice(0, 10);
    const limit = new Date(); limit.setDate(today.getDate() + 3); const t3 = limit.toISOString().slice(0, 10);

    const users = (await db().execute(`SELECT id, email, full_name FROM users WHERE email_verified = 1`)).rows;
    let sent = 0;
    for (const u of users) {
      // lancamentos pendentes a vencer (0-3 dias) ou vencidos
      const tx = (await db().execute({
        sql: `SELECT date, amount, type, description FROM "Transaction"
              WHERE created_by_id = ? AND (is_deleted IS NULL OR is_deleted=0) AND type != 'transfer'
              AND status = 'pending' AND substr(date,1,10) <= ? ORDER BY date ASC`,
        args: [u.id, t3],
      })).rows;
      // faturas abertas a vencer
      const inv = (await db().execute({
        sql: `SELECT due_date, total_amount, competence_month FROM CreditCardInvoice
              WHERE created_by_id = ? AND (is_deleted IS NULL OR is_deleted=0) AND status IN ('open','overdue')
              AND due_date IS NOT NULL AND substr(due_date,1,10) <= ? ORDER BY due_date ASC`,
        args: [u.id, t3],
      })).rows;

      // orcamento estourado no mes corrente
      const ym = t0.slice(0, 7);
      const cats = (await db().execute({
        sql: `SELECT id, name, budget_limit FROM Category WHERE created_by_id = ? AND budget_limit IS NOT NULL AND budget_limit > 0`,
        args: [u.id],
      })).rows;
      const budgetRows = [];
      if (cats.length) {
        const spend = (await db().execute({
          sql: `SELECT category_id, SUM(amount) AS total FROM "Transaction"
                WHERE created_by_id = ? AND type = 'expense' AND (is_deleted IS NULL OR is_deleted = 0)
                AND substr(date,1,7) = ? GROUP BY category_id`,
          args: [u.id, ym],
        })).rows;
        const sm = Object.fromEntries(spend.map((r) => [r.category_id, Number(r.total) || 0]));
        for (const c of cats) { const sp = sm[c.id] || 0; if (sp > Number(c.budget_limit)) budgetRows.push(itemRow(`Orcamento estourado: ${c.name}`, `limite ${brl(c.budget_limit)}`, brl(sp), '#e11d48')); }
      }

      if (!tx.length && !inv.length && !budgetRows.length) continue;

      const rows = [];
      for (const t of tx) {
        const overdue = String(t.date).slice(0, 10) < t0;
        rows.push(itemRow(t.description || (t.type === 'income' ? 'Recebimento' : 'Pagamento'), `${overdue ? 'VENCIDO · ' : 'vence '}${fmtDate(t.date)}`, brl(t.amount), t.type === 'income' ? '#059669' : '#e11d48'));
      }
      for (const i of inv) {
        const overdue = String(i.due_date).slice(0, 10) < t0;
        rows.push(itemRow(`Fatura de cartao ${i.competence_month || ''}`, `${overdue ? 'VENCIDA · ' : 'vence '}${fmtDate(i.due_date)}`, brl(i.total_amount), '#6d28d9'));
      }
      const total = tx.reduce((s, t) => s + (t.type === 'expense' ? Number(t.amount) : 0), 0) + inv.reduce((s, i) => s + Number(i.total_amount || 0), 0);

      let body = `Ola${u.full_name ? ' ' + u.full_name : ''}, aqui esta o resumo dos seus alertas:`;
      if (rows.length) body += `<div style="margin-top:12px;font-weight:700;color:#0b1330">Vencimentos proximos ou em atraso</div>${itemsTable(rows)}<div style="margin-top:6px;color:#0b1330;font-weight:700">Total a pagar: ${brl(total)}</div>`;
      if (budgetRows.length) body += `<div style="margin-top:16px;font-weight:700;color:#0b1330">Orcamento do mes</div>${itemsTable(budgetRows)}`;
      body += `<div style="margin-top:12px">Acesse o Monvy para conciliar e manter tudo em dia.</div>`;
      const count = tx.length + inv.length + budgetRows.length;

      await sendMail({
        to: u.email,
        subject: `Monvy — voce tem ${count} alerta(s)`,
        html: tpl(`Seus alertas do Monvy ⏰`, body),
      });
      sent++;
    }
    return sendJson(res, 200, { ok: true, usuarios: users.length, emails: sent });
  } catch (e) { return sendJson(res, 500, { error: e.message }); }
}
