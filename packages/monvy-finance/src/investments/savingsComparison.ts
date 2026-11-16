/**
 * Comparação Poupança × CDB (ou outro investimento de renda fixa pós-fixado ao CDI).
 * Extraído e generalizado de `src/pages/SavingsVsCdb.jsx`.
 *
 * Importante (seção 11 do escopo): esta função é um SIMULADOR PARAMETRIZÁVEL. Ela não chama a
 * API do Banco Central nem embute taxas de mercado "atuais" — todas as taxas (CDI, Selic, regra
 * da poupança, alíquotas de IR) são informadas explicitamente pelo consumidor. Isso evita o
 * problema identificado no código original de tratar valores observados em uma data específica
 * como válidos indefinidamente.
 */
import { assertNonNegative, assertPositiveInteger, assertFiniteNumber } from '../core/validation.js';
import { roundCurrency } from '../core/money.js';
import { percentToFraction } from '../core/rates.js';

/**
 * Tabela de IR regressivo sobre renda fixa (alíquota conforme prazo em dias corridos).
 * Esta é a estrutura de faixas da legislação brasileira de IR sobre renda fixa — não uma tabela
 * de taxas de mercado datadas. Ainda assim, o consumidor pode sobrescrever via `irBracketsOverride`
 * caso a legislação mude ou para simular outro regime tributário.
 */
export const DEFAULT_FIXED_INCOME_IR_BRACKETS: Array<{ maxDays: number; ratePct: number }> = [
  { maxDays: 180, ratePct: 22.5 },
  { maxDays: 360, ratePct: 20 },
  { maxDays: 720, ratePct: 17.5 },
  { maxDays: Infinity, ratePct: 15 },
];

/** Retorna a alíquota de IR regressivo (percentual) aplicável para `days` dias corridos de aplicação. */
export function fixedIncomeIrRate(days: number, brackets: Array<{ maxDays: number; ratePct: number }> = DEFAULT_FIXED_INCOME_IR_BRACKETS): number {
  assertNonNegative(days, 'days');
  const bracket = brackets.find((b) => days <= b.maxDays) ?? brackets[brackets.length - 1];
  return bracket.ratePct;
}

/**
 * Regra de remuneração da poupança (simplificada, parametrizável): quando a Selic anual está
 * acima de `selicThresholdPct` (padrão 8.5% a.a., limite em vigor desde a Lei 12.703/2012), a
 * poupança rende 0,5% a.m. + TR; abaixo disso, rende 70% da Selic a.a., capitalizados
 * mensalmente. TR é tratada como 0 por padrão (pode ser informada via `trMonthlyPct`).
 */
export interface SavingsRateRuleInput {
  selicAnnualPct: number;
  selicThresholdPct?: number;
  trMonthlyPct?: number;
}

export function savingsMonthlyRatePct(input: SavingsRateRuleInput): number {
  const selicAnnualPct = assertFiniteNumber(input.selicAnnualPct, 'selicAnnualPct');
  const selicThresholdPct = input.selicThresholdPct ?? 8.5;
  const trMonthlyPct = input.trMonthlyPct ?? 0;
  if (selicAnnualPct > selicThresholdPct) {
    return (0.5 + trMonthlyPct);
  }
  const selicFraction = percentToFraction(selicAnnualPct);
  return (Math.pow(1 + selicFraction * 0.7, 1 / 12) - 1) * 100 + trMonthlyPct;
}

export interface SavingsVsFixedIncomeInput {
  initialAmount: number;
  months: number;
  /** Taxa Selic anual, em percentual — usada para calcular a remuneração da poupança. */
  selicAnnualPct: number;
  /** Taxa CDI anual, em percentual — usada como referência do investimento pós-fixado. */
  cdiAnnualPct: number;
  /** Percentual do CDI pago pelo investimento (ex.: 100 = 100% do CDI). */
  percentOfCdi: number;
  irBrackets?: Array<{ maxDays: number; ratePct: number }>;
  savingsRule?: Omit<SavingsRateRuleInput, 'selicAnnualPct'>;
  /** Dias corridos por mês usados para olhar a tabela de IR (padrão 30, igual ao app original). */
  daysPerMonth?: number;
}

