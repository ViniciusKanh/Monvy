import { monthKey, inMonth, MONTHS_PT } from './utils.js';

// Paleta harmonica (teal -> azul -> indigo -> violeta -> ambar -> rosa)
export const PALETTE = ['#10b981', '#14b8a6', '#0ea5e9', '#6366f1', '#8b5cf6', '#f59e0b', '#f43f5e', '#64748b'];
export const colorAt = (i) => PALETTE[i % PALETTE.length];

const num = (v) => Number(v || 0);
const done = (t) => (t.status || 'pending') === 'completed' || t.status == null;

// ---- Series mensais ----
export function lastMonths(n, endMk) {
  const [y, m] = (endMk || monthKey(new Date())).split('-').map(Number);
  const arr = [];
  for (let i = n - 1; i >= 0; i--) { const d = new Date(y, m - 1 - i, 1); arr.push(monthKey(d)); }
  return arr;
}

export function monthlySeries(transactions, months) {
  return months.map((k) => {
    let inc = 0, exp = 0;
    for (const t of transactions) {
      if (String(t.date).slice(0, 7) !== k) continue;
      if (t.type === 'income') inc += num(t.amount);
      else if (t.type === 'expense') exp += num(t.amount);
    }
    const [y, m] = k.split('-').map(Number);
    return { mk: k, name: `${MONTHS_PT[m - 1].slice(0, 3)}/${String(y).slice(2)}`, inc, exp, net: inc - exp };
  });
}

export function monthTotals(transactions, mk) {
  let inc = 0, exp = 0;
  for (const t of transactions) {
    if (!inMonth(t.date, mk)) continue;
    if (t.type === 'income') inc += num(t.amount);
    else if (t.type === 'expense') exp += num(t.amount);
  }
  return { inc, exp, net: inc - exp, rate: inc > 0 ? ((inc - exp) / inc) * 100 : 0 };
}

// ---- Categorias ----
export function categoryBreakdown(transactions, mk, catMap, type = 'expense') {
  const map = {};
  for (const t of transactions) {
    if (t.type !== type || (mk && !inMonth(t.date, mk))) continue;
    const c = catMap[t.category_id];
    const n = c?.name || 'Sem categoria';
    map[n] = map[n] || { name: n, value: 0, color: c?.color };
    map[n].value += num(t.amount);
  }
  return Object.values(map).sort((a, b) => b.value - a.value).map((c, i) => ({ ...c, color: c.color || colorAt(i) }));
}

// ---- Gasto por dia da semana (mes atual ou geral) ----
export function weekdaySpending(transactions, mk) {
  const wd = [0, 0, 0, 0, 0, 0, 0];
  for (const t of transactions) {
    if (t.type !== 'expense') continue;
    if (mk && !inMonth(t.date, mk)) continue;
    const d = new Date(String(t.date).slice(0, 10) + 'T00:00');
    wd[d.getDay()] += num(t.amount);
  }
  const labels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
  return wd.map((v, i) => ({ name: labels[i], value: v, weekend: i === 0 || i === 6 }));
}

// ---- Regressao linear (minimos quadrados) ----
export function linearRegression(ys) {
  const n = ys.length;
  if (n < 2) return { slope: 0, intercept: ys[0] || 0, predict: () => ys[0] || 0 };
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  ys.forEach((y, x) => { sx += x; sy += y; sxy += x * y; sxx += x * x; });
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1);
  const intercept = (sy - slope * sx) / n;
  return { slope, intercept, predict: (x) => intercept + slope * x };
}

// Previsao do proximo mes: combina media movel + tendencia (regressao)
export function forecastNextMonth(transactions, months) {
  const series = monthlySeries(transactions, months);
  const forecast = (key) => {
    const ys = series.map((s) => s[key]);
    const reg = linearRegression(ys);
    const trend = reg.predict(ys.length); // proximo ponto
    const avg = ys.reduce((a, b) => a + b, 0) / (ys.length || 1);
    return Math.max(0, 0.6 * trend + 0.4 * avg); // suaviza
  };
  const inc = forecast('inc'), exp = forecast('exp');
  return { inc, exp, net: inc - exp };
}

