// Assistente financeiro local (sem IA de terceiros): interpreta a pergunta, le todos os
// dados do usuario e responde em linguagem natural e personalizada.

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

function greetLine(user, agent) {
  const nm = firstName(user);
  const who = agent?.name ? `Aqui e o ${agent.name}. ` : '';
  return pick([`Olá, ${nm}! ${who}`, `Oi, ${nm}! ${who}`, `${who}Vamos lá, ${nm}. `, `Fala, ${nm}! ${who}`]);
}

// ---- INTENCOES ----
const INTENTS = [
  { key: 'gastos_top', kw: ['onde gasto', 'gasto mais', 'maior gasto', 'gasto por categoria', 'gastos por categoria', 'onde vai meu dinheiro', 'onde estou gastando', 'categoria que mais'] },
  { key: 'despesas', kw: ['quanto gastei', 'minhas despesas', 'total de despesas', 'gastei esse', 'gastei este', 'quanto de despesa'] },
  { key: 'renda', kw: ['quanto recebi', 'minha renda', 'quanto ganhei', 'receita', 'quanto entrou'] },
  { key: 'poupanca', kw: ['quanto poupei', 'poupanca', 'quanto sobrou', 'quanto economizei', 'minha sobra', 'consegui guardar'] },
  { key: 'saldo', kw: ['meu saldo', 'quanto tenho', 'quanto eu tenho', 'saldo total', 'dinheiro em conta', 'quanto de dinheiro'] },
  { key: 'dividas', kw: ['quanto devo', 'minhas dividas', 'divida', 'financiamento', 'emprestimo', 'quanto falta pagar'] },
  { key: 'patrimonio', kw: ['patrimonio', 'net worth', 'quanto valho', 'minha riqueza', 'quanto tenho no total'] },
  { key: 'investimentos', kw: ['investimento', 'quanto investi', 'meus investi', 'rendimento', 'carteira'] },
  { key: 'vencimentos', kw: ['vence', 'vencimento', 'a pagar', 'contas a pagar', 'o que preciso pagar', 'proximos pagamentos', 'boleto'] },
  { key: 'metas', kw: ['meta', 'objetivo', 'cofre', 'quanto guardei'] },
  { key: 'assinaturas', kw: ['assinatura', 'assinaturas', 'streaming', 'recorrente'] },
  { key: 'cartao', kw: ['cartao', 'fatura', 'cartao de credito'] },
  { key: 'mercado', kw: ['dolar', 'euro', 'bitcoin', 'cripto', 'ibovespa', 'mercado', 'cotacao', 'bolsa'] },
  { key: 'resumo', kw: ['resumo', 'como estou', 'como esta minha', 'panorama', 'situacao', 'saude financeira'] },
  { key: 'ajuda', kw: ['ajuda', 'o que voce faz', 'o que sabe', 'pode fazer', 'quem e voce', 'comandos'] },
];
function detect(q) {
  let best = null, score = 0;
  for (const it of INTENTS) {
    const s = it.kw.reduce((n, k) => n + (q.includes(k) ? k.split(' ').length : 0), 0);
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
  const map = { gastos_top: 'gastos', despesas: 'gastos', assinaturas: 'gastos', renda: 'geral', poupanca: 'geral', saldo: 'saldo', dividas: 'vencimentos', cartao: 'vencimentos', vencimentos: 'vencimentos', patrimonio: 'patrimonio', investimentos: 'patrimonio', mercado: 'mercado', metas: 'geral', resumo: 'geral', ajuda: 'geral' };
  return map[detect(norm(question))] || 'geral';
}
const cfgOf = (a) => { try { return typeof a.config === 'string' ? JSON.parse(a.config) : (a.config || {}); } catch { return {}; } };
// escolhe o robo que "tem a resposta" com base no foco
export function routeAgent(question, agents = []) {
  const focus = intentFocus(question);
  return agents.find((a) => cfgOf(a).focus === focus) || agents.find((a) => cfgOf(a).focus === 'geral') || agents[0] || null;
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

  if (intent === 'gastos_top') {
    const t = topCategories(ctx, p, 3);
    if (!t.list.length) return { text: `${g}Não encontrei despesas em ${p.label} para analisar. Assim que você lançar seus gastos, eu mostro onde o dinheiro está indo.` };
    const top = t.list[0];
    const restos = t.list.slice(1).map((c) => `${c.name} (${brl(c.value)})`).join(' e ');
    return { text: `${g}Em ${p.label}, você gasta mais com **${top.name}**: ${brl(top.value)}, cerca de ${pct(top.share)} de tudo que gastou.${restos ? ` Na sequência vêm ${restos}.` : ''} Se quiser reduzir, essa é a categoria com maior impacto.` };
  }
  if (intent === 'despesas') { const t = totals(ctx, p); return { text: `${g}Em ${p.label} você gastou **${brl(t.exp)}**${t.inc ? ` e recebeu ${brl(t.inc)}, um ${t.saldo >= 0 ? 'saldo positivo' : 'saldo negativo'} de ${brl(t.saldo)}` : ''}.` }; }
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
