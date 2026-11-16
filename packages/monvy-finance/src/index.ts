/**
 * @viniciuskanh/monvy-finance
 *
 * Biblioteca financeira independente, extraída do aplicativo Monvy (React + Vite + Turso).
 * Todas as funções aqui são PURAS: não dependem de React, de banco de dados, de chamadas HTTP
 * nem de `localStorage`. Datas e parâmetros variáveis no tempo são sempre injetados pelo
 * consumidor (nenhuma função lê o relógio do sistema).
 *
 * Veja o README do pacote para documentação completa de cada módulo, convenções monetárias e
 * convenções de taxas.
 */

// ---- Núcleo ----
export * from './core/money.js';
export * from './core/rates.js';
export * from './core/validation.js';

// ---- Investimentos ----
export * from './investments/compoundInterest.js';
export * from './investments/goalPlanner.js';
export * from './investments/fire.js';
export * from './investments/savingsComparison.js';

// ---- Crédito (financiamentos) ----
export * from './credit/price.js';
export * from './credit/sac.js';
export * from './credit/amortization.js';

// ---- Dívidas ----
export * from './debts/debtPayoff.js';

// ---- Planejamento ----
export * from './planning/emergencyFund.js';
export * from './planning/expenseSplit.js';

// ---- Analytics / fluxo de caixa ----
export * from './analytics/cashFlow.js';