// Projecao de saldo por N meses a partir de um saldo inicial (com tendencia)
export function projectBalance(startBalance, monthlyNet, months = 12, extraDelta = 0) {
  const arr = [];
  let bal = startBalance;
  for (let i = 1; i <= months; i++) {
    bal += monthlyNet + extraDelta;
    const d = new Date(); d.setMonth(d.getMonth() + i);
    arr.push({ name: `${MONTHS_PT[d.getMonth()].slice(0, 3)}/${String(d.getFullYear()).slice(2)}`, Saldo: Math.round(bal) });
  }
  return arr;
}

// ---- Anomalias (z-score por categoria) ----
export function detectAnomalies(transactions, catMap) {
  const groups = {};
  for (const t of transactions) {
    if (t.type !== 'expense') continue;
    (groups[t.category_id || 'none'] = groups[t.category_id || 'none'] || []).push(t);
  }
  const out = [];
  for (const [cid, list] of Object.entries(groups)) {
    if (list.length < 4) continue;
    const vals = list.map((t) => num(t.amount));
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length) || 1;
    for (const t of list) {
      const z = (num(t.amount) - mean) / sd;
      if (z >= 2.2) out.push({ id: t.id, description: t.description || catMap[cid]?.name || 'Gasto', amount: num(t.amount), category: catMap[cid]?.name || 'Sem categoria', z: z.toFixed(1), average: mean, date: t.date });
    }
  }
  return out.sort((a, b) => b.amount - a.amount).slice(0, 8);
}

// ---- Agrupar por descricao (estabelecimentos / fontes de receita) ----
export function groupByDescription(transactions, type, limit = 6) {
  const map = {};
  for (const t of transactions) {
    if (t.type !== type) continue;
    const key = (t.description || 'Outros').trim();
    map[key] = map[key] || { name: key, value: 0, count: 0 };
    map[key].value += num(t.amount); map[key].count++;
  }
  return Object.values(map).sort((a, b) => b.value - a.value).slice(0, limit);
}

// ---- Score de saude financeira (0-100) ----
export function healthScore({ transactions, months, totalBalance, categories, cards }) {
  const series = monthlySeries(transactions, months);
  const avgInc = series.reduce((a, s) => a + s.inc, 0) / (series.length || 1);
  const avgExp = series.reduce((a, s) => a + s.exp, 0) / (series.length || 1);
  const rate = avgInc > 0 ? (avgInc - avgExp) / avgInc : 0;

  // 1. Taxa de poupanca (25)
  const p1 = Math.max(0, Math.min(25, Math.round((rate / 0.2) * 25)));
  // 2. Comprometimento da renda (20) - quanto menor a despesa/renda melhor
  const commit = avgInc > 0 ? avgExp / avgInc : 1;
  const p2 = Math.max(0, Math.min(20, Math.round((1 - Math.min(1, commit)) * 20)));
  // 3. Reserva de seguranca (20) - meta = 3x despesa mensal
  const reserveTarget = avgExp * 3 || 1;
  const p3 = Math.max(0, Math.min(20, Math.round((totalBalance / reserveTarget) * 20)));
  const reserveMonths = avgExp > 0 ? totalBalance / avgExp : 0;
  // 4. Controle de gastos (15) - % categorias usadas
  const usedCats = new Set(transactions.filter((t) => t.type === 'expense' && t.category_id).map((t) => t.category_id)).size;
  const totalCats = (categories || []).filter((c) => c.type === 'expense').length || 1;
  const p4 = Math.max(0, Math.min(15, Math.round((usedCats / totalCats) * 15)));
  // 5. Uso do cartao (20) - ideal usar <70% do limite
  const p5 = (cards || []).length ? 15 : 20;

  const pillars = [
    { name: 'Taxa de Poupanca', score: p1, max: 25, detail: `${(rate * 100).toFixed(0)}% da renda`, tip: 'Tente guardar ao menos 20% da renda' },
    { name: 'Comprometimento', score: p2, max: 20, detail: `${(commit * 100).toFixed(0)}% da renda em despesas`, tip: 'Reduza gastos fixos e parcelamentos' },
    { name: 'Reserva de Seguranca', score: p3, max: 20, detail: `${reserveMonths.toFixed(1)}x despesa mensal`, tip: `Meta: ${(reserveTarget).toFixed(0)}` },
    { name: 'Controle de Gastos', score: p4, max: 15, detail: `${usedCats} categoria(s) usadas`, tip: 'Categorize seus lancamentos' },
    { name: 'Uso do Cartao', score: p5, max: 20, detail: `${(cards || []).length} cartao(oes)`, tip: 'Use menos de 70% do limite' },
  ];
  const score = pillars.reduce((a, p) => a + p.score, 0);
  const label = score >= 80 ? 'Excelente' : score >= 60 ? 'Boa' : score >= 40 ? 'Atencao' : 'Critico';
  return { score, label, pillars, avgInc, avgExp, rate, reserveMonths, reserveTarget };
}

