/**
 * Sistema de amortização SAC (Sistema de Amortização Constante).
 * Extraído e generalizado de `sacInstallments` (`src/lib/credit.js`) e de
 * `src/pages/PriceSac.jsx`.
 */
import { assertNonNegative, assertPositiveInteger, assertFiniteNumber } from '../core/validation.js';
import { roundCurrency } from '../core/money.js';
import { percentToFraction } from '../core/rates.js';

export interface SacInstallmentRow {
  period: number;
  installment: number;
  interest: number;
  amortization: number;
  remainingBalance: number;
}

export interface SacResult {
  principal: number;
  monthlyRatePct: number;
  months: number;
  /** Amortização constante por período (principal / months). */
  constantAmortization: number;
  firstInstallment: number;
  lastInstallment: number;
  totalPaid: number;
  totalInterest: number;
  schedule: SacInstallmentRow[];
}

/**
 * Calcula a simulação completa do financiamento pelo sistema SAC: amortização constante,
 * parcelas decrescentes (juros incidem sobre o saldo devedor, que cai linearmente), juros
 * totais e total pago. Equivalente a `sacInstallments` de `src/lib/credit.js`, mas retornando
 * a tabela completa de amortização em vez de apenas primeiro/último valor e total.
 */
export function calculateSac(input: { principal: number; monthlyRatePct: number; months: number }): SacResult {
  const principal = assertNonNegative(input.principal, 'principal');
  const monthlyRatePct = assertFiniteNumber(input.monthlyRatePct, 'monthlyRatePct');
  const months = assertPositiveInteger(input.months, 'months');
  const i = percentToFraction(monthlyRatePct);

  const constantAmortization = principal / months;
  const schedule: SacInstallmentRow[] = [];
  let balance = principal;
  let totalPaid = 0;

  for (let period = 1; period <= months; period++) {
    const interest = balance * i;
    const amortization = period === months ? balance : constantAmortization;
    const installment = amortization + interest;
    balance = Math.max(0, roundCurrency(balance - amortization));
    totalPaid += installment;
    schedule.push({
      period,
      installment: roundCurrency(installment),
      interest: roundCurrency(interest),
      amortization: roundCurrency(amortization),
      remainingBalance: balance,
    });
  }

  return {
    principal: roundCurrency(principal),
    monthlyRatePct,
    months,
    constantAmortization: roundCurrency(constantAmortization),
    firstInstallment: schedule[0]?.installment ?? 0,
    lastInstallment: schedule[schedule.length - 1]?.installment ?? 0,
    totalPaid: roundCurrency(totalPaid),
    totalInterest: roundCurrency(totalPaid - principal),
    schedule,
  };
}
