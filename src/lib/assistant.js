// Assistente financeiro local (sem IA de terceiros): interpreta a pergunta, le todos os
// dados do usuario e responde em linguagem natural e personalizada.
import { detectPriceHikes, detectAnomalies } from './analytics.js';

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const num = (v) => { const x = Number(v); return isNaN(x) ? 0 : x; };
export const brl = (v) => num(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (v) => `${(v * 100).toFixed(0)}%`;
const ym = (d = new Date()) => d.toISOString().slice(0, 7);
const prevYm = () => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7); };
const monthName = (mk) => { const [y, m] = mk.split('-'); return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); };

function firstName(user) {
  const n = user?.first_name || (user?.full_name || '').split(' ')[0] || '';
  return n ? n.charAt(0).toUpperCase() + n.slice(1) : 'voce';
}
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// periodo a partir da pergunta
function periodOf(q) {
  if (/(mes passado|mes anterior)/.test(q)) { const mk = prevYm(); return { mk, label: monthName(mk), kind: 'month' }; }
  if (/(esse ano|este ano|no ano|anual|ano)/.test(q)) { const y = new Date().getFullYear(); return { year: String(y), label: String(y), kind: 'year' }; }
  const mk = ym(); return { mk, label: monthName(mk), kind: 'month' };
}
function inPeriod(t, p) {
  const d = String(t.date).slice(0, 10);
  if (p.kind === 'year') return d.slice(0, 4) === p.year;
  return d.slice(0, 7) === p.mk;
}

function totals(ctx, p) {
  const tx = ctx.transactions.filter((t) => t.type !== 'transfer' && inPeriod(t, p));
  const inc = tx.filter((t) => t.type === 'income').reduce((s, t) => s + num(t.amount), 0);
  const exp = tx.filter((t) => t.type === 'expense').reduce((s, t) => s + num(t.amount), 0);
  return { inc, exp, saldo: inc - exp, rate: inc > 0 ? (inc - exp) / inc : 0 };
}
function topCategories(ctx, p, n = 3) {
  const map = {};
  for (const t of ctx.transactions) {
    if (t.type !== 'expense' || !inPeriod(t, p)) continue;
    const name = ctx.catMap[t.category_id]?.name || 'Sem categoria';
    map[name] = (map[name] || 0) + num(t.amount);
  }
  const arr = Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const total = arr.reduce((s, c) => s + c.value, 0) || 1;
  return { list: arr.slice(0, n).map((c) => ({ ...c, share: c.value / total })), total, count: arr.length };
}
function totalBalance(ctx) { return ctx.accounts.reduce((s, a) => s + num(a.current_balance), 0); }
function investTotal(ctx) { return ctx.investments.reduce((s, i) => s + (num(i.current_value) || num(i.invested_amount)), 0); }
function debtInfo(ctx) {
  let saldo = 0, mensal = 0;
  for (const d of ctx.debts) {
    const rest = Math.max(0, num(d.installments) - num(d.paid_installments));
    const inst = num(d.installment_amount);
    if (rest > 0) { mensal += inst; saldo += inst * rest || num(d.total_amount); }
  }
  return { saldo, mensal };
}
function upcoming(ctx, days = 15) {
  const today = new Date().toISOString().slice(0, 10);
  const lim = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  const items = [];
  for (const t of ctx.transactions) {
    if (t.type === 'transfer' || (t.status || 'pending') === 'completed') continue;
    const d = String(t.date).slice(0, 10);
    if (d <= lim) items.push({ label: t.description || (t.type === 'income' ? 'Recebimento' : 'Pagamento'), amount: num(t.amount) * (t.type === 'income' ? 1 : -1), date: d, overdue: d < today });
  }
  for (const inv of ctx.invoices) {
    if (!(inv.status === 'open' || inv.status === 'overdue') || !inv.due_date) continue;
    const d = String(inv.due_date).slice(0, 10);
    if (d <= lim) items.push({ label: `Fatura ${inv.competence_month || ''}`, amount: -num(inv.total_amount), date: d, overdue: d < today });
  }
  return items.sort((a, b) => (a.date < b.date ? -1 : 1));
}

