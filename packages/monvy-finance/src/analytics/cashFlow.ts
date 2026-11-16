/**
 * Análise de fluxo de caixa e orçamento a partir de lançamentos financeiros.
 * Extraído e generalizado de `src/lib/analytics.js` (`monthlySeries`, `monthTotals`,
 * `categoryBreakdown`, `linearRegression`, `forecastNextMonth`, `projectBalance`).
 *
 * Este módulo NÃO acessa banco de dados: todas as funções recebem os lançamentos diretamente
 * como parâmetros (puros, determinísticos, sem I/O).
 */
import { assertFiniteNumber, assertNonNegativeInteger } from '../core/validation.js';
import { roundCurrency } from '../core/money.js';

export type TransactionType = 'income' | 'expense' | 'transfer';

export interface Transaction {
  /** Data no formato ISO (YYYY-MM-DD ou YYYY-MM-DDTHH:mm:ss). */
  date: string;
  type: TransactionType;
  amount: number;
  categoryId?: string | null;
}

/** Chave de mês no formato "YYYY-MM". */
export type MonthKey = string;

function toMonthKey(date: string): MonthKey {
  return String(date).slice(0, 7);
}

/** Gera as `n` chaves de mês mais recentes (mais antiga primeiro), terminando em `endMonthKey` (ou no mês atual, se omitido — injete explicitamente para manter a função pura). */
export function lastMonthKeys(n: number, endMonthKey: MonthKey): MonthKey[] {
  assertNonNegativeInteger(n, 'n');
  const [y, m] = endMonthKey.split('-').map(Number);
  const out: MonthKey[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

export interface MonthlySeriesPoint {
  monthKey: MonthKey;
  income: number;
  expense: number;
  net: number;
}

/** Agrupa receitas e despesas por mês, para a lista de meses informada. Equivalente a `monthlySeries`. */
export function monthlySeries(transactions: Transaction[], monthKeys: MonthKey[]): MonthlySeriesPoint[] {
  return monthKeys.map((monthKey) => {
    let income = 0, expense = 0;
    for (const t of transactions) {
      if (toMonthKey(t.date) !== monthKey) continue;
      if (t.type === 'income') income += Number(t.amount || 0);
      else if (t.type === 'expense') expense += Number(t.amount || 0);
    }
    return { monthKey, income: roundCurrency(income), expense: roundCurrency(expense), net: roundCurrency(income - expense) };
  });
}

export interface MonthTotals {
  income: number;
  expense: number;
  net: number;
  /** Taxa de poupança do mês (0 a 100), ou 0 quando não há receita. */
  savingsRatePct: number;
}

/** Totais de um único mês. Equivalente a `monthTotals`. */
export function monthTotals(transactions: Transaction[], monthKey: MonthKey): MonthTotals {
  let income = 0, expense = 0;
  for (const t of transactions) {
    if (toMonthKey(t.date) !== monthKey) continue;
    if (t.type === 'income') income += Number(t.amount || 0);
    else if (t.type === 'expense') expense += Number(t.amount || 0);
  }
  return {
    income: roundCurrency(income),
    expense: roundCurrency(expense),
    net: roundCurrency(income - expense),
    savingsRatePct: income > 0 ? Math.round(((income - expense) / income) * 10000) / 100 : 0,
  };
}

export interface CategoryBreakdownEntry {
  categoryId: string;
  total: number;
}

/** Soma de despesas (ou receitas) por categoria, opcionalmente filtrado por mês. Equivalente a `categoryBreakdown` (sem acoplamento a cores/UI). */
export function categoryBreakdown(transactions: Transaction[], type: 'income' | 'expense' = 'expense', monthKey?: MonthKey): CategoryBreakdownEntry[] {
  const map = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== type) continue;
    if (monthKey && toMonthKey(t.date) !== monthKey) continue;
    const key = t.categoryId || 'uncategorized';
    map.set(key, (map.get(key) || 0) + Number(t.amount || 0));
  }
  return [...map.entries()]
    .map(([categoryId, total]) => ({ categoryId, total: roundCurrency(total) }))
    .sort((a, b) => b.total - a.total);
}

