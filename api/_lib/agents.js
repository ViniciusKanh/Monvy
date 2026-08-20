// Avaliacao de robos em TEMPO REAL (event-driven), disparada quando os dados mudam.
// Complementa o cron diario: aqui os robos com CONDICOES sao checados na hora.
import { db, newId, nowIso } from './db.js';
import { getMailConfig } from './settings.js';
import { sendMail, tpl, itemsTable, itemRow } from './mailer.js';

const numv = (v) => { const x = Number(v); return isNaN(x) ? 0 : x; };
const opTest = (op, a, b) => ({ lt: a < b, lte: a <= b, gt: a > b, gte: a >= b, eq: Math.abs(a - b) < 0.005 }[op] ?? false);
const OP_LABEL = { lt: 'menor que', lte: 'menor ou igual a', gt: 'maior que', gte: 'maior ou igual a', eq: 'igual a' };
const METRIC_LABEL = { total_balance: 'Saldo total das contas', month_balance: 'Saldo do mes', month_income: 'Receita do mes', month_expense: 'Despesa do mes', savings_rate: 'Taxa de poupanca', category_spend: 'Gasto na categoria', pending_count: 'Vencidos nao pagos', net_worth: 'Patrimonio liquido', open_tickets: 'Chamados em aberto', debt_monthly: 'Parcelas de dividas/mes', goals_saved: 'Guardado em metas', card_invoice_total: 'Faturas de cartao em aberto', investments_total: 'Total investido' };
const UNIT = { savings_rate: '%', pending_count: 'un', open_tickets: 'un' };
const brl = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numv(v));
const fmtMetric = (m, v) => { const u = UNIT[m]; if (u === '%') return `${numv(v).toFixed(0)}%`; if (u === 'un') return String(Math.round(numv(v))); return brl(v); };

async function q1(sql, args = []) { return numv((await db().execute({ sql, args })).rows[0]?.t || 0); }