// ---- Perfil comportamental ----
export function behaviorProfile({ transactions, months, catMap }) {
  const series = monthlySeries(transactions, months);
  const exps = transactions.filter((t) => t.type === 'expense');
  const avgTicket = exps.length ? exps.reduce((a, t) => a + num(t.amount), 0) / exps.length : 0;

  // consistencia: 1 - coef. variacao das despesas mensais
  const em = series.map((s) => s.exp);
  const mean = em.reduce((a, b) => a + b, 0) / (em.length || 1);
  const sd = Math.sqrt(em.reduce((a, b) => a + (b - mean) ** 2, 0) / (em.length || 1));
  const cv = mean > 0 ? sd / mean : 0;
  const consistency = Math.max(0, Math.min(100, Math.round((1 - cv) * 100)));

  // taxa poupanca
  const avgInc = series.reduce((a, s) => a + s.inc, 0) / (series.length || 1);
  const rate = avgInc > 0 ? (avgInc - mean) / avgInc : 0;
  const savingsRate = Math.max(0, Math.round(rate * 100));

  // fim de semana
  let weekend = 0, weekday = 0;
  for (const t of exps) { const d = new Date(String(t.date).slice(0, 10) + 'T00:00'); if (d.getDay() === 0 || d.getDay() === 6) weekend += num(t.amount); else weekday += num(t.amount); }
  const weekendPct = weekday > 0 ? Math.round((weekend / weekday) * 100) : 0;

  // impulsividade: proporcao de gastos acima de 2x o ticket medio
  const impulsive = exps.filter((t) => num(t.amount) > avgTicket * 2).length;
  const impulsivity = exps.length ? Math.round((impulsive / exps.length) * 100) : 0;

  const wd = weekdaySpending(transactions, null);
  const peak = wd.reduce((a, b) => (b.value > a.value ? b : a), wd[0]);

  let profile = 'Equilibrado', desc = 'Voce mantem um bom equilibrio financeiro.';
  if (savingsRate >= 30 && impulsivity < 20) { profile = 'Conservador'; desc = 'Voce e cauteloso com o dinheiro, prioriza seguranca e tende a evitar riscos. Tem boa disciplina financeira.'; }
  else if (impulsivity >= 35) { profile = 'Impulsivo'; desc = 'Voce tende a gastos por impulso. Vale planejar compras maiores com antecedencia.'; }
  else if (savingsRate < 10) { profile = 'Gastador'; desc = 'Sua taxa de poupanca esta baixa. Foque em reduzir despesas variaveis.'; }

  const radar = [
    { axis: 'Controle', value: Math.min(100, 100 - impulsivity) },
    { axis: 'Poupanca', value: savingsRate },
    { axis: 'Consistencia', value: consistency },
    { axis: 'Diversificacao', value: Math.min(100, new Set(exps.map((t) => t.category_id)).size * 12) },
    { axis: 'Planejamento', value: Math.min(100, consistency * 0.6 + savingsRate * 0.4) },
  ];

  return { profile, desc, impulsivity, consistency, savingsRate, weekendPct, avgTicket, radar, peakDay: peak?.name, distribution: categoryBreakdown(transactions, null, catMap, 'expense') };
}