// serie de despesas dos ultimos n meses (mais antigo -> atual)
function expenseSeries(ctx, n = 6) {
  const now = new Date(); const out = [];
  for (let k = n - 1; k >= 0; k--) {
    const d = new Date(now.getFullYear(), now.getMonth() - k, 1); const mk = d.toISOString().slice(0, 7);
    const exp = ctx.transactions.filter((t) => t.type === 'expense' && String(t.date).slice(0, 7) === mk).reduce((s, t) => s + num(t.amount), 0);
    out.push({ mk, exp });
  }
  return out;
}
const median = (arr) => { const s = [...arr].filter((x) => x > 0).sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : 0; };
// previsao de despesa do mes: projeta o mes corrente pelo ritmo diario + mediana historica
function forecastExpense(ctx) {
  const now = new Date(); const day = now.getDate(); const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const mk = ym();
  const soFar = ctx.transactions.filter((t) => t.type === 'expense' && String(t.date).slice(0, 7) === mk).reduce((s, t) => s + num(t.amount), 0);
  const paceProj = day > 0 ? soFar / day * dim : soFar;
  const hist = median(expenseSeries(ctx, 6).slice(0, -1).map((m) => m.exp));
  const projecao = hist > 0 ? (paceProj * 0.6 + hist * 0.4) : paceProj; // combina ritmo com historico
  return { soFar, projecao, hist, restanteEstimado: Math.max(0, projecao - soFar) };
}
// compara mes atual x anterior (total e por categoria)
function comparePrev(ctx) {
  const cur = { mk: ym(), kind: 'month' }; const prev = { mk: prevYm(), kind: 'month' };
  const tc = totals(ctx, cur); const tp = totals(ctx, prev);
  const catCur = {}; const catPrev = {};
  for (const t of ctx.transactions) {
    if (t.type !== 'expense') continue; const m = String(t.date).slice(0, 7); const name = ctx.catMap[t.category_id]?.name || 'Outros';
    if (m === cur.mk) catCur[name] = (catCur[name] || 0) + num(t.amount);
    else if (m === prev.mk) catPrev[name] = (catPrev[name] || 0) + num(t.amount);
  }
  const deltas = Object.keys({ ...catCur, ...catPrev }).map((k) => ({ name: k, cur: catCur[k] || 0, prev: catPrev[k] || 0, delta: (catCur[k] || 0) - (catPrev[k] || 0) })).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return { tc, tp, deltas, expDelta: tc.exp - tp.exp, expPct: tp.exp > 0 ? (tc.exp - tp.exp) / tp.exp : 0 };
}
const arrow = (d) => d > 0 ? '↑' : d < 0 ? '↓' : '→';

function greetLine(user, agent) {
  const nm = firstName(user);
  const who = agent?.name ? `Aqui e o ${agent.name}. ` : '';
  return pick([`Olá, ${nm}! ${who}`, `Oi, ${nm}! ${who}`, `${who}Vamos lá, ${nm}. `, `Fala, ${nm}! ${who}`]);
}

