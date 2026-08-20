import { db, ensureSchema, newId, nowIso } from '../_lib/db.js';
import { sendJson } from '../_lib/auth.js';
import { getMailConfig } from '../_lib/settings.js';
import { sendMail, tpl, itemsTable, itemRow } from '../_lib/mailer.js';

const brl = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
const fmtDate = (d) => new Date(String(d).slice(0, 10) + 'T00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

const AI_MODELS = ['gemini-2.0-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-flash'];
async function geminiKey() { try { const r = await db().execute(`SELECT gemini_api_key k FROM AppSettings WHERE gemini_api_key IS NOT NULL AND gemini_api_key <> '' LIMIT 1`); return r.rows[0]?.k || null; } catch { return null; } }
// Gera titulo e corpo de um aviso/e-mail/chamado com a IA (Gemini). Retorna null se indisponivel.
async function aiCompose(apiKey, { agentName, focus, kind, situation, instruction }) {
  if (!apiKey) return null;
  const tipo = kind === 'ticket' ? 'um chamado (ticket)' : kind === 'notify' ? 'um aviso curto no app' : 'um e-mail';
  const prompt = `Voce e o robo "${agentName || 'Assistente'}" do Monvy${focus ? `, especialista em ${focus}` : ''}. Gere ${tipo} em portugues do Brasil para o usuario, com base na situacao real abaixo. ${instruction ? 'Instrucao/tom: ' + instruction + '. ' : ''}Seja util, especifico e amigavel; NAO invente numeros. Responda SOMENTE em JSON valido: {"titulo":"...","corpo":"..."} (corpo com ate 5 linhas).\nSITUACAO:\n${situation}`;
  try {
    for (const m of AI_MODELS) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.6 } }) });
      if (!r.ok) continue;
      const data = await r.json();
      let txt = (data?.candidates?.[0]?.content?.parts?.[0]?.text || '').replace(/```json|```/g, '').trim();
      const j = JSON.parse(txt);
      if (j && j.titulo) return { title: String(j.titulo).slice(0, 120), body: String(j.corpo || '').slice(0, 1500) };
    }
  } catch { /* fallback texto padrao */ }
  return null;
}
function baseUrl(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return host ? `${req.headers['x-forwarded-proto'] || 'https'}://${host}` : '';
}
async function notify(uid, { kind = 'info', title, text = '', path = '' }) {
  try { await db().execute({ sql: `INSERT INTO Notification (id,kind,title,text,path,read,created_by_id,created_date,updated_date) VALUES (?,?,?,?,?,0,?,?,?)`, args: [newId(), kind, title, text, path, uid, nowIso(), nowIso()] }); } catch {}
}

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