// Alertas inteligentes para o sino de notificacoes
export function computeAlerts({ transactions = [], invoices = [], subscriptions = [], categories = [], accounts = [], catMap = {} }) {
  const today = new Date().toISOString().slice(0, 10);
  const mk = today.slice(0, 7);
  const out = [];

  const overdue = transactions.filter((t) => t.type !== 'transfer' && (t.status || 'pending') !== 'completed' && String(t.date).slice(0, 10) <= today);
  if (overdue.length) out.push({ id: 'overdue', severity: 'warn', kind: 'overdue', title: `${overdue.length} lancamento(s) vencido(s)`, text: 'Marque como pago/recebido na Conciliacao.', path: '/conciliacao' });

  const soon = new Date(); soon.setDate(soon.getDate() + 7);
  invoices.forEach((inv) => {
    if ((inv.status === 'open' || inv.status === 'overdue') && inv.due_date) {
      const d = new Date(inv.due_date + 'T00:00');
      if (d >= new Date(today) && d <= soon) out.push({ id: 'inv-' + inv.id, severity: 'info', kind: 'invoice', title: 'Fatura proxima do vencimento', text: `Vence em ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} · ${num(inv.total_amount).toFixed(2)}`, path: '/cartoes' });
    }
  });

  // orcamento
  const spentByCat = {};
  for (const t of transactions) if (t.type === 'expense' && inMonth(t.date, mk) && t.category_id) spentByCat[t.category_id] = (spentByCat[t.category_id] || 0) + num(t.amount);
  for (const c of categories) {
    if (c.type === 'expense' && c.budget_limit) {
      const sp = spentByCat[c.id] || 0; const pct = sp / c.budget_limit;
      if (pct >= 1) out.push({ id: 'bud-' + c.id, severity: 'danger', kind: 'budget', title: `Orcamento estourado: ${c.name}`, text: `${Math.round(pct * 100)}% do limite usado.`, path: '/orcamento' });
      else if (pct >= 0.8) out.push({ id: 'bud-' + c.id, severity: 'warn', kind: 'budget', title: `Atencao no orcamento: ${c.name}`, text: `${Math.round(pct * 100)}% do limite.`, path: '/orcamento' });
    }
  }

  const anomalies = detectAnomalies(transactions, catMap);
  if (anomalies.length) out.push({ id: 'anom', severity: 'warn', kind: 'anomaly', title: `${anomalies.length} gasto(s) atipico(s)`, text: 'Cobrancas fora do padrao detectadas.', path: '/inteligencia' });

  accounts.forEach((a) => { if (Number(a.current_balance) < 0) out.push({ id: 'neg-' + a.id, severity: 'danger', kind: 'balance', title: `Saldo negativo: ${a.name}`, text: `${num(a.current_balance).toFixed(2)}`, path: '/contas' }); });

  const tot = monthTotals(transactions, mk);
  if (tot.inc > 0 && tot.bal < 0) out.push({ id: 'save', severity: 'warn', kind: 'savings', title: 'Gastando mais que ganha', text: `Saldo do mes ${tot.bal.toFixed(2)}.`, path: '/saude' });

  const order = { danger: 0, warn: 1, info: 2 };
  return out.sort((a, b) => order[a.severity] - order[b.severity]);
}

// Regressao linear por (x,y) explicitos
export function regress(xs, ys) {
  const n = xs.length;
  if (n < 2) return { slope: 0, intercept: ys[0] || 0, predict: () => ys[0] || 0 };
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sx += xs[i]; sy += ys[i]; sxy += xs[i] * ys[i]; sxx += xs[i] * xs[i]; }
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1);
  const intercept = (sy - slope * sx) / n;
  return { slope, intercept, predict: (x) => intercept + slope * x };
}

// Avaliacao ML real: ajuste OLS + R2 in-sample + validacao cruzada Leave-One-Out (MAE/RMSE) + sigma (banda)
export function evaluateModel(ys) {
  const n = ys.length;
  const xs = ys.map((_, i) => i);
  const reg = regress(xs, ys);
  const mean = ys.reduce((a, b) => a + b, 0) / (n || 1);
  let ssRes = 0, ssTot = 0;
  ys.forEach((y, i) => { const p = reg.predict(i); ssRes += (y - p) ** 2; ssTot += (y - mean) ** 2; });
  const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : (ssRes === 0 ? 1 : 0);
  const sigma = Math.sqrt(ssRes / Math.max(1, n - 2));

  // Leave-One-Out cross validation (metrica honesta em series curtas)
  let cvSae = 0, cvSse = 0, folds = 0;
  if (n >= 3) {
    for (let k = 0; k < n; k++) {
      const txs = xs.filter((_, i) => i !== k);
      const tys = ys.filter((_, i) => i !== k);
      const r = regress(txs, tys);
      const err = ys[k] - r.predict(k);
      cvSae += Math.abs(err); cvSse += err * err; folds++;
    }
  }
  const cvMae = folds ? cvSae / folds : 0;
  const cvRmse = folds ? Math.sqrt(cvSse / folds) : 0;
  const trend = reg.slope > 1 ? 'alta' : reg.slope < -1 ? 'queda' : 'estavel';
  return {
    model: 'Regressao Linear (OLS)', n, folds, r2, cvMae, cvRmse, sigma,
    slope: reg.slope, intercept: reg.intercept, trend, predict: reg.predict,
  };
}

