// Exemplo executável: `node examples/basic.mjs` (depois de `npm run build`).
import {
  simulateCompoundInterest,
  calculatePrice,
  calculateSac,
  compareAmortizationSystems,
  simulateDebtPayoff,
  calculateRequiredContribution,
  calculateFireTarget,
  splitBill,
} from '../dist/index.js';

const investimento = simulateCompoundInterest({
  initialAmount: 10000,
  monthlyContribution: 500,
  annualRate: 12,
  months: 60,
  contributionTiming: 'end',
});
console.log('Juros compostos — saldo final:', investimento.finalBalance);

const financiamento = calculatePrice({ principal: 100000, monthlyRatePct: 1, months: 120 });
console.log('PRICE — parcela:', financiamento.installment, '| juros totais:', financiamento.totalInterest);

const sac = calculateSac({ principal: 100000, monthlyRatePct: 1, months: 120 });
console.log('SAC — 1ª parcela:', sac.firstInstallment, '| última parcela:', sac.lastInstallment);

const comparacao = compareAmortizationSystems({ principal: 100000, monthlyRatePct: 1, months: 120 });
console.log('Diferença de juros (PRICE - SAC):', comparacao.interestDifference);

const quitacao = simulateDebtPayoff({
  strategy: 'avalanche',
  extraPayment: 300,
  debts: [
    { id: 'cartao', name: 'Cartão de crédito', balance: 5000, monthlyRatePct: 8, minimumPayment: 300 },
    { id: 'pessoal', name: 'Empréstimo pessoal', balance: 3000, monthlyRatePct: 3, minimumPayment: 200 },
  ],
});
console.log('Quitação de dívidas — meses até quitar tudo:', quitacao.months);

const meta = calculateRequiredContribution({ targetAmount: 20000, initialAmount: 2000, months: 24, monthlyRatePct: 0.8 });
console.log('Meta — aporte mensal necessário:', meta.requiredMonthlyContribution);

const fire = calculateFireTarget({ monthlyExpense: 5000, multipleOfAnnualExpense: 25 });
console.log('FIRE — patrimônio-alvo:', fire.targetNetWorth);

const conta = splitBill({ totalAmount: 180, tipPct: 10, participantCount: 4 });
console.log('Racha da conta — cada um paga:', conta.sharedAmountPerParticipant);
