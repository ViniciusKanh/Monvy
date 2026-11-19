import { db, ensureSchema, newId, nowIso } from '../_lib/db.js';
import { sendJson } from '../_lib/auth.js';
import { getMailConfig } from '../_lib/settings.js';
import { sendMail, tpl, itemsTable, itemRow } from '../_lib/mailer.js';

const brl = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
const fmtDate = (d) => new Date(String(d).slice(0, 10) + 'T00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

function baseUrl(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return host ? `${req.headers['x-forwarded-proto'] || 'https'}://${host}` : '';
}
async function notify(uid, { kind = 'info', title, text = '', path = '' }) {
  try { await db().execute({ sql: `INSERT INTO Notification (id,kind,title,text,path,read,created_by_id,created_date,updated_date) VALUES (?,?,?,?,?,0,?,?,?)`, args: [newId(), kind, title, text, path, uid, nowIso(), nowIso()] }); } catch {}
}

// vencimentos (lancamentos pendentes + faturas) até t3
async function vencData(uid, t0, t3) {
  const tx = (await db().execute({
    sql: `SELECT date, amount, type, description FROM "Transaction"
          WHERE created_by_id = ? AND (is_deleted IS NULL OR is_deleted=0) AND type != 'transfer'
          AND status = 'pending' AND substr(date,1,10) <= ? ORDER BY date ASC`, args: [uid, t3],
  })).rows;
  const inv = (await db().execute({
    sql: `SELECT due_date, total_amount, competence_month FROM CreditCardInvoice
          WHERE created_by_id = ? AND (is_deleted IS NULL OR is_deleted=0) AND status IN ('open','overdue')
          AND due_date IS NOT NULL AND substr(due_date,1,10) <= ? ORDER BY due_date ASC`, args: [uid, t3],
  })).rows;
  const rows = [];
  for (const t of tx) { const od = String(t.date).slice(0, 10) < t0; rows.push(itemRow(t.description || (t.type === 'income' ? 'Recebimento' : 'Pagamento'), `${od ? 'VENCIDO · ' : 'vence '}${fmtDate(t.date)}`, brl(t.amount), t.type === 'income' ? '#059669' : '#e11d48')); }
  for (const i of inv) { const od = String(i.due_date).slice(0, 10) < t0; rows.push(itemRow(`Fatura de cartão ${i.competence_month || ''}`, `${od ? 'VENCIDA · ' : 'vence '}${fmtDate(i.due_date)}`, brl(i.total_amount), '#6d28d9')); }
  const total = tx.reduce((s, t) => s + (t.type === 'expense' ? Number(t.amount) : 0), 0) + inv.reduce((s, i) => s + Number(i.total_amount || 0), 0);
  return { rows, total, count: tx.length + inv.length };
}

// categorias que passaram de um % do limite no mês (pct=100 => estourado)
async function budgetRows(uid, ym, pct = 100) {
  const cats = (await db().execute({ sql: `SELECT id, name, budget_limit FROM Category WHERE created_by_id = ? AND budget_limit IS NOT NULL AND budget_limit > 0`, args: [uid] })).rows;
  if (!cats.length) return [];
  const spend = (await db().execute({ sql: `SELECT category_id, SUM(amount) AS total FROM "Transaction" WHERE created_by_id = ? AND type = 'expense' AND (is_deleted IS NULL OR is_deleted = 0) AND substr(date,1,7) = ? GROUP BY category_id`, args: [uid, ym] })).rows;
  const sm = Object.fromEntries(spend.map((r) => [r.category_id, Number(r.total) || 0]));
  const rows = [];
  for (const c of cats) { const lim = Number(c.budget_limit); const sp = sm[c.id] || 0; const used = Math.round((sp / lim) * 100); if (used >= pct) rows.push(itemRow(`${used >= 100 ? 'Orcamento estourado' : 'Orcamento em alerta'}: ${c.name}`, `${used}% do limite (${brl(lim)})`, brl(sp), used >= 100 ? '#e11d48' : '#f59e0b')); }
  return rows;
}

// Cron diario (08h BRT): alertas globais de vencimentos e orcamento por usuário
export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const ok = req.headers.authorization === `Bearer ${secret}` || req.query.key === secret;
    if (!ok) return sendJson(res, 401, { error: 'Não autorizado' });
  }
  try {
    await ensureSchema();
    const cfg = await getMailConfig();
    const envSmtp = !!(process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS);
    if (!cfg.enabled && !envSmtp) return sendJson(res, 200, { skipped: 'e-mail não configurado' });

    const today = new Date();
    const t0 = today.toISOString().slice(0, 10);
    const t3 = new Date(today.getTime() + 3 * 86400000).toISOString().slice(0, 10);
    const ym = t0.slice(0, 7);

    const users = (await db().execute(`SELECT id, email, full_name FROM users WHERE email_verified = 1`)).rows;
    let sent = 0;

    // 1) alertas globais (se o admin ativou "Alertas")
    if (cfg.notifyAlerts) {
      for (const u of users) {
        const venc = await vencData(u.id, t0, t3);
        const budget = await budgetRows(u.id, ym);
        if (!venc.count && !budget.length) continue;
        // dedupe: se já mandamos o alerta diário hoje para este usuário, não repete
        const already = (await db().execute({ sql: `SELECT 1 FROM Notification WHERE created_by_id=? AND kind='reminder' AND substr(created_date,1,10)=? LIMIT 1`, args: [u.id, t0] })).rows[0];
        if (already) continue;
        let body = `Olá${u.full_name ? ' ' + u.full_name : ''}, aqui esta o resumo dos seus alertas:`;
        if (venc.rows.length) body += `<div style="margin-top:12px;font-weight:700;color:#0b1330">Vencimentos próximos ou em atraso</div>${itemsTable(venc.rows)}<div style="margin-top:6px;color:#0b1330;font-weight:700">Total a pagar: ${brl(venc.total)}</div>`;
        if (budget.length) body += `<div style="margin-top:16px;font-weight:700;color:#0b1330">Orcamento do mês</div>${itemsTable(budget)}`;
        body += `<div style="margin-top:12px">Acesse o Monvy para conciliar e manter tudo em dia.</div>`;
        await sendMail({ to: u.email, subject: `Monvy — você tem ${venc.count + budget.length} alerta(s)`, html: tpl('Seus alertas do Monvy ⏰', body) });
        await notify(u.id, { kind: 'reminder', title: `Você tem ${venc.count + budget.length} alerta(s) financeiro(s)`, text: 'Vencimentos próximos e/ou orcamento do mês.', path: '/pagamentos' });
        sent++;
      }
    }

    return sendJson(res, 200, { ok: true, usuarios: users.length, alertas: sent });
  } catch (e) { return sendJson(res, 500, { error: e.message }); }
}
