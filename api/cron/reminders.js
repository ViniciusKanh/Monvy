import { db, ensureSchema } from '../_lib/db.js';
import { sendJson } from '../_lib/auth.js';
import { getMailConfig } from '../_lib/settings.js';
import { sendMail, tpl, itemsTable, itemRow } from '../_lib/mailer.js';

const brl = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
const fmtDate = (d) => new Date(String(d).slice(0, 10) + 'T00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

// vencimentos (lancamentos pendentes + faturas) ate t3
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
  for (const i of inv) { const od = String(i.due_date).slice(0, 10) < t0; rows.push(itemRow(`Fatura de cartao ${i.competence_month || ''}`, `${od ? 'VENCIDA · ' : 'vence '}${fmtDate(i.due_date)}`, brl(i.total_amount), '#6d28d9')); }
  const total = tx.reduce((s, t) => s + (t.type === 'expense' ? Number(t.amount) : 0), 0) + inv.reduce((s, i) => s + Number(i.total_amount || 0), 0);
  return { rows, total, count: tx.length + inv.length };
}

// categorias que passaram de um % do limite no mes (pct=100 => estourado)
async function budgetRows(uid, ym, pct = 100) {
  const cats = (await db().execute({ sql: `SELECT id, name, budget_limit FROM Category WHERE created_by_id = ? AND budget_limit IS NOT NULL AND budget_limit > 0`, args: [uid] })).rows;
  if (!cats.length) return [];
  const spend = (await db().execute({ sql: `SELECT category_id, SUM(amount) AS total FROM "Transaction" WHERE created_by_id = ? AND type = 'expense' AND (is_deleted IS NULL OR is_deleted = 0) AND substr(date,1,7) = ? GROUP BY category_id`, args: [uid, ym] })).rows;
  const sm = Object.fromEntries(spend.map((r) => [r.category_id, Number(r.total) || 0]));
  const rows = [];
  for (const c of cats) { const lim = Number(c.budget_limit); const sp = sm[c.id] || 0; const used = Math.round((sp / lim) * 100); if (used >= pct) rows.push(itemRow(`${used >= 100 ? 'Orcamento estourado' : 'Orcamento em alerta'}: ${c.name}`, `${used}% do limite (${brl(lim)})`, brl(sp), used >= 100 ? '#e11d48' : '#f59e0b')); }
  return rows;
}

// saldo total das contas
async function totalBalanceOf(uid) {
  return Number((await db().execute({ sql: `SELECT COALESCE(SUM(current_balance),0) t FROM Account WHERE created_by_id = ? AND (is_deleted IS NULL OR is_deleted=0)`, args: [uid] })).rows[0]?.t || 0);
}
// receita/despesa/taxa de poupanca do mes (inclui cartao)
async function monthRate(uid, ym) {
  const agg = (await db().execute({ sql: `SELECT type, SUM(amount) tot FROM "Transaction" WHERE created_by_id = ? AND (is_deleted IS NULL OR is_deleted=0) AND type != 'transfer' AND substr(date,1,7)=? GROUP BY type`, args: [uid, ym] })).rows;
  const m = Object.fromEntries(agg.map((r) => [r.type, Number(r.tot) || 0]));
  const cardExp = Number((await db().execute({ sql: `SELECT COALESCE(SUM(amount),0) t FROM CreditCardTransaction WHERE created_by_id = ? AND (is_deleted IS NULL OR is_deleted=0) AND COALESCE(competence_month,substr(date,1,7))=?`, args: [uid, ym] })).rows[0]?.t || 0);
  const inc = m.income || 0; const exp = (m.expense || 0) + cardExp;
  return { inc, exp, rate: inc > 0 ? ((inc - exp) / inc) * 100 : 0 };
}
// gastos elevados recentes (ultimas 48h) acima de um valor
async function bigExpenses(uid, amount, since) {
  const rows = (await db().execute({ sql: `SELECT date, amount, description FROM "Transaction" WHERE created_by_id = ? AND type='expense' AND (is_deleted IS NULL OR is_deleted=0) AND amount >= ? AND substr(date,1,10) >= ? ORDER BY amount DESC`, args: [uid, amount, since] })).rows;
  return rows.map((r) => itemRow(r.description || 'Gasto', fmtDate(r.date), brl(r.amount), '#e11d48'));
}
// faturas de cartao a vencer em ate N dias
async function invoicesDue(uid, tN) {
  const rows = (await db().execute({ sql: `SELECT due_date, total_amount, competence_month FROM CreditCardInvoice WHERE created_by_id = ? AND (is_deleted IS NULL OR is_deleted=0) AND status IN ('open','overdue') AND due_date IS NOT NULL AND substr(due_date,1,10) <= ? ORDER BY due_date ASC`, args: [uid, tN] })).rows;
  return rows.map((r) => itemRow(`Fatura ${r.competence_month || ''}`, `vence ${fmtDate(r.due_date)}`, brl(r.total_amount), '#6d28d9'));
}

