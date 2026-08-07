import { ensureSchema } from '../_lib/db.js';
import { getAuth, sendJson, readBody } from '../_lib/auth.js';
import { sendMail, tpl, itemsTable, itemRow } from '../_lib/mailer.js';

const brl = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
function bar(label, value, max, color) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return `<div style="margin:6px 0"><div style="display:flex;justify-content:space-between;font-size:13px;color:#334155"><span>${label}</span><b>${brl(value)}</b></div>
    <div style="height:8px;background:#eef2f7;border-radius:6px;overflow:hidden"><div style="height:8px;width:${pct}%;background:${color};border-radius:6px"></div></div></div>`;
}

// POST /api/reports/email  { to?, summary }
export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Metodo nao permitido' });
  try {
    await ensureSchema();
    const auth = getAuth(req);
    if (!auth) return sendJson(res, 401, { error: 'Nao autenticado' });
    const { to, summary } = await readBody(req);
    if (!summary) return sendJson(res, 400, { error: 'Dados do relatorio ausentes' });
    const dest = to || auth.email;

    const maxCat = Math.max(1, ...(summary.categories || []).map((c) => c.value));
    const catBars = (summary.categories || []).slice(0, 6).map((c, i) => bar(c.name, c.value, maxCat, ['#f43f5e', '#6366f1', '#14b8a6', '#f59e0b', '#8b5cf6', '#0ea5e9'][i % 6])).join('');
    const kpis = `<table style="width:100%;border-collapse:collapse;margin:6px 0 12px">
      <tr>
        <td style="padding:10px;background:#ecfdf5;border-radius:10px"><div style="font-size:11px;color:#64748b">Receitas</div><div style="font-weight:800;color:#059669">${brl(summary.inc)}</div></td>
        <td style="width:8px"></td>
        <td style="padding:10px;background:#fef2f2;border-radius:10px"><div style="font-size:11px;color:#64748b">Despesas</div><div style="font-weight:800;color:#e11d48">${brl(summary.exp)}</div></td>
      </tr>
      <tr><td colspan="3" style="height:8px"></td></tr>
      <tr>
        <td style="padding:10px;background:#eef2ff;border-radius:10px"><div style="font-size:11px;color:#64748b">Saldo do periodo</div><div style="font-weight:800;color:#4f46e5">${brl(summary.bal)}</div></td>
        <td style="width:8px"></td>
        <td style="padding:10px;background:#f5f3ff;border-radius:10px"><div style="font-size:11px;color:#64748b">Taxa de poupanca</div><div style="font-weight:800;color:#7c3aed">${Number(summary.rate || 0).toFixed(1)}%</div></td>
      </tr></table>`;

    const topEx = (summary.topExpenses || []).slice(0, 5).map((t) => itemRow(t.name || 'Despesa', '', brl(t.value), '#e11d48')).join('');
    const insightBox = summary.insight ? `<div style="margin-top:16px;padding:12px 14px;border-radius:12px;background:#eef2ff;color:#3730a3;font-size:13px;line-height:1.5">💡 ${String(summary.insight).replace(/</g, '&lt;')}</div>` : '';

    const html = tpl(`Seu relatorio financeiro — ${summary.periodLabel || ''}`,
      `Ola${summary.name ? ' ' + summary.name : ''}, aqui esta o resumo das suas financas (contas + cartao).<br/>
       <div style="margin-top:6px;color:#0b1330;font-weight:700">Patrimonio total: ${brl(summary.totalBalance)}</div>
       ${kpis}
       ${insightBox}
       <div style="font-weight:700;color:#0b1330;margin:16px 0 6px">Despesas por categoria</div>
       ${catBars || '<div style="color:#94a3b8;font-size:13px">Sem despesas no periodo.</div>'}
       ${topEx ? `<div style="font-weight:700;color:#0b1330;margin:16px 0 4px">Maiores despesas</div>${itemsTable([topEx].join(''))}` : ''}`);

    const r = await sendMail({ to: dest, subject: `Monvy — Relatorio ${summary.periodLabel || ''}`, html });
    if (r.sent) return sendJson(res, 200, { ok: true, to: dest });
    return sendJson(res, 400, { error: r.error || 'Envio de e-mail nao configurado/habilitado.' });
  } catch (e) { return sendJson(res, 500, { error: e.message }); }
}