// ---- motor de regras (condicoes) ----
const opTest = (op, a, b) => ({ lt: a < b, lte: a <= b, gt: a > b, gte: a >= b, eq: Math.abs(a - b) < 0.005 }[op] ?? false);
const OP_LABEL = { lt: 'menor que', lte: 'menor ou igual a', gt: 'maior que', gte: 'maior ou igual a', eq: 'igual a' };
const METRIC_LABEL = { total_balance: 'Saldo total das contas', month_balance: 'Saldo do mes', month_income: 'Receita do mes', month_expense: 'Despesa do mes', savings_rate: 'Taxa de poupanca', category_spend: 'Gasto na categoria', pending_count: 'Vencidos nao pagos', net_worth: 'Patrimonio liquido', open_tickets: 'Chamados em aberto', debt_monthly: 'Parcelas de dividas/mes', goals_saved: 'Guardado em metas/cofres', card_invoice_total: 'Faturas de cartao em aberto', investments_total: 'Total investido' };
const METRIC_UNIT = { savings_rate: '%', pending_count: 'un', open_tickets: 'un' };
const fmtMetric = (metric, v) => { const u = METRIC_UNIT[metric]; if (u === '%') return `${Number(v).toFixed(0)}%`; if (u === 'un') return String(Math.round(v)); return brl(v); };
async function categorySpend(uid, ym, catId) {
  if (!catId) return 0;
  const a = Number((await db().execute({ sql: `SELECT COALESCE(SUM(amount),0) t FROM "Transaction" WHERE created_by_id=? AND type='expense' AND (is_deleted IS NULL OR is_deleted=0) AND category_id=? AND substr(date,1,7)=?`, args: [uid, catId, ym] })).rows[0]?.t || 0);
  const c = Number((await db().execute({ sql: `SELECT COALESCE(SUM(amount),0) t FROM CreditCardTransaction WHERE created_by_id=? AND (is_deleted IS NULL OR is_deleted=0) AND category_id=? AND COALESCE(competence_month,substr(date,1,7))=?`, args: [uid, catId, ym] })).rows[0]?.t || 0);
  return a + c;
}
async function pendingCount(uid, t0) {
  return Number((await db().execute({ sql: `SELECT COUNT(*) n FROM "Transaction" WHERE created_by_id=? AND type!='transfer' AND (is_deleted IS NULL OR is_deleted=0) AND status='pending' AND substr(date,1,10)<=?`, args: [uid, t0] })).rows[0]?.n || 0);
}
async function debtMonthlyOf(uid) {
  const rows = (await db().execute({ sql: `SELECT installment_amount, installments, paid_installments FROM Debt WHERE created_by_id=? AND (is_deleted IS NULL OR is_deleted=0)`, args: [uid] })).rows;
  return rows.reduce((s, d) => (Number(d.installments || 0) - Number(d.paid_installments || 0) > 0 ? s + Number(d.installment_amount || 0) : s), 0);
}
async function netWorthOf(uid) {
  const bal = await totalBalanceOf(uid);
  const inv = Number((await db().execute({ sql: `SELECT COALESCE(SUM(COALESCE(current_value,invested_amount,0)),0) t FROM Investment WHERE created_by_id=? AND (is_deleted IS NULL OR is_deleted=0)`, args: [uid] })).rows[0]?.t || 0);
  const dRows = (await db().execute({ sql: `SELECT installment_amount, installments, paid_installments, total_amount FROM Debt WHERE created_by_id=? AND (is_deleted IS NULL OR is_deleted=0)`, args: [uid] })).rows;
  const debt = dRows.reduce((s, d) => { const rest = Number(d.installment_amount || 0) * Math.max(0, Number(d.installments || 0) - Number(d.paid_installments || 0)); return s + (rest || Number(d.total_amount || 0)); }, 0);
  return bal + inv - debt;
}
async function openTicketsOf(uid) {
  return Number((await db().execute({ sql: `SELECT COUNT(*) n FROM SupportTicket WHERE created_by_id=? AND (is_deleted IS NULL OR is_deleted=0) AND resolved_date IS NULL`, args: [uid] })).rows[0]?.n || 0);
}
async function goalsSavedOf(uid) {
  return Number((await db().execute({ sql: `SELECT COALESCE(SUM(current_amount),0) t FROM Goal WHERE created_by_id=? AND (is_deleted IS NULL OR is_deleted=0)`, args: [uid] })).rows[0]?.t || 0);
}
async function cardInvoiceTotalOf(uid) {
  return Number((await db().execute({ sql: `SELECT COALESCE(SUM(total_amount),0) t FROM CreditCardInvoice WHERE created_by_id=? AND (is_deleted IS NULL OR is_deleted=0) AND status IN ('open','overdue')`, args: [uid] })).rows[0]?.t || 0);
}
async function investmentsTotalOf(uid) {
  return Number((await db().execute({ sql: `SELECT COALESCE(SUM(COALESCE(current_value,invested_amount,0)),0) t FROM Investment WHERE created_by_id=? AND (is_deleted IS NULL OR is_deleted=0)`, args: [uid] })).rows[0]?.t || 0);
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
    const aiKey = await geminiKey();

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
        await notify(u.id, { kind: 'reminder', title: `Voce tem ${venc.count + budget.length} alerta(s) financeiro(s)`, text: 'Vencimentos proximos e/ou orcamento do mes.', path: '/pagamentos' });
        sent++;
      }
    }

    // 2) automacoes personalizadas (regras QUANDO -> SE -> ENTAO)
    for (const u of users) {
      const trigs = (await db().execute({ sql: `SELECT * FROM Trigger WHERE created_by_id = ? AND enabled = 1 AND (is_deleted IS NULL OR is_deleted=0)`, args: [u.id] })).rows;
      if (!trigs.length) continue;
      const lastDom = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)).getUTCDate();
      const parseCfg = (tr) => { try { return tr.config ? (typeof tr.config === 'string' ? JSON.parse(tr.config) : tr.config) : null; } catch { return null; } };
      const isDue = (tr, c) => {
        if (tr.frequency === 'daily') return true;
        if (tr.frequency === 'weekly') return Number(tr.weekday) === dow;
        if (tr.frequency === 'monthly') return dom === Math.min(Number(c?.dayOfMonth) || 1, lastDom);
        return false;
      };
      const dueToday = trigs.map((tr) => ({ tr, c: parseCfg(tr) })).filter(({ tr, c }) => c && isDue(tr, c));
      if (!dueToday.length) continue;

      // contexto do usuario (calculado uma vez)
      const rr = await monthRate(u.id, ym);
      const ctx = { total_balance: await totalBalanceOf(u.id), month_income: rr.inc, month_expense: rr.exp, month_balance: rr.inc - rr.exp, savings_rate: rr.rate, pending_count: await pendingCount(u.id, t0), net_worth: await netWorthOf(u.id), open_tickets: await openTicketsOf(u.id), debt_monthly: await debtMonthlyOf(u.id), goals_saved: await goalsSavedOf(u.id), card_invoice_total: await cardInvoiceTotalOf(u.id), investments_total: await investmentsTotalOf(u.id) };
      const greet = `Ola${u.full_name ? ' ' + u.full_name : ''}`;

      for (const { tr, c } of dueToday) {
        const conditions = Array.isArray(c.conditions) ? c.conditions : [];
        try {
          // cooldown: nao repetir dentro de X dias
          const cooldown = Number(c.cooldownDays) || 0;
          if (cooldown > 0 && tr.last_fired) {
            const diff = (new Date(t0) - new Date(String(tr.last_fired).slice(0, 10))) / 86400000;
            if (diff < cooldown) continue;
          }
          // avalia condicoes
          const evals = [];
          for (const cond of conditions) {
            const val = cond.metric === 'category_spend' ? await categorySpend(u.id, ym, cond.categoryId) : (ctx[cond.metric] ?? 0);
            evals.push({ cond, val, ok: opTest(cond.op, val, Number(cond.value)) });
          }
          const pass = conditions.length === 0 ? true : (c.match === 'any' ? evals.some((e) => e.ok) : evals.every((e) => e.ok));
          if (!pass) continue;

          // uma ou varias acoes
          const acts = Array.isArray(c.actions) && c.actions.length ? c.actions : (c.action ? [{ action: c.action, subject: c.subject, message: c.message, ticketCategory: c.ticketCategory }] : []);
          let fired = 0;
          const situation = evals.length
            ? evals.map((e) => `- ${METRIC_LABEL[e.cond.metric] || e.cond.metric}: ${fmtMetric(e.cond.metric, e.val)} (condicao: ${OP_LABEL[e.cond.op]} ${fmtMetric(e.cond.metric, Number(e.cond.value))})`).join('\n')
            : `Foco do robo: ${c.focus || 'geral'}. Saldo total: ${brl(ctx.total_balance)}. Receita do mes: ${brl(ctx.month_income)}. Despesa do mes: ${brl(ctx.month_expense)}. Gere um resumo/dica util para este foco.`;

          for (const act of acts) {
            if (act.action === 'email_summary') {
              await sendMail({ to: u.email, subject: 'Monvy — seu resumo financeiro', html: tpl('Seu resumo financeiro 📊', await summaryBody(u, ym)) });
              await notify(u.id, { kind: 'summary', title: 'Resumo financeiro disponivel', text: `Gerado pela automacao "${tr.name}".`, path: '/relatorios' }); fired++;
            } else if (act.action === 'email_bills') {
              const venc = await vencData(u.id, t0, t3);
              if (venc.rows.length) { await sendMail({ to: u.email, subject: 'Monvy — vencimentos proximos', html: tpl('Vencimentos proximos ⏰', `${greet}, estes compromissos estao proximos:${itemsTable(venc.rows)}<div style="margin-top:6px;font-weight:700;color:#0b1330">Total: ${brl(venc.total)}</div>`) }); fired++; }
            } else if (act.action === 'open_ticket') {
              let subj = (act.subject && act.subject.trim()) || tr.name || 'Automacao financeira';
              let corpo = null;
              if (act.aiWrite && aiKey) { const comp = await aiCompose(aiKey, { agentName: tr.name, focus: c.focus, kind: 'ticket', situation, instruction: act.message }); if (comp) { subj = comp.title; corpo = comp.body; } }
              const exists = (await db().execute({ sql: `SELECT id FROM SupportTicket WHERE created_by_id=? AND subject=? AND (is_deleted IS NULL OR is_deleted=0) AND resolved_date IS NULL`, args: [u.id, subj] })).rows[0];
              if (!exists) {
                const desc = corpo || `${act.message || 'Automacao acionada pelo gatilho.'}\n\nSituacao atual:\n${situation}`;
                const id = newId();
                const number = Number((await db().execute(`SELECT COALESCE(MAX(number),1000) n FROM SupportTicket`)).rows[0]?.n || 1000) + 1;
                await db().execute({ sql: `INSERT INTO SupportTicket (id,number,subject,status,category,priority,user_name,user_email,created_by_id,created_date,updated_date) VALUES (?,?,?,?,?,?,?,?,?,?,?)`, args: [id, number, subj, 'open', act.ticketCategory || 'Financeiro', 'alta', u.full_name || '', u.email, u.id, nowIso(), nowIso()] });
                await db().execute({ sql: `INSERT INTO TicketMessage (id,ticket_id,author_id,author_role,author_name,body,created_date) VALUES (?,?,?,?,?,?,?)`, args: [newId(), id, u.id, 'user', 'Automacao Monvy', desc, nowIso()] });
                const admins = (await db().execute(`SELECT email FROM users WHERE role='admin' AND (is_active IS NULL OR is_active=1)`)).rows.map((r) => r.email).filter(Boolean);
                if (admins.length) sendMail({ to: admins.join(','), replyTo: u.email, subject: `Chamado automatico #${number}: ${subj}`, html: tpl('Chamado aberto por automacao 🤖', `Uma automacao de <b>${u.full_name || u.email}</b> abriu o chamado <b>#${number} — ${subj}</b>.<br/><br/>${desc.replace(/</g, '&lt;').replace(/\n/g, '<br/>')}`) }).catch(() => {});
                await sendMail({ to: u.email, subject: `Monvy abriu um chamado pra voce: ${subj}`, html: tpl('Abrimos um chamado pra voce 🎫', `${greet}, uma automacao sua identificou algo que merece atencao e abriu o chamado <b>#${number} — ${subj}</b>. Acompanhe e resolva na Central de Tickets.`, { ctaText: 'Ver chamado', ctaUrl: `${baseUrl(req)}/chamados` }) }).catch(() => {});
                await notify(u.id, { kind: 'ticket', title: `Chamado #${number} aberto por automacao`, text: subj, path: '/chamados' });
                fired++;
              }
            } else if (act.action === 'notify') {
              let title = (act.subject && act.subject.trim()) || tr.name || 'Aviso do Monvy';
              let text = act.message || evals.map((e) => `${METRIC_LABEL[e.cond.metric] || e.cond.metric}: ${fmtMetric(e.cond.metric, e.val)}`).join(' · ') || 'Automacao acionada.';
              if (act.aiWrite && aiKey) { const comp = await aiCompose(aiKey, { agentName: tr.name, focus: c.focus, kind: 'notify', situation, instruction: act.message }); if (comp) { title = comp.title; text = comp.body; } }
              await notify(u.id, { kind: 'alert', title, text, path: '/agentes' }); fired++;
            } else { // email_alert
              let subject = (act.subject && act.subject.trim()) || tr.name || 'Alerta Monvy';
              let intro = act.message ? `<br/><br/>${String(act.message).replace(/</g, '&lt;')}` : '';
              if (act.aiWrite && aiKey) { const comp = await aiCompose(aiKey, { agentName: tr.name, focus: c.focus, kind: 'email', situation, instruction: act.message }); if (comp) { subject = comp.title; intro = `<br/><br/>${String(comp.body).replace(/</g, '&lt;').replace(/\n/g, '<br/>')}`; } }
              const rows = evals.map((e) => itemRow(e.cond.metric === 'category_spend' ? 'Gasto na categoria' : (METRIC_LABEL[e.cond.metric] || e.cond.metric), `condicao: ${OP_LABEL[e.cond.op]} ${fmtMetric(e.cond.metric, Number(e.cond.value))}`, fmtMetric(e.cond.metric, e.val), '#e11d48'));
              const body = `${greet},${intro}${rows.length ? `<div style="margin-top:12px;font-weight:700;color:#0b1330">Situacao atual</div>${itemsTable(rows)}` : ''}`;
              await sendMail({ to: u.email, subject: `Monvy — ${subject}`, html: tpl(subject, body) });
              await notify(u.id, { kind: 'alert', title: subject, text: 'Automacao acionada.', path: '/agentes' }); fired++;
            }
          }
          if (fired) { trig += fired; await db().execute({ sql: `UPDATE Trigger SET last_fired=? WHERE id=?`, args: [t0, tr.id] }).catch(() => {}); }
        } catch { /* nao quebra os demais */ }
      }
    }

    return sendJson(res, 200, { ok: true, usuarios: users.length, alertas: sent, gatilhos: trig });
  } catch (e) { return sendJson(res, 500, { error: e.message }); }
}