// panorama financeiro do mes (para gatilho de resumo)
async function summaryBody(u, ym) {
  const bal = Number((await db().execute({ sql: `SELECT COALESCE(SUM(current_balance),0) t FROM Account WHERE created_by_id = ? AND (is_deleted IS NULL OR is_deleted=0)`, args: [u.id] })).rows[0]?.t || 0);
  const agg = (await db().execute({ sql: `SELECT type, SUM(amount) tot FROM "Transaction" WHERE created_by_id = ? AND (is_deleted IS NULL OR is_deleted=0) AND type != 'transfer' AND substr(date,1,7) = ? GROUP BY type`, args: [u.id, ym] })).rows;
  const m = Object.fromEntries(agg.map((r) => [r.type, Number(r.tot) || 0]));
  const inc = m.income || 0;
  const cardExp = Number((await db().execute({ sql: `SELECT COALESCE(SUM(amount),0) t FROM CreditCardTransaction WHERE created_by_id = ? AND (is_deleted IS NULL OR is_deleted=0) AND COALESCE(competence_month, substr(date,1,7)) = ?`, args: [u.id, ym] })).rows[0]?.t || 0);
  const exp = (m.expense || 0) + cardExp;
  const sobra = inc - exp;
  const rate = inc > 0 ? (sobra / inc) * 100 : 0;
  const saved = Number((await db().execute({ sql: `SELECT COALESCE(SUM(current_amount),0) t FROM Goal WHERE created_by_id = ? AND (is_deleted IS NULL OR is_deleted=0)`, args: [u.id] })).rows[0]?.t || 0);
  const rows = [
    itemRow('Saldo total em contas', 'todas as contas', brl(bal), '#0b1330'),
    itemRow('Receitas do mes', '', brl(inc), '#059669'),
    itemRow('Despesas do mes', 'inclui o cartao', brl(exp), '#e11d48'),
    itemRow('Sobra do mes', sobra >= 0 ? 'no azul' : 'no vermelho', brl(sobra), sobra >= 0 ? '#059669' : '#e11d48'),
    itemRow('Guardado em cofres/metas', '', brl(saved), '#6366f1'),
  ];
  return `Ola${u.full_name ? ' ' + u.full_name : ''}, aqui esta o seu panorama financeiro:${itemsTable(rows)}<div style="margin-top:8px;color:#0b1330;font-weight:700">Taxa de poupanca: ${rate.toFixed(0)}%</div><div style="margin-top:10px">Acesse o Monvy para ver os detalhes e planejar melhor.</div>`;
}