// Detecta assinaturas recorrentes a partir das despesas (mesma descricao em >=3 meses, valor estavel)
export function detectSubscriptions(transactions, existing = []) {
  const norm = (d) => String(d || '').toLowerCase().trim();
  const existingNames = new Set(existing.map((s) => norm(s.name)));
  const groups = {};
  for (const t of transactions) {
    if (t.type !== 'expense' || !t.description) continue;
    const key = norm(t.description);
    (groups[key] = groups[key] || []).push(t);
  }
  const out = [];
  for (const [key, list] of Object.entries(groups)) {
    if (existingNames.has(key)) continue;
    const months = new Set(list.map((t) => String(t.date).slice(0, 7)));
    if (months.size < 3) continue;
    const vals = list.map((t) => num(t.amount));
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
    if (mean > 0 && sd / mean <= 0.15) { // valor estavel
      const day = Number(String(list[0].date).slice(8, 10)) || 1;
      out.push({ name: list[0].description, amount: Math.round(mean * 100) / 100, months: months.size, renewal_day: day });
    }
  }
  return out.sort((a, b) => b.months - a.months).slice(0, 8);
}

// Combina lancamentos das contas + compras do cartao (como despesas) para analises reais
export function combineExpenses(transactions, cardTxs = []) {
  const mapped = (cardTxs || []).map((t) => ({
    id: 'cc-' + t.id, type: 'expense', amount: num(t.amount),
    date: t.competence_month ? `${t.competence_month}-15` : String(t.date).slice(0, 10),
    category_id: t.category_id || null, description: t.description || 'Cartao de credito', status: 'completed', _card: true,
  }));
  return [...(transactions || []), ...mapped];
}

// Tendencia de gasto por categoria (regressao + variacao 1a metade vs 2a metade do periodo)
export function categoryTrends(transactions, months, catMap = {}) {
  const cats = {};
  for (const t of transactions) {
    if (t.type !== 'expense' || !t.category_id) continue;
    const mk = String(t.date).slice(0, 7);
    if (!months.includes(mk)) continue;
    (cats[t.category_id] = cats[t.category_id] || {});
    cats[t.category_id][mk] = (cats[t.category_id][mk] || 0) + num(t.amount);
  }
  const out = [];
  for (const [cid, byMonth] of Object.entries(cats)) {
    const ys = months.map((m) => byMonth[m] || 0);
    if (ys.filter((v) => v > 0).length < 2) continue;
    const reg = regress(ys.map((_, i) => i), ys);
    const half = Math.ceil(ys.length / 2);
    const a1 = ys.slice(0, half); const a2 = ys.slice(half);
    const m1 = a1.reduce((a, b) => a + b, 0) / (a1.length || 1);
    const m2 = a2.reduce((a, b) => a + b, 0) / (a2.length || 1);
    const change = m1 > 0 ? ((m2 - m1) / m1) * 100 : (m2 > 0 ? 100 : 0);
    const total = ys.reduce((a, b) => a + b, 0);
    const c = catMap[cid];
    out.push({ id: cid, name: c?.name || 'Sem categoria', color: c?.color || '#64748b', slope: reg.slope, change, total, avg: total / ys.length, series: ys });
  }
  return out.sort((a, b) => b.total - a.total);
}