export interface LinearRegressionResult {
  slope: number;
  intercept: number;
  predict: (x: number) => number;
}

/**
 * Regressão linear simples (mínimos quadrados ordinários) sobre uma série `ys` indexada por
 * posição (0, 1, 2, ...). Equivalente a `linearRegression`/`regress` de `analytics.js`.
 *
 * Limitação estatística (documentada conforme seção 12 do escopo): esta é uma regressão OLS
 * simples sobre poucos pontos, sem intervalo de confiança, sem tratamento de sazonalidade e
 * sensível a mudanças estruturais na série. Trate o resultado como uma ESTIMATIVA, não como
 * previsão garantida.
 */
export function linearRegression(ys: number[]): LinearRegressionResult {
  const n = ys.length;
  if (n < 2) {
    const value = ys[0] ?? 0;
    return { slope: 0, intercept: value, predict: () => value };
  }
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  ys.forEach((y, x) => { sx += x; sy += y; sxy += x * y; sxx += x * x; });
  const denominator = n * sxx - sx * sx || 1;
  const slope = (n * sxy - sx * sy) / denominator;
  const intercept = (sy - slope * sx) / n;
  return { slope, intercept, predict: (x: number) => intercept + slope * x };
}

export interface ForecastResult {
  income: number;
  expense: number;
  net: number;
  /** Sempre `true`: sinaliza explicitamente que o resultado é uma estimativa estatística, não uma garantia. */
  isEstimate: true;
  /** Tamanho da amostra (número de meses) usada — útil para o consumidor avaliar a confiabilidade. */
  sampleSize: number;
}

/**
 * Projeta receita/despesa do próximo mês combinando tendência (regressão linear) com média
 * móvel simples (60% tendência + 40% média), floor em 0. Equivalente a `forecastNextMonth`.
 *
 * Limitações (documentar ao consumidor): amostra pequena reduz a confiabilidade; não há
 * tratamento de sazonalidade nem intervalo de confiança; mudanças estruturais recentes (ex.:
 * mudança de emprego, grande gasto único) distorcem a estimativa.
 */
export function forecastNextMonth(transactions: Transaction[], monthKeys: MonthKey[]): ForecastResult {
  const series = monthlySeries(transactions, monthKeys);
  const forecastField = (field: 'income' | 'expense'): number => {
    const ys = series.map((s) => s[field]);
    const reg = linearRegression(ys);
    const trend = reg.predict(ys.length);
    const avg = ys.reduce((a, b) => a + b, 0) / (ys.length || 1);
    return Math.max(0, 0.6 * trend + 0.4 * avg);
  };
  const income = forecastField('income');
  const expense = forecastField('expense');
  return { income: roundCurrency(income), expense: roundCurrency(expense), net: roundCurrency(income - expense), isEstimate: true, sampleSize: series.length };
}

export interface ProjectBalancePoint {
  monthsAhead: number;
  balance: number;
}

/**
 * Projeta o saldo acumulado por `months` meses à frente, a partir de `startBalance`, aplicando
 * `monthlyNet` (e um ajuste constante opcional `extraDelta`) a cada mês. Projeção determinística
 * (não é previsão de mercado) — equivalente a `projectBalance`.
 */
export function projectBalance(startBalance: number, monthlyNet: number, months: number, extraDelta = 0): ProjectBalancePoint[] {
  assertFiniteNumber(startBalance, 'startBalance');
  assertFiniteNumber(monthlyNet, 'monthlyNet');
  assertNonNegativeInteger(months, 'months');
  assertFiniteNumber(extraDelta, 'extraDelta');
  const out: ProjectBalancePoint[] = [];
  let balance = startBalance;
  for (let i = 1; i <= months; i++) {
    balance += monthlyNet + extraDelta;
    out.push({ monthsAhead: i, balance: roundCurrency(balance) });
  }
  return out;
}