// ---- INTENCOES ---- (kw = frases/palavras; frases longas pontuam mais)
const INTENTS = [
  { key: 'economizar', kw: ['economizar', 'economia', 'cortar gasto', 'cortar gastos', 'reduzir gasto', 'reduzir despesa', 'gastar menos', 'onde economizo', 'onde posso economizar', 'dicas', 'dica', 'poupar mais', 'como poupar', 'me ajuda a economizar', 'onde cortar'] },
  { key: 'gastos_top', kw: ['onde gasto', 'gasto mais', 'gasto mais com', 'maior gasto', 'maiores gastos', 'gasto por categoria', 'gastos por categoria', 'onde vai meu dinheiro', 'onde estou gastando', 'categoria que mais', 'meus gastos', 'como estao meus gastos', 'como esta meus gastos', 'como andam meus gastos', 'meus maiores gastos', 'no que gasto'] },
  { key: 'despesas', kw: ['quanto gastei', 'total de despesas', 'total gasto', 'gastei esse', 'gastei este', 'gastei no mes', 'quanto de despesa', 'valor gasto', 'total de gastos'] },
  { key: 'renda', kw: ['quanto recebi', 'minha renda', 'quanto ganhei', 'quanto ganho', 'receita', 'quanto entrou', 'minhas receitas', 'meu salario'] },
  { key: 'poupanca', kw: ['quanto poupei', 'poupanca', 'quanto sobrou', 'quanto economizei', 'minha sobra', 'consegui guardar', 'taxa de poupanca'] },
  { key: 'saldo', kw: ['meu saldo', 'quanto tenho', 'quanto eu tenho', 'saldo', 'saldo total', 'dinheiro em conta', 'quanto de dinheiro', 'quanto tem na conta', 'minhas contas'] },
  { key: 'dividas', kw: ['quanto devo', 'quanto eu devo', 'minhas dividas', 'divida', 'dividas', 'financiamento', 'emprestimo', 'quanto falta pagar', 'estou devendo'] },
  { key: 'patrimonio', kw: ['patrimonio', 'net worth', 'quanto valho', 'minha riqueza', 'quanto tenho no total', 'meu patrimonio'] },
  { key: 'investimentos', kw: ['investimento', 'investimentos', 'quanto investi', 'meus investi', 'rendimento', 'carteira', 'meus ativos'] },
  { key: 'vencimentos', kw: ['vence', 'vencimento', 'vencimentos', 'a pagar', 'contas a pagar', 'o que preciso pagar', 'proximos pagamentos', 'boleto', 'o que tenho que pagar', 'prazos'] },
  { key: 'metas', kw: ['meta', 'metas', 'objetivo', 'cofre', 'cofres', 'quanto guardei'] },
  { key: 'assinaturas', kw: ['assinatura', 'assinaturas', 'streaming', 'recorrente', 'mensalidade'] },
  { key: 'cartao', kw: ['cartao', 'fatura', 'faturas', 'cartao de credito'] },
  { key: 'mercado', kw: ['dolar', 'euro', 'bitcoin', 'cripto', 'ibovespa', 'mercado', 'cotacao', 'bolsa', 'acoes'] },
  { key: 'previsao', kw: ['vou gastar', 'quanto vou gastar', 'previsao', 'previsão', 'projecao', 'projeta', 'estimativa de gasto', 'fim do mes', 'vai sobrar', 'vou fechar o mes'] },
  { key: 'comparar', kw: ['comparar', 'comparado', 'vs mes passado', 'em relacao ao mes passado', 'mais que mes passado', 'gastei mais', 'gastei menos', 'comparacao', 'mes passado x'] },
  { key: 'analise', kw: ['analise', 'analisa', 'analise completa', 'o que voce acha', 'avalie', 'avaliacao', 'diagnostico', 'me da um raio-x', 'raio-x', 'radiografia'] },
  { key: 'resumo', kw: ['resumo', 'como estou', 'como esta minha', 'panorama', 'situacao', 'saude financeira', 'como estao minhas financas', 'como vao minhas financas'] },
  { key: 'ajuda', kw: ['ajuda', 'o que voce faz', 'o que sabe', 'pode fazer', 'quem e voce', 'comandos', 'me ajuda'] },
];
function detect(q) {
  let best = null, score = 0;
  for (const it of INTENTS) {
    let s = 0;
    for (const k of it.kw) { if (q.includes(k)) s += k.includes(' ') ? k.split(' ').length + 1 : 1; }
    if (s > score) { score = s; best = it.key; }
  }
  return score ? best : null;
}