// Motor de recomendacoes (sistema especialista, 100% local — sem IA de terceiros)
export function recommendations({ h, b, trends = [], subsCount = 0 } = {}) {
  const recs = [];
  const rate = h?.rate ?? 0;
  const commit = h && h.avgInc > 0 ? h.avgExp / h.avgInc : 0;
  if (rate <= 0) recs.push({ p: 0, type: 'warn', title: 'Gastando mais do que ganha', text: 'Suas despesas igualam ou superam a renda. Priorize cortar gastos variaveis ja neste mes.' });
  else if (rate < 0.1) recs.push({ p: 1, type: 'tip', title: 'Eleve sua taxa de poupanca', text: `Voce poupa ${(rate * 100).toFixed(0)}% da renda. Mire 10 a 20% ajustando os maiores gastos.` });
  if (commit > 0.9) recs.push({ p: 0, type: 'warn', title: 'Renda muito comprometida', text: `${(commit * 100).toFixed(0)}% da renda vai em despesas. Revise assinaturas e parcelamentos.` });
  if ((h?.reserveMonths ?? 99) < 3) recs.push({ p: 1, type: 'tip', title: 'Monte sua reserva de emergencia', text: `Sua reserva cobre ${(h?.reserveMonths ?? 0).toFixed(1)} mes(es). Meta saudavel: 3 a 6 meses de despesa.` });
  const rising = trends.filter((t) => t.change > 25 && t.total > (h?.avgExp || 0) * 0.1)[0];
  if (rising) recs.push({ p: 1, type: 'warn', title: `Gasto crescente: ${rising.name}`, text: `Subiu ${rising.change.toFixed(0)}% na comparacao recente. Vale investigar o que aumentou.` });
  const falling = trends.filter((t) => t.change < -25 && t.total > 0)[0];
  if (falling) recs.push({ p: 3, type: 'ok', title: `Voce economizou em ${falling.name}`, text: `Caiu ${Math.abs(falling.change).toFixed(0)}% recentemente. Bom trabalho — mantenha o ritmo.` });
  if ((b?.impulsivity ?? 0) >= 35) recs.push({ p: 2, type: 'tip', title: 'Compras por impulso', text: `${b.impulsivity}% das compras sao bem acima do seu ticket medio. Espere 24h antes de compras maiores.` });
  if ((b?.weekendPct ?? 0) >= 60) recs.push({ p: 2, type: 'tip', title: 'Gasto concentrado no fim de semana', text: `Fins de semana somam ${b.weekendPct}% do gasto dos dias uteis. Defina um limite para lazer.` });
  if (subsCount > 0) recs.push({ p: 2, type: 'tip', title: `${subsCount} assinatura(s) recorrente(s) detectada(s)`, text: 'Revise se ainda usa todas — cancelar as esquecidas gera economia todo mes.' });
  if (!recs.length) recs.push({ p: 3, type: 'ok', title: 'Financas saudaveis', text: 'Seus indicadores estao bons. Considere investir o excedente para o dinheiro render acima da inflacao.' });
  return recs.sort((a, b) => a.p - b.p);
}

// Previsao com sazonalidade (usa media do mes-calendario quando ha >=12 meses)
export function seasonalForecast(transactions, targetDate) {
  const d = targetDate ? new Date(targetDate) : (() => { const x = new Date(); x.setMonth(x.getMonth() + 1); return x; })();
  const targetMonth = d.getMonth();
  const all = monthlySeries(transactions, lastMonths(24));
  const nonEmpty = all.filter((s) => s.inc || s.exp);
  if (nonEmpty.length < 12) { const f = forecastNextMonth(transactions, lastMonths(6)); return { ...f, seasonal: false }; }
  const forKey = (key) => {
    const ys = nonEmpty.map((s) => s[key]);
    const overall = ys.reduce((a, b) => a + b, 0) / ys.length;
    const sameMonth = nonEmpty.filter((s) => Number(s.mk.split('-')[1]) - 1 === targetMonth).map((s) => s[key]);
    const seasonAvg = sameMonth.length ? sameMonth.reduce((a, b) => a + b, 0) / sameMonth.length : overall;
    const reg = linearRegression(ys);
    const trend = reg.predict(ys.length);
    return Math.max(0, 0.4 * trend + 0.3 * overall + 0.3 * seasonAvg);
  };
  const inc = forKey('inc'), exp = forKey('exp');
  return { inc, exp, net: inc - exp, seasonal: true };
}