async function buildCtx(uid, ym) {
  const total_balance = await q1(`SELECT COALESCE(SUM(current_balance),0) t FROM Account WHERE created_by_id=? AND (is_deleted IS NULL OR is_deleted=0)`, [uid]);
  const agg = (await db().execute({ sql: `SELECT type, SUM(amount) tot FROM "Transaction" WHERE created_by_id=? AND (is_deleted IS NULL OR is_deleted=0) AND type!='transfer' AND substr(date,1,7)=? GROUP BY type`, args: [uid, ym] })).rows;
  const m = Object.fromEntries(agg.map((r) => [r.type, numv(r.tot)]));
  const cardExp = await q1(`SELECT COALESCE(SUM(amount),0) t FROM CreditCardTransaction WHERE created_by_id=? AND (is_deleted IS NULL OR is_deleted=0) AND COALESCE(competence_month,substr(date,1,7))=?`, [uid, ym]);
  const inc = m.income || 0; const exp = (m.expense || 0) + cardExp;
  const inv = await q1(`SELECT COALESCE(SUM(COALESCE(current_value,invested_amount,0)),0) t FROM Investment WHERE created_by_id=? AND (is_deleted IS NULL OR is_deleted=0)`, [uid]);
  const dRows = (await db().execute({ sql: `SELECT installment_amount, installments, paid_installments, total_amount FROM Debt WHERE created_by_id=? AND (is_deleted IS NULL OR is_deleted=0)`, args: [uid] })).rows;
  const debt = dRows.reduce((s, d) => { const rest = numv(d.installment_amount) * Math.max(0, numv(d.installments) - numv(d.paid_installments)); return s + (rest || numv(d.total_amount)); }, 0);
  const debtMonthly = dRows.reduce((s, d) => (numv(d.installments) - numv(d.paid_installments) > 0 ? s + numv(d.installment_amount) : s), 0);
  const t0 = new Date().toISOString().slice(0, 10);
  const pending = Math.round(await q1(`SELECT COUNT(*) t FROM "Transaction" WHERE created_by_id=? AND type!='transfer' AND (is_deleted IS NULL OR is_deleted=0) AND status='pending' AND substr(date,1,10)<=?`, [uid, t0]));
  const openTickets = Math.round(await q1(`SELECT COUNT(*) t FROM SupportTicket WHERE created_by_id=? AND (is_deleted IS NULL OR is_deleted=0) AND resolved_date IS NULL`, [uid]));
  const goals = await q1(`SELECT COALESCE(SUM(current_amount),0) t FROM Goal WHERE created_by_id=? AND (is_deleted IS NULL OR is_deleted=0)`, [uid]);
  const cardInv = await q1(`SELECT COALESCE(SUM(total_amount),0) t FROM CreditCardInvoice WHERE created_by_id=? AND (is_deleted IS NULL OR is_deleted=0) AND status IN ('open','overdue')`, [uid]);
  return {
    total_balance, month_income: inc, month_expense: exp, month_balance: inc - exp,
    savings_rate: inc > 0 ? ((inc - exp) / inc) * 100 : 0, pending_count: pending,
    net_worth: total_balance + inv - debt, open_tickets: openTickets, debt_monthly: debtMonthly,
    goals_saved: goals, card_invoice_total: cardInv, investments_total: inv,
  };
}
async function categorySpend(uid, ym, catId) {
  if (!catId) return 0;
  const a = await q1(`SELECT COALESCE(SUM(amount),0) t FROM "Transaction" WHERE created_by_id=? AND type='expense' AND (is_deleted IS NULL OR is_deleted=0) AND category_id=? AND substr(date,1,7)=?`, [uid, catId, ym]);
  const c = await q1(`SELECT COALESCE(SUM(amount),0) t FROM CreditCardTransaction WHERE created_by_id=? AND (is_deleted IS NULL OR is_deleted=0) AND category_id=? AND COALESCE(competence_month,substr(date,1,7))=?`, [uid, catId, ym]);
  return a + c;
}
async function notify(uid, { kind = 'alert', title, text = '', path = '/agentes' }) {
  await db().execute({ sql: `INSERT INTO Notification (id,kind,title,text,path,read,is_deleted,created_date,updated_date,created_by_id) VALUES (?,?,?,?,?,0,0,?,?,?)`, args: [newId(), kind, title, text, path, nowIso(), nowIso(), uid] });
}
const parseCfg = (t) => { try { return t.config ? (typeof t.config === 'string' ? JSON.parse(t.config) : t.config) : null; } catch { return null; } };