export interface SavingsVsFixedIncomePoint {
  month: number;
  savingsBalance: number;
  fixedIncomeNetBalance: number;
}

export interface SavingsVsFixedIncomeResult {
  savingsFinalBalance: number;
  savingsGain: number;
  fixedIncomeGrossBalance: number;
  fixedIncomeNetBalance: number;
  fixedIncomeGain: number;
  irRatePct: number;
  winner: 'savings' | 'fixed_income' | 'tie';
  difference: number;
  series: SavingsVsFixedIncomePoint[];
}

/**
 * Compara, mês a mês, o saldo líquido (já descontado o IR regressivo, quando aplicável) de um
 * investimento pós-fixado ao CDI contra a poupança. A poupança é tratada como isenta de IR,
 * como na legislação vigente para pessoa física.
 */
export function compareSavingsVsFixedIncome(input: SavingsVsFixedIncomeInput): SavingsVsFixedIncomeResult {
  const initialAmount = assertNonNegative(input.initialAmount, 'initialAmount');
  const months = assertPositiveInteger(input.months, 'months');
  const selicAnnualPct = assertFiniteNumber(input.selicAnnualPct, 'selicAnnualPct');
  const cdiAnnualPct = assertFiniteNumber(input.cdiAnnualPct, 'cdiAnnualPct');
  const percentOfCdi = assertFiniteNumber(input.percentOfCdi, 'percentOfCdi');
  const daysPerMonth = input.daysPerMonth ?? 30;
  const irBrackets = input.irBrackets ?? DEFAULT_FIXED_INCOME_IR_BRACKETS;

  const savingsMonthlyPct = savingsMonthlyRatePct({ selicAnnualPct, ...input.savingsRule });
  const savingsMonthlyFraction = percentToFraction(savingsMonthlyPct);

  // percentOfCdi é percentual (100 = 100% do CDI): taxa anual efetiva = cdiAnnualPct * (percentOfCdi/100)
  const effectiveAnnualFraction = percentToFraction(cdiAnnualPct) * (percentOfCdi / 100);
  const cdbMonthlyFractionFixed = Math.pow(1 + effectiveAnnualFraction, 1 / 12) - 1;

  let savingsBalance = initialAmount;
  let grossBalance = initialAmount;
  const series: SavingsVsFixedIncomePoint[] = [];

  for (let k = 1; k <= months; k++) {
    savingsBalance *= (1 + savingsMonthlyFraction);
    grossBalance *= (1 + cdbMonthlyFractionFixed);
    const irRatePct = fixedIncomeIrRate(k * daysPerMonth, irBrackets);
    const netGain = (grossBalance - initialAmount) * (1 - percentToFraction(irRatePct));
    const netBalance = initialAmount + netGain;
    series.push({ month: k, savingsBalance: roundCurrency(savingsBalance), fixedIncomeNetBalance: roundCurrency(netBalance) });
  }

  const finalIrRatePct = fixedIncomeIrRate(months * daysPerMonth, irBrackets);
  const fixedIncomeNetBalance = initialAmount + (grossBalance - initialAmount) * (1 - percentToFraction(finalIrRatePct));
  const difference = fixedIncomeNetBalance - savingsBalance;

  return {
    savingsFinalBalance: roundCurrency(savingsBalance),
    savingsGain: roundCurrency(savingsBalance - initialAmount),
    fixedIncomeGrossBalance: roundCurrency(grossBalance),
    fixedIncomeNetBalance: roundCurrency(fixedIncomeNetBalance),
    fixedIncomeGain: roundCurrency(fixedIncomeNetBalance - initialAmount),
    irRatePct: finalIrRatePct,
    winner: Math.abs(difference) < 0.005 ? 'tie' : (difference > 0 ? 'fixed_income' : 'savings'),
    difference: roundCurrency(Math.abs(difference)),
    series,
  };
}