// Cron diario (08h BRT): alertas globais + gatilhos personalizados por usuario
export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const ok = req.headers.authorization === `Bearer ${secret}` || req.query.key === secret;
    if (!ok) return sendJson(res, 401, { error: 'Nao autorizado' });
  }
  try {
    await ensureSchema();
    const cfg = await getMailConfig();
    if (!cfg.enabled) return sendJson(res, 200, { skipped: 'e-mail nao configurado' });

    const today = new Date();
    const t0 = today.toISOString().slice(0, 10);
    const t3 = new Date(today.getTime() + 3 * 86400000).toISOString().slice(0, 10);
    const ym = t0.slice(0, 7);
    const dow = today.getUTCDay();
    const dom = today.getUTCDate();

    const users = (await db().execute(`SELECT id, email, full_name FROM users WHERE email_verified = 1`)).rows;
    let sent = 0, trig = 0;

    // 1) alertas globais (se o admin ativou "Alertas")
    if (cfg.notifyAlerts) {
      for (const u of users) {
        const venc = await vencData(u.id, t0, t3);
        const budget = await budgetRows(u.id, ym);
        if (!venc.count && !budget.length) continue;
        let body = `Ola${u.full_name ? ' ' + u.full_name : ''}, aqui esta o resumo dos seus alertas:`;
        if (venc.rows.length) body += `<div style="margin-top:12px;font-weight:700;color:#0b1330">Vencimentos proximos ou em atraso</div>${itemsTable(venc.rows)}<div style="margin-top:6px;color:#0b1330;font-weight:700">Total a pagar: ${brl(venc.total)}</div>`;
        if (budget.length) body += `<div style="margin-top:16px;font-weight:700;color:#0b1330">Orcamento do mes</div>${itemsTable(budget)}`;
        body += `<div style="margin-top:12px">Acesse o Monvy para conciliar e manter tudo em dia.</div>`;
        await sendMail({ to: u.email, subject: `Monvy — voce tem ${venc.count + budget.length} alerta(s)`, html: tpl('Seus alertas do Monvy ⏰', body) });
        sent++;
      }
    }

    // 2) gatilhos personalizados (cada usuario cria os seus)
    for (const u of users) {
      const trigs = (await db().execute({ sql: `SELECT * FROM Trigger WHERE created_by_id = ? AND enabled = 1 AND (is_deleted IS NULL OR is_deleted=0)`, args: [u.id] })).rows;
      for (const tr of trigs) {
        const runToday = tr.frequency === 'daily' || (tr.frequency === 'weekly' && Number(tr.weekday) === dow) || (tr.frequency === 'monthly' && dom === 1);
        if (!runToday) continue;
        let cfg = {}; try { cfg = tr.config ? JSON.parse(tr.config) : {}; } catch { cfg = {}; }
        const greet = `Ola${u.full_name ? ' ' + u.full_name : ''}`;
        try {
          if (tr.type === 'financial_summary') {
            await sendMail({ to: u.email, subject: 'Monvy — seu resumo financeiro', html: tpl('Seu resumo financeiro 📊', await summaryBody(u, ym)) }); trig++;
          } else if (tr.type === 'upcoming_bills') {
            const days = Number(cfg.days ?? 3); const tN = new Date(today.getTime() + days * 86400000).toISOString().slice(0, 10);
            const venc = await vencData(u.id, t0, tN);
            if (venc.rows.length) { await sendMail({ to: u.email, subject: 'Monvy — vencimentos proximos', html: tpl('Vencimentos proximos ⏰', `${greet}, estes compromissos vencem nos proximos ${days} dia(s):${itemsTable(venc.rows)}<div style="margin-top:6px;font-weight:700;color:#0b1330">Total: ${brl(venc.total)}</div>`) }); trig++; }
          } else if (tr.type === 'budget_alert') {
            const pct = Number(cfg.pct ?? 90); const budget = await budgetRows(u.id, ym, pct);
            if (budget.length) { await sendMail({ to: u.email, subject: 'Monvy — orcamento do mes', html: tpl('Orcamento do mes 📉', `${greet}, categorias que atingiram ${pct}% do limite:${itemsTable(budget)}`) }); trig++; }
          } else if (tr.type === 'low_balance') {
            const amount = Number(cfg.amount ?? 0); const bal = await totalBalanceOf(u.id);
            if (amount > 0 && bal < amount) { await sendMail({ to: u.email, subject: 'Monvy — saldo baixo', html: tpl('Atencao: saldo baixo 🔻', `${greet}, seu saldo total nas contas esta em <b>${brl(bal)}</b>, abaixo do limite que voce definiu (${brl(amount)}). Vale revisar os gastos.`) }); trig++; }
          } else if (tr.type === 'savings_below') {
            const pct = Number(cfg.pct ?? 10); const r = await monthRate(u.id, ym);
            if (r.inc > 0 && r.rate < pct) { await sendMail({ to: u.email, subject: 'Monvy — poupanca abaixo da meta', html: tpl('Poupanca abaixo da meta 🎯', `${greet}, sua taxa de poupanca do mes esta em <b>${r.rate.toFixed(0)}%</b>, abaixo da sua meta de ${pct}%. Receitas ${brl(r.inc)} · despesas ${brl(r.exp)}.`) }); trig++; }
          } else if (tr.type === 'big_expense') {
            const amount = Number(cfg.amount ?? 0); const since = new Date(today.getTime() - 2 * 86400000).toISOString().slice(0, 10);
            const rows = await bigExpenses(u.id, amount, since);
            if (amount > 0 && rows.length) { await sendMail({ to: u.email, subject: 'Monvy — gasto elevado', html: tpl('Gasto elevado detectado 💳', `${greet}, registramos gasto(s) acima de ${brl(amount)} nos ultimos dias:${itemsTable(rows)}`) }); trig++; }
          } else if (tr.type === 'invoice_due') {
            const days = Number(cfg.days ?? 5); const tN = new Date(today.getTime() + days * 86400000).toISOString().slice(0, 10);
            const rows = await invoicesDue(u.id, tN);
            if (rows.length) { await sendMail({ to: u.email, subject: 'Monvy — fatura a vencer', html: tpl('Fatura de cartao a vencer 🧾', `${greet}, fatura(s) a vencer nos proximos ${days} dia(s):${itemsTable(rows)}`) }); trig++; }
          }
        } catch { /* nao quebra os demais */ }
      }
    }

    return sendJson(res, 200, { ok: true, usuarios: users.length, alertas: sent, gatilhos: trig });
  } catch (e) { return sendJson(res, 500, { error: e.message }); }
}
