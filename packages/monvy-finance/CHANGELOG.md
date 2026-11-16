# Changelog

Todas as mudanças notáveis deste pacote serão documentadas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto adota
[Semantic Versioning](https://semver.org/lang/pt-BR/).

Durante a série `0.x`, a API pública pode mudar em versões MINOR (ainda não há garantia de
estabilidade total até a versão `1.0.0`). PATCH = correções compatíveis; MINOR = novas
funcionalidades compatíveis; MAJOR = mudanças incompatíveis na API pública.

## [0.1.0] — Não publicado

### Adicionado
- Núcleo financeiro: precisão monetária em centavos inteiros (`src/core/money.ts`), conversão de
  taxas com capitalização composta (`src/core/rates.ts`) e validação de entradas que nunca
  converte valor inválido em zero silenciosamente (`src/core/validation.ts`).
- Juros compostos com aportes periódicos (`simulateCompoundInterest`), extraído de
  `CompoundInterest.jsx`.
- Sistemas de amortização PRICE e SAC (`calculatePrice`, `calculateSac`,
  `compareAmortizationSystems`), extraídos de `src/lib/credit.js` e `PriceSac.jsx`.
- Quitação de dívidas por avalanche e bola de neve (`simulateDebtPayoff`,
  `compareDebtStrategies`), extraído de `DebtPayoff.jsx`.
- Metas financeiras (`calculateRequiredContribution`, `estimateTimeToGoal`,
  `simulateSavingsGoal`), extraído de `GoalPlanner.jsx`.
- Independência financeira / FIRE (`calculateFireTarget`, `simulateFireProjection`), extraído de
  `Fire.jsx`.
- Reserva de emergência (`calculateEmergencyFund`, `projectEmergencyFund`), extraído de
  `EmergencyFund.jsx`.
- Comparação Poupança × renda fixa pós-fixada ao CDI (`compareSavingsVsFixedIncome`), extraído e
  reparametrizado de `SavingsVsCdb.jsx` (sem chamadas à API do Banco Central).
- Divisão de despesas: racha de conta (`splitBill`, de `BillSplit.jsx`) e rateio de casa com
  acerto de contas (`splitExpenses`, `calculateSettlements`, de `HouseholdSplit.jsx`).
- Analytics de fluxo de caixa (`monthlySeries`, `monthTotals`, `categoryBreakdown`,
  `linearRegression`, `forecastNextMonth`, `projectBalance`), extraído de `src/lib/analytics.js`.
- 62 testes unitários (`node:test`) cobrindo casos extremos de cada módulo, executados contra o
  artefato empacotado (`dist/`).
- Workflow de CI/CD (`.github/workflows/publish-monvy-finance.yml`) para validação em PRs e
  publicação no GitHub Packages via tag `monvy-finance-v*`.

### Não incluído nesta versão (ver seção "Pendências" do relatório de entrega)
- Módulos tributários (INSS, IRRF, carga tributária) — `src/lib/tax.js`, `src/lib/taxBurden.js`,
  `src/lib/taxRates.js` contêm tabelas associadas a 2024/2025 que precisam de validação de
  vigência por ano de competência antes de entrar na API pública.