// Avalia os robos do usuario AGORA (por evento). So dispara robos com condicoes; respeita cooldown.
export async function evaluateAgentsEvent(uid) {
  try {
    const user = (await db().execute({ sql: `SELECT id, email, full_name FROM users WHERE id=?`, args: [uid] })).rows[0];
    if (!user) return 0;
    const trigs = (await db().execute({ sql: `SELECT * FROM Trigger WHERE created_by_id=? AND enabled=1 AND (is_deleted IS NULL OR is_deleted=0)`, args: [uid] })).rows;
    if (!trigs.length) return 0;
    const ym = new Date().toISOString().slice(0, 7);
    const t3 = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    let ctx = null; let mail = null; let fired = 0;
    const now = Date.now();

    for (const tr of trigs) {
      const c = parseCfg(tr); if (!c || !c.monitor) continue;
      const conditions = Array.isArray(c.conditions) ? c.conditions : [];
      if (!conditions.length) continue; // sem condicao = digest (fica pro cron)

      // cooldown: nao repetir dentro da janela (cooldownDays dias, ou 6h por padrao)
      const gapMs = (Number(c.cooldownDays) > 0 ? Number(c.cooldownDays) * 86400000 : 6 * 3600000);
      if (tr.last_fired) { const last = new Date(String(tr.last_fired)).getTime(); if (isFinite(last) && (now - last) < gapMs) continue; }

      if (!ctx) ctx = await buildCtx(uid, ym);
      const evals = [];
      for (const cond of conditions) {
        const val = cond.metric === 'category_spend' ? await categorySpend(uid, ym, cond.categoryId) : (ctx[cond.metric] ?? 0);
        evals.push({ cond, val, ok: opTest(cond.op, val, Number(cond.value)) });
      }
      const pass = c.match === 'any' ? evals.some((e) => e.ok) : evals.every((e) => e.ok);
      if (!pass) continue;

      if (mail === null) mail = await getMailConfig();
      const acts = Array.isArray(c.actions) && c.actions.length ? c.actions : (c.action ? [{ action: c.action, subject: c.subject, message: c.message }] : [{ action: 'notify' }]);
      const situacaoTxt = evals.map((e) => `${METRIC_LABEL[e.cond.metric] || e.cond.metric}: ${fmtMetric(e.cond.metric, e.val)}`).join(' · ');
      let did = 0;

      for (const act of acts) {
        if (act.action === 'email_summary' || act.action === 'email_bills') continue; // digests ficam pro cron
        const title = (act.subject && act.subject.trim()) || tr.name || 'Alerta do robo';
        const msg = (act.message && act.message.trim()) || situacaoTxt || 'Uma condicao monitorada foi atingida.';
        if (act.action === 'open_ticket') {
          const subj = title;
          const exists = (await db().execute({ sql: `SELECT id FROM SupportTicket WHERE created_by_id=? AND subject=? AND (is_deleted IS NULL OR is_deleted=0) AND resolved_date IS NULL`, args: [uid, subj] })).rows[0];
          if (!exists) {
            const id = newId(); const number = Math.round(await q1(`SELECT COALESCE(MAX(number),1000) t FROM SupportTicket`, [])) + 1;
            await db().execute({ sql: `INSERT INTO SupportTicket (id,number,subject,status,category,priority,user_name,user_email,created_by_id,created_date,updated_date) VALUES (?,?,?,?,?,?,?,?,?,?,?)`, args: [id, number, subj, 'open', act.ticketCategory || 'Financeiro', 'alta', user.full_name || '', user.email, uid, nowIso(), nowIso()] });
            await db().execute({ sql: `INSERT INTO TicketMessage (id,ticket_id,author_id,author_role,author_name,body,created_date) VALUES (?,?,?,?,?,?,?)`, args: [newId(), id, uid, 'user', 'Robo Monvy', `${msg}\n\nSituacao: ${situacaoTxt}`, nowIso()] });
            await notify(uid, { kind: 'ticket', title: `Chamado #${number} aberto por robo`, text: subj, path: '/chamados' });
            did++;
          }
        } else if (act.action === 'email_alert') {
          await notify(uid, { kind: 'alert', title, text: msg });
          if (mail.enabled && user.email) {
            const rows = evals.map((e) => itemRow(METRIC_LABEL[e.cond.metric] || e.cond.metric, `condicao: ${OP_LABEL[e.cond.op]} ${fmtMetric(e.cond.metric, Number(e.cond.value))}`, fmtMetric(e.cond.metric, e.val), '#e11d48'));
            await sendMail({ to: user.email, subject: `Monvy — ${title}`, html: tpl(`${title} 🤖`, `Ola${user.full_name ? ' ' + user.full_name : ''},<br/><br/>${String(msg).replace(/</g, '&lt;')}<div style="margin-top:12px;font-weight:700;color:#0b1330">Situacao atual</div>${itemsTable(rows)}`) }).catch(() => {});
          }
          did++;
        } else { // notify (padrao)
          await notify(uid, { kind: 'alert', title, text: msg });
          did++;
        }
      }
      if (did) { fired += did; await db().execute({ sql: `UPDATE Trigger SET last_fired=? WHERE id=?`, args: [new Date().toISOString(), tr.id] }).catch(() => {}); }
    }
    return fired;
  } catch { return 0; }
}