async function marketAnswer(q) {
  try {
    const wants = [];
    if (/dolar|dollar|usd/.test(q)) wants.push('USD-BRL');
    if (/euro|eur/.test(q)) wants.push('EUR-BRL');
    if (!wants.length) wants.push('USD-BRL', 'EUR-BRL');
    const parts = [];
    const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(`https://economia.awesomeapi.com.br/last/${wants.join(',')}`, { signal: ctrl.signal });
    clearTimeout(to);
    const data = await r.json();
    for (const w of wants) { const k = w.replace('-', ''); const d = data[k]; if (d) parts.push(`${d.name.split('/')[0].trim()}: R$ ${Number(d.bid).toFixed(2)} (${Number(d.pctChange) >= 0 ? '+' : ''}${d.pctChange}% hoje)`); }
    if (/bitcoin|cripto|btc/.test(q)) {
      try { const c = await (await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=brl&include_24hr_change=true')).json(); if (c.bitcoin) parts.push(`Bitcoin: R$ ${Number(c.bitcoin.brl).toLocaleString('pt-BR')} (${c.bitcoin.brl_24h_change >= 0 ? '+' : ''}${Number(c.bitcoin.brl_24h_change).toFixed(1)}% 24h)`); } catch { /* */ }
    }
    if (!parts.length) throw new Error('sem dados');
    return `Cotações agora — ${parts.join(' · ')}. Para o mercado nacional e internacional completo, veja a tela Mercado & Indicadores.`;
  } catch {
    return 'Não consegui buscar as cotações agora (pode ser conexão). Dá uma olhada na tela Mercado & Indicadores, que traz dólar, euro, Selic, IPCA e cripto atualizados.';
  }
}

// mapeia a intencao da pergunta para o foco de um robo
export function intentFocus(question) {
  const map = { economizar: 'gastos', gastos_top: 'gastos', despesas: 'gastos', previsao: 'gastos', comparar: 'gastos', assinaturas: 'gastos', renda: 'geral', poupanca: 'geral', analise: 'geral', saldo: 'saldo', dividas: 'vencimentos', cartao: 'vencimentos', vencimentos: 'vencimentos', patrimonio: 'patrimonio', investimentos: 'patrimonio', mercado: 'mercado', metas: 'geral', resumo: 'geral', ajuda: 'geral' };
  return map[detect(norm(question))] || 'geral';
}
const cfgOf = (a) => { try { return typeof a.config === 'string' ? JSON.parse(a.config) : (a.config || {}); } catch { return {}; } };
// escolhe o robo que "tem a resposta": foco exato > nome citado > robo geral > primeiro
export function routeAgent(question, agents = []) {
  if (!agents.length) return null;
  const q = norm(question);
  const focus = intentFocus(question);
  const byFocus = agents.filter((a) => cfgOf(a).focus === focus);
  if (byFocus.length) return byFocus[0];
  const byName = agents.filter((a) => a.name && q.includes(norm(a.name)));
  if (byName.length) return byName[0];
  const geral = agents.filter((a) => (cfgOf(a).focus || 'geral') === 'geral');
  if (geral.length) return geral[0];
  return agents[0];
}
// palavras-chave por foco (para o conselho pontuar relevancia)
const FOCUS_KW = {
  saldo: ['saldo', 'conta', 'dinheiro', 'tenho'],
  gastos: ['gasto', 'gastei', 'despesa', 'economizar', 'economia', 'categoria', 'assinatura', 'previsao', 'comparar', 'cartao'],
  patrimonio: ['patrimonio', 'investi', 'investimento', 'carteira', 'rico', 'valho', 'rendimento'],
  vencimentos: ['vence', 'vencimento', 'pagar', 'divida', 'devo', 'boleto', 'prazo', 'fatura'],
  mercado: ['dolar', 'euro', 'bitcoin', 'cripto', 'ibovespa', 'mercado', 'bolsa', 'cotacao', 'acoes'],
  geral: ['resumo', 'saude', 'analise', 'financas', 'como estou', 'raio-x'],
};
// Conselho de robos: cada robo pontua sua confianca pela pergunta e seu papel.
export function deliberate(question, agents = []) {
  const q = norm(question);
  const focus = intentFocus(question);
  const scored = agents.map((a) => {
    const c = cfgOf(a); const f = c.focus || 'geral'; const reasons = [];
    let score = 0.08;
    if (f === focus) { score += 0.6; reasons.push('foco combina com a pergunta'); }
    else if (f === 'geral') { score += 0.3; reasons.push('generalista'); }
    const kws = FOCUS_KW[f] || []; const hits = kws.filter((k) => q.includes(k)).length;
    if (hits) { score += Math.min(0.3, hits * 0.12); reasons.push(`${hits} termo(s) da especialidade`); }
    if (a.name && q.includes(norm(a.name))) { score += 0.5; reasons.push('citado pelo nome'); }
    return { agent: a, name: a.name, focus: f, emoji: c.emoji || '🤖', score: Math.min(1, Math.round(score * 100) / 100), reasons };
  }).sort((x, y) => y.score - x.score);
  return scored;
}

// contexto compacto (JSON) para enviar ao Gemini
export function buildAIContext(ctx) {
  const p = { mk: ym(), label: monthName(ym()), kind: 'month' };
  const t = totals(ctx, p); const bal = totalBalance(ctx); const inv = investTotal(ctx); const d = debtInfo(ctx);
  const tc = topCategories(ctx, p, 8);
  return {
    mesAtual: p.mk,
    saldoTotal: Math.round(bal),
    contas: ctx.accounts.map((a) => ({ nome: a.name, saldo: Math.round(num(a.current_balance)) })),
    receitaMes: Math.round(t.inc), despesaMes: Math.round(t.exp), saldoMes: Math.round(t.saldo), taxaPoupanca: Math.round(t.rate * 100),
    gastosPorCategoria: tc.list.map((c) => ({ nome: c.name, valor: Math.round(c.value), percentual: Math.round(c.share * 100) })),
    patrimonioLiquido: Math.round(bal + inv - d.saldo), investimentos: Math.round(inv), dividaTotal: Math.round(d.saldo), parcelasMes: Math.round(d.mensal),
    proximosVencimentos: upcoming(ctx, 15).slice(0, 8).map((x) => ({ item: x.label, valor: Math.round(Math.abs(x.amount)), data: x.date, vencido: x.overdue })),
    metas: ctx.goals.map((g) => ({ nome: g.name, alvo: num(g.target_amount || g.target), atual: num(g.current_amount) })),
    assinaturas: ctx.subs.filter((s) => s.is_active !== false).map((s) => ({ nome: s.name, valor: num(s.amount) })),
    faturasCartaoAbertas: Math.round(ctx.invoices.filter((i) => i.status === 'open' || i.status === 'overdue').reduce((s, i) => s + num(i.total_amount), 0)),
  };
}

export async function askAssistant(question, ctx, agent) {
  const q = norm(question);
  const g = greetLine(ctx.user, agent);
  const intent = detect(q);
  const p = periodOf(q);

  if (!question.trim()) return { text: `${g}Pode me perguntar coisas como "onde gasto mais?", "quanto devo?", "qual meu patrimônio?" ou "o que vence essa semana?".` };

  if (intent === 'mercado') return { text: g + (await marketAnswer(q)) };

  if (intent === 'economizar') {
    const t = topCategories(ctx, p, 3);
    const tot = totals(ctx, p);
    const active = ctx.subs.filter((s) => s.is_active !== false);
    const subTotal = active.reduce((s, x) => s + num(x.amount), 0);
    const tips = [];
    if (t.list[0]) tips.push(`Seu maior gasto e **${t.list[0].name}** (${brl(t.list[0].value)}, ${pct(t.list[0].share)} do total) — um corte de 10% aqui ja economiza ${brl(t.list[0].value * 0.1)}/mes.`);
    if (subTotal > 0) tips.push(`Voce paga ${brl(subTotal)}/mes em ${active.length} assinatura(s) (${brl(subTotal * 12)}/ano). Revise as que nao usa.`);
    if (tot.rate < 0.2 && tot.inc > 0) tips.push(`Sua taxa de poupanca esta em ${pct(tot.rate)}; mirar 20% liberaria cerca de ${brl(Math.max(0, tot.inc * 0.2 - tot.saldo))}/mes.`);
    if (t.list[1]) tips.push(`Vale olhar tambem ${t.list[1].name} (${brl(t.list[1].value)}).`);
    if (!tips.length) return { text: `${g}Ainda nao tenho gastos suficientes em ${p.label} para sugerir cortes. Lance suas despesas que eu aponto onde economizar.` };
    return { text: `${g}Aqui vao dicas pra economizar em ${p.label}:\n\n• ${tips.join('\n• ')}` };
  }
  if (intent === 'gastos_top') {
    const t = topCategories(ctx, p, 3);
    if (!t.list.length) return { text: `${g}Não encontrei despesas em ${p.label} para analisar. Assim que você lançar seus gastos, eu mostro onde o dinheiro está indo.` };
    const top = t.list[0];
    const restos = t.list.slice(1).map((c) => `${c.name} (${brl(c.value)})`).join(' e ');
    let trend = '';
    if (p.kind === 'month') { const c = comparePrev(ctx); const d = c.deltas.find((x) => x.name === top.name); if (d && d.prev > 0) trend = ` ${arrow(d.delta)} ${pct(Math.abs(d.delta / d.prev))} vs ${monthName(prevYm())}.`; }
    return { text: `${g}Em ${p.label}, você gasta mais com **${top.name}**: ${brl(top.value)}, cerca de ${pct(top.share)} de tudo que gastou.${trend}${restos ? ` Na sequência vêm ${restos}.` : ''} Se quiser reduzir, essa é a categoria com maior impacto.` };
  }
  if (intent === 'despesas') {
    const t = totals(ctx, p);
    let cmp = '';
    if (p.kind === 'month') { const c = comparePrev(ctx); if (c.tp.exp > 0) cmp = ` Isso e ${arrow(c.expDelta)} ${pct(Math.abs(c.expPct))} ${c.expDelta >= 0 ? 'a mais' : 'a menos'} que ${monthName(prevYm())} (${brl(c.tp.exp)}).`; }
    return { text: `${g}Em ${p.label} você gastou **${brl(t.exp)}**${t.inc ? ` e recebeu ${brl(t.inc)} (saldo de ${brl(t.saldo)})` : ''}.${cmp}` };
  }
  if (intent === 'previsao') {
    const f = forecastExpense(ctx); const t = totals(ctx, { mk: ym(), kind: 'month' });
    const sobra = t.inc - f.projecao;
    return { text: `${g}Até agora você gastou **${brl(f.soFar)}** em ${monthName(ym())}. No ritmo atual, deve fechar o mês em torno de **${brl(f.projecao)}** (faltam ~${brl(f.restanteEstimado)}).${t.inc ? ` Com sua renda de ${brl(t.inc)}, a projeção é ${sobra >= 0 ? `sobrar ${brl(sobra)}` : `faltar ${brl(-sobra)}`}.` : ''}` };
  }
  if (intent === 'comparar') {
    const c = comparePrev(ctx);
    if (c.tp.exp === 0 && c.tc.exp === 0) return { text: `${g}Ainda não tenho gastos suficientes para comparar ${monthName(ym())} com ${monthName(prevYm())}.` };
    const subiu = c.deltas.filter((d) => d.delta > 0).slice(0, 2).map((d) => `${d.name} (${arrow(d.delta)} ${brl(Math.abs(d.delta))})`);
    const caiu = c.deltas.filter((d) => d.delta < 0).slice(0, 2).map((d) => `${d.name} (${arrow(d.delta)} ${brl(Math.abs(d.delta))})`);
    return { text: `${g}Comparando ${monthName(ym())} com ${monthName(prevYm())}: você gastou **${brl(c.tc.exp)}** vs ${brl(c.tp.exp)} (${arrow(c.expDelta)} ${pct(Math.abs(c.expPct))}).${subiu.length ? ` Subiu em ${subiu.join(', ')}.` : ''}${caiu.length ? ` Caiu em ${caiu.join(', ')}.` : ''}` };
  }
  if (intent === 'analise') {
    const t = totals(ctx, { mk: ym(), kind: 'month' }); const tc = topCategories(ctx, { mk: ym(), kind: 'month' }, 1);
    const f = forecastExpense(ctx); const c = comparePrev(ctx); const d = debtInfo(ctx);
    const hikes = detectPriceHikes(ctx.transactions); const anom = detectAnomalies(ctx.transactions, ctx.catMap);
    const linhas = [];
    linhas.push(`Poupança do mês: **${pct(t.rate)}** ${t.rate >= 0.2 ? '(ótimo)' : t.rate > 0 ? '(dá pra melhorar)' : '(no vermelho)'}.`);
    if (tc.list[0]) linhas.push(`Maior gasto: ${tc.list[0].name} (${brl(tc.list[0].value)}, ${pct(tc.list[0].share)}).`);
    if (c.tp.exp > 0) linhas.push(`Vs mês passado: ${arrow(c.expDelta)} ${pct(Math.abs(c.expPct))} em despesas.`);
    linhas.push(`Projeção de fechamento: ~${brl(f.projecao)}.`);
    if (d.saldo > 0) linhas.push(`Dívidas: ${brl(d.saldo)} (${brl(d.mensal)}/mês).`);
    if (hikes[0]) linhas.push(`Atenção: ${hikes[0].name} subiu ${hikes[0].changePct}% (${brl(hikes[0].from)}→${brl(hikes[0].to)}).`);
    if (anom[0]) linhas.push(`Cobrança atípica: ${anom[0].description || 'lançamento'} de ${brl(anom[0].amount)}.`);
    return { text: `${g}Raio-X das suas finanças:\n\n• ${linhas.join('\n• ')}` };
  }
  if (intent === 'renda') { const t = totals(ctx, p); return { text: `${g}Sua renda em ${p.label} foi de **${brl(t.inc)}**. Com despesas de ${brl(t.exp)}, sobraram ${brl(t.saldo)} (${pct(t.rate)} de poupança).` }; }
  if (intent === 'poupanca') { const t = totals(ctx, p); const msg = t.rate >= 0.2 ? 'Excelente, acima dos 20% recomendados! 👏' : t.rate > 0 ? 'Dá pra apertar um pouco mais para chegar aos 20% ideais.' : 'Neste período você gastou mais do que ganhou — vale rever as maiores despesas.'; return { text: `${g}Em ${p.label} você guardou **${brl(t.saldo)}**, uma taxa de poupança de ${pct(t.rate)}. ${msg}` }; }
  if (intent === 'saldo') {
    const bal = totalBalance(ctx);
    const tops = [...ctx.accounts].sort((a, b) => num(b.current_balance) - num(a.current_balance)).slice(0, 3).map((a) => `${a.name} (${brl(a.current_balance)})`).join(', ');
    return { text: `${g}Somando todas as suas contas, você tem **${brl(bal)}** disponível.${tops ? ` As maiores: ${tops}.` : ''}` };
  }
  if (intent === 'dividas') {
    const d = debtInfo(ctx);
    if (d.saldo <= 0) return { text: `${g}Boa notícia: você não tem dívidas em aberto cadastradas. 🎉` };
    return { text: `${g}Você deve cerca de **${brl(d.saldo)}** no total, com parcelas somando ${brl(d.mensal)} por mês. Quer que eu simule quitar mais rápido? É só usar a aba Simulador em Dívidas.` };
  }
  if (intent === 'patrimonio') {
    const bal = totalBalance(ctx); const inv = investTotal(ctx); const d = debtInfo(ctx); const nw = bal + inv - d.saldo;
    return { text: `${g}Seu patrimônio líquido é de **${brl(nw)}**: ${brl(bal)} em contas + ${brl(inv)} em investimentos − ${brl(d.saldo)} em dívidas.` };
  }
  if (intent === 'investimentos') {
    const inv = investTotal(ctx); const aplicado = ctx.investments.reduce((s, i) => s + num(i.invested_amount), 0); const ganho = inv - aplicado;
    if (inv <= 0) return { text: `${g}Você ainda não tem investimentos cadastrados. Quando cadastrar, eu acompanho o rendimento pra você.` };
    return { text: `${g}Sua carteira soma **${brl(inv)}**${aplicado ? ` (aplicado ${brl(aplicado)}, ${ganho >= 0 ? 'ganho' : 'perda'} de ${brl(Math.abs(ganho))})` : ''}.` };
  }
  if (intent === 'vencimentos') {
    const up = upcoming(ctx, 15); const overdue = up.filter((x) => x.overdue);
    if (!up.length) return { text: `${g}Não há contas a vencer nos próximos 15 dias. Tudo em dia! ✅` };
    const total = up.reduce((s, x) => s + (x.amount < 0 ? -x.amount : 0), 0);
    const lista = up.slice(0, 4).map((x) => `${x.label} (${brl(Math.abs(x.amount))}${x.overdue ? ', vencido' : ''})`).join('; ');
    return { text: `${g}Nos próximos 15 dias há **${up.length} compromisso(s)** somando ${brl(total)} a pagar${overdue.length ? `, sendo ${overdue.length} já vencido(s)` : ''}. Ex.: ${lista}.` };
  }
  if (intent === 'metas') {
    if (!ctx.goals.length) return { text: `${g}Você ainda não tem metas. Criar uma meta ajuda a guardar com propósito — posso te mostrar a tela Metas.` };
    const saved = ctx.goals.reduce((s, m) => s + num(m.current_amount), 0);
    const alvo = ctx.goals.reduce((s, m) => s + num(m.target_amount || m.target || 0), 0);
    return { text: `${g}Você tem ${ctx.goals.length} meta(s) e já guardou **${brl(saved)}**${alvo ? ` de ${brl(alvo)} (${pct(saved / alvo)})` : ''}. Continue assim!` };
  }
  if (intent === 'assinaturas') {
    const active = ctx.subs.filter((s) => s.is_active !== false);
    if (!active.length) return { text: `${g}Não encontrei assinaturas ativas cadastradas.` };
    const total = active.reduce((s, x) => s + num(x.amount), 0);
    const lista = [...active].sort((a, b) => num(b.amount) - num(a.amount)).slice(0, 4).map((s) => `${s.name} (${brl(s.amount)})`).join(', ');
    return { text: `${g}Você tem ${active.length} assinatura(s) somando **${brl(total)}/mês** (${brl(total * 12)}/ano). As maiores: ${lista}.` };
  }
  if (intent === 'cartao') {
    const open = ctx.invoices.filter((i) => i.status === 'open' || i.status === 'overdue');
    const total = open.reduce((s, i) => s + num(i.total_amount), 0);
    if (!open.length) return { text: `${g}Não há faturas de cartão em aberto no momento.` };
    return { text: `${g}Você tem ${open.length} fatura(s) de cartão em aberto somando **${brl(total)}**. Veja detalhes e pague na tela Cartões.` };
  }
  if (intent === 'resumo') {
    const t = totals(ctx, p); const bal = totalBalance(ctx); const d = debtInfo(ctx); const nw = bal + investTotal(ctx) - d.saldo;
    return { text: `${g}Aqui está seu panorama de ${p.label}: saldo em contas **${brl(bal)}**, você recebeu ${brl(t.inc)} e gastou ${brl(t.exp)} (poupança de ${pct(t.rate)}). Patrimônio líquido: ${brl(nw)}${d.mensal ? ` · comprometido com dívidas ${brl(d.mensal)}/mês` : ''}. Quer que eu detalhe alguma parte?` };
  }
  if (intent === 'ajuda' || !intent) {
    const nm = firstName(ctx.user);
    return { text: `${agent?.name ? `Sou o ${agent.name}, ` : 'Sou seu agente financeiro, '}${nm}. Leio seus dados e respondo em linguagem natural. Experimente perguntar: “onde gasto mais?”, “quanto recebi esse mês?”, “qual meu patrimônio?”, “quanto devo?”, “o que vence essa semana?”, “como está minha saúde financeira?” ou “como está o dólar?”.` };
  }
  return { text: `${g}Não entendi bem. Tente perguntar sobre saldo, gastos, dívidas, patrimônio, vencimentos, metas, assinaturas ou mercado.` };
}
