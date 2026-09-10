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
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Metodo não permitido' });
  try {
    await ensureSchema();
    const auth = getAuth(req);
    if (!auth) return sendJson(res, 401, { error: 'Não autenticado' });
    const { to, summary } = await readBody(req);
    if (!summary) return sendJson(res, 400, { error: 'Dados do relatório ausentes' });
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
        <td style="padding:10px;background:#eef2ff;border-radius:10px"><div style="font-size:11px;color:#64748b">Saldo do período</div><div style="font-weight:800;color:#4f46e5">${brl(summary.bal)}</div></td>
        <td style="width:8px"></td>
        <td style="padding:10px;background:#f5f3ff;border-radius:10px"><div style="font-size:11px;color:#64748b">Taxa de poupança</div><div style="font-weight:800;color:#7c3aed">${Number(summary.rate || 0).toFixed(1)}%</div></td>
      </tr></table>`;

    const topEx = (summary.topExpenses || []).slice(0, 5).map((t) => itemRow(t.name || 'Despesa', '', brl(t.value), '#e11d48')).join('');

    // Análises do período (lista de insights) — mais completo
    const insightsArr = Array.isArray(summary.insights) ? summary.insights.filter(Boolean) : (summary.insight ? [summary.insight] : []);
    const insightsBlock = insightsArr.length
      ? `<div style="margin-top:16px;padding:14px 16px;border-radius:12px;background:#eef2ff">
           <div style="color:#3730a3;font-weight:800;font-size:13px;margin-bottom:6px">💡 Análises do período</div>
           ${insightsArr.map((s) => `<div style="display:flex;gap:8px;margin:5px 0;color:#3730a3;font-size:13px;line-height:1.5"><span>•</span><span>${String(s).replace(/</g, '&lt;')}</span></div>`).join('')}
         </div>`
      : '';

    // Mês a mês (receita / despesa / saldo)
    const mRows = (summary.monthly || []).map((m) => `<tr>
        <td style="padding:7px 0;border-bottom:1px solid #eef2f7;color:#0b1330;font-size:13px">${m.name}</td>
        <td style="padding:7px 0;border-bottom:1px solid #eef2f7;text-align:right;color:#059669;font-size:13px">${brl(m.inc)}</td>
        <td style="padding:7px 0;border-bottom:1px solid #eef2f7;text-align:right;color:#e11d48;font-size:13px">${brl(m.exp)}</td>
        <td style="padding:7px 0;border-bottom:1px solid #eef2f7;text-align:right;font-weight:700;font-size:13px;color:${(m.net || 0) >= 0 ? '#059669' : '#e11d48'}">${brl(m.net)}</td>
      </tr>`).join('');
    const monthlyBlock = mRows
      ? `<div style="font-weight:700;color:#0b1330;margin:18px 0 6px">Mês a mês</div>
         <table style="width:100%;border-collapse:collapse">
           <tr style="color:#94a3b8;font-size:12px"><td style="padding:4px 0">Mês</td><td style="padding:4px 0;text-align:right">Receita</td><td style="padding:4px 0;text-align:right">Despesa</td><td style="padding:4px 0;text-align:right">Saldo</td></tr>
           ${mRows}
         </table>`
      : '';

    // Bloco de carga tributária (quando enviado pelo cliente)
    const tx = summary.tax;
    let taxBlock = '';
    if (tx && Number(tx.total) > 0) {
      const maxB = Math.max(1, ...((tx.topBuckets || []).map((b) => b.tributo)));
      const bBars = (tx.topBuckets || []).slice(0, 3).map((b, i) => bar(b.label, b.tributo, maxB, ['#f59e0b', '#fb923c', '#f97316'][i % 3])).join('');
      taxBlock = `
        <div style="margin-top:20px;padding:16px;border-radius:14px;border:1px solid #d1fae5;background:linear-gradient(135deg,#ecfdf5,#f0fdfa)">
          <div style="color:#065f46;font-weight:800;font-size:14px;margin-bottom:8px">🏛️ Minha Carga Tributária</div>
          <table style="width:100%;border-collapse:collapse">
            <tr>
              <td style="padding:8px;background:#ffffff;border-radius:10px;border:1px solid #e2e8f0"><div style="font-size:11px;color:#64748b">Imposto total</div><div style="font-weight:800;color:#065f46">${brl(tx.total)}</div><div style="font-size:10px;color:#94a3b8">${Number(tx.avgPct || 0).toFixed(1)}% da renda</div></td>
              <td style="width:6px"></td>
              <td style="padding:8px;background:#ffffff;border-radius:10px;border:1px solid #e2e8f0"><div style="font-size:11px;color:#64748b">Sobre o salário</div><div style="font-weight:800;color:#2563eb">${brl(tx.salario)}</div><div style="font-size:10px;color:#94a3b8">INSS + IRRF</div></td>
              <td style="width:6px"></td>
              <td style="padding:8px;background:#ffffff;border-radius:10px;border:1px solid #e2e8f0"><div style="font-size:11px;color:#64748b">No consumo</div><div style="font-weight:800;color:#d97706">${brl(tx.consumo)}</div><div style="font-size:10px;color:#94a3b8">tributo embutido</div></td>
            </tr>
          </table>
          ${tx.narrativa ? `<div style="margin-top:10px;color:#334155;font-size:13px;line-height:1.6">${String(tx.narrativa).replace(/</g, '&lt;')}</div>` : ''}
          ${bBars ? `<div style="margin-top:10px"><div style="font-size:12px;color:#64748b;margin-bottom:4px">Onde o imposto embutido mais pesa</div>${bBars}</div>` : ''}
        </div>`;
    }

    // Bloco de notas fiscais (quando enviado pelo cliente)
    const nf = summary.nf;
    let nfBlock = '';
    if (nf && Number(nf.totalTax) > 0) {
      const typeRows = (nf.types || []).slice(0, 8).map((t) => `<tr><td style="padding:6px 0;border-bottom:1px solid #eef2f7;color:#0b1330;font-size:13px">${t.name}</td><td style="padding:6px 0;border-bottom:1px solid #eef2f7;text-align:right;font-weight:600;font-size:13px">${brl(t.value)}</td></tr>`).join('');
      const topRows = (nf.top || []).slice(0, 5).map((e) => `<tr><td style="padding:6px 0;border-bottom:1px solid #eef2f7;color:#0b1330;font-size:13px">${String(e.name).replace(/</g, '&lt;')}</td><td style="padding:6px 0;border-bottom:1px solid #eef2f7;text-align:right;font-weight:600;font-size:13px">${brl(e.value)}</td></tr>`).join('');
      nfBlock = `
        <div style="margin-top:18px;padding:16px;border-radius:14px;border:1px solid #e2e8f0;background:#ffffff">
          <div style="color:#0b1330;font-weight:800;font-size:14px;margin-bottom:8px">🧾 Notas fiscais (${nf.count}) — ${brl(nf.totalTax)} em tributos</div>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="width:50%;vertical-align:top;padding-right:10px">
              <div style="font-size:12px;color:#64748b;margin-bottom:2px">Por tipo de tributo</div>
              <table style="width:100%;border-collapse:collapse">${typeRows}</table>
            </td><td style="width:50%;vertical-align:top;padding-left:10px">
              <div style="font-size:12px;color:#64748b;margin-bottom:2px">Onde mais paguei</div>
              <table style="width:100%;border-collapse:collapse">${topRows}</table>
            </td></tr>
          </table>
        </div>`;
    }

    // Faixa de destaque (hero) do relatório
    const hero = `<table style="width:100%;border-collapse:separate;border-spacing:0;margin:2px 0 14px;border-radius:16px;overflow:hidden">
      <tr><td style="padding:18px 20px;background:linear-gradient(135deg,#065f46,#0d9488)">
        <div style="color:#d1fae5;font-size:12px">Patrimônio total</div>
        <div style="color:#ffffff;font-size:30px;font-weight:800;letter-spacing:-.5px">${brl(summary.totalBalance)}</div>
        <div style="margin-top:8px">
          <span style="display:inline-block;background:rgba(255,255,255,.16);color:#fff;font-size:12px;padding:4px 10px;border-radius:8px;margin-right:6px">Saldo do período: ${brl(summary.bal)}</span>
          <span style="display:inline-block;background:rgba(255,255,255,.16);color:#fff;font-size:12px;padding:4px 10px;border-radius:8px">Poupança: ${Number(summary.rate || 0).toFixed(0)}%</span>
        </div>
      </td></tr>
    </table>`;

    const html = tpl(`Seu relatório financeiro`,
      `Olá${summary.name ? ' ' + summary.name : ''}, aqui está o resumo das suas finanças no período <b>${summary.periodLabel || ''}</b> (contas + cartão).
       ${hero}
       ${kpis}
       ${insightsBlock}
       ${monthlyBlock}
       <div style="font-weight:700;color:#0b1330;margin:18px 0 6px">Despesas por categoria</div>
       ${catBars || '<div style="color:#94a3b8;font-size:13px">Sem despesas no período.</div>'}
       ${topEx ? `<div style="font-weight:700;color:#0b1330;margin:18px 0 4px">Maiores despesas</div>${itemsTable([topEx])}` : ''}
       ${taxBlock}
       ${nfBlock}
       <div style="margin-top:18px;color:#64748b;font-size:12px">Quer a planilha completa? Abra o Monvy → Relatórios → Excel para baixar entradas, saídas e a aba de Carga Tributária. Para o PDF completo, use Relatórios → Exportar PDF.</div>`,
      { wide: true, subtitle: `Relatório financeiro · ${summary.periodLabel || ''}` });

    const r = await sendMail({ to: dest, subject: `Monvy — Relatório ${summary.periodLabel || ''}`, html });
    if (r.sent) return sendJson(res, 200, { ok: true, to: dest });
    return sendJson(res, 400, { error: r.error || 'Envio de e-mail não configurado/habilitado.' });
  } catch (e) { return sendJson(res, 500, { error: e.message }); }
}
