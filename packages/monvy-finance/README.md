<div align="center">

# Monvy Finance — Financial Calculation Toolkit for JavaScript & TypeScript

**`@viniciuskanh/monvy-finance`** — o motor de cálculo financeiro do [Monvy](https://github.com/ViniciusKanh/Monvy), extraído em uma biblioteca independente, tipada e testada.

![npm](https://img.shields.io/badge/package-%40viniciuskanh%2Fmonvy--finance-6366f1)
![version](https://img.shields.io/badge/version-0.1.0-10b981)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Node](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)
![Registry](https://img.shields.io/badge/registry-GitHub%20Packages-181717?logo=github)

</div>

---

## Índice

1. [Identidade do pacote](#1-identidade-do-pacote)
2. [Descrição técnica](#2-descrição-técnica)
3. [Casos de uso](#3-casos-de-uso)
4. [Arquitetura](#4-arquitetura)
5. [Funcionalidades](#5-funcionalidades)
6. [Instalação pelo GitHub Packages](#6-instalação-pelo-github-packages)
7. [Configuração do `.npmrc`](#7-configuração-do-npmrc)
8. [Exemplos JavaScript](#8-exemplos-javascript)
9. [Exemplos TypeScript](#9-exemplos-typescript)
10. [Juros compostos](#10-juros-compostos)
11. [PRICE e SAC](#11-price-e-sac)
12. [Quitação de dívidas](#12-quitação-de-dívidas)
13. [Metas financeiras](#13-metas-financeiras)
14. [Reserva de emergência](#14-reserva-de-emergência)
15. [FIRE](#15-fire-independência-financeira)
16. [Comparações de investimentos](#16-comparações-de-investimentos)
17. [Fluxo de caixa](#17-fluxo-de-caixa)
18. [Divisão de despesas](#18-divisão-de-despesas)
19. [Convenções monetárias](#19-convenções-monetárias)
20. [Conversão de taxas](#20-conversão-de-taxas)
21. [Limitações matemáticas e financeiras](#21-limitações-matemáticas-e-financeiras)
22. [Referência da API pública](#22-referência-da-api-pública)
23. [Desenvolvimento local](#23-desenvolvimento-local)
24. [Testes](#24-testes)
25. [Versionamento](#25-versionamento)
26. [Publicação](#26-publicação)
27. [Contribuições](#27-contribuições)
28. [Licença e autoria](#28-licença-e-autoria)

---

## 1. Identidade do pacote

| | |
|---|---|
| **Nome** | `@viniciuskanh/monvy-finance` |
| **Nome de apresentação** | Monvy Finance |
| **Repositório de origem** | [ViniciusKanh/Monvy](https://github.com/ViniciusKanh/Monvy) (`packages/monvy-finance`) |
| **Versão inicial** | `0.1.0` |
| **Linguagem** | TypeScript (compilado para ESM + `.d.ts`) |
| **Registro** | GitHub Packages (`https://npm.pkg.github.com`) |
| **Execução** | Node.js ≥ 18 e navegadores modernos (sem dependências de DOM, React ou `localStorage`) |
| **Custo operacional** | Nenhum — pacote 100% client-side/server-side puro, sem serviços externos |

## 2. Descrição técnica

O Monvy Finance reúne, em módulos independentes e tipados, as rotinas de matemática financeira
que já existem (e estão em produção) no aplicativo Monvy: juros compostos, financiamentos (PRICE
e SAC), quitação de dívidas, metas financeiras, FIRE, reserva de emergência, comparação de
investimentos de renda fixa e divisão de despesas, além de um motor simples de análise de fluxo
de caixa. Todas as funções são **puras**: recebem os dados como parâmetros e devolvem resultados
determinísticos, sem acessar React, banco de dados, APIs externas ou `localStorage`.

## 3. Casos de uso

- Embutir simuladores financeiros (juros compostos, financiamento, metas) em outro produto, sem
  precisar rodar o aplicativo Monvy inteiro.
- Rodar simulações no backend (Node.js) para gerar relatórios, notificações ou validações.
- Testar hipóteses financeiras em scripts ou notebooks, sem UI.
- Reaproveitar a mesma lógica de cálculo entre o app Monvy e outros projetos do autor, com uma
  única fonte de verdade testada.

## 4. Arquitetura

```
packages/monvy-finance/
├── src/
│   ├── index.ts                 # ponto de entrada público (reexporta todos os módulos)
│   ├── core/                    # precisão monetária, conversão de taxas, validação
│   │   ├── money.ts
│   │   ├── rates.ts
│   │   └── validation.ts
│   ├── investments/              # juros compostos, metas, FIRE, poupança x CDB
│   │   ├── compoundInterest.ts
│   │   ├── goalPlanner.ts
│   │   ├── fire.ts
│   │   └── savingsComparison.ts
│   ├── credit/                   # financiamentos PRICE e SAC
│   │   ├── price.ts
│   │   ├── sac.ts
│   │   └── amortization.ts
│   ├── debts/
│   │   └── debtPayoff.ts         # avalanche e bola de neve
│   ├── planning/
│   │   ├── emergencyFund.ts
│   │   └── expenseSplit.ts       # racha de conta e rateio de casa
│   └── analytics/
│       └── cashFlow.ts           # séries mensais, regressão, previsão, projeção de saldo
├── tests/                        # testes `node:test`, rodam contra o artefato empacotado (dist/)
├── examples/                     # exemplos executáveis de consumo da API publicada
├── dist/                         # gerado pelo build (tsup) — ESM + .d.ts
├── package.json
├── tsconfig.json
├── README.md
└── CHANGELOG.md
```

Nenhum arquivo `.jsx`, hook do React ou entidade persistida do Monvy é importado aqui — a
biblioteca só depende de código matemático puro e do TypeScript/Node padrão.

## 5. Funcionalidades

- **Investimentos**: juros compostos com aportes (início ou fim do mês), metas financeiras
  (quanto aportar / em quanto tempo), FIRE (independência financeira), poupança × CDB/renda fixa.
- **Crédito**: financiamento PRICE (parcela fixa) e SAC (amortização constante), com tabela de
  amortização completa e comparação objetiva entre os dois sistemas.
- **Dívidas**: estratégias de quitação avalanche e bola de neve, com simulação mês a mês.
- **Planejamento**: reserva de emergência (meta configurável) e divisão de despesas (conta de
  restaurante, rateio de casa com acerto de contas).
- **Analytics**: séries mensais de receita/despesa, totais do mês, breakdown por categoria,
  regressão linear, previsão do próximo mês (estimativa, não garantia) e projeção de saldo.

## 6. Instalação pelo GitHub Packages

```bash
npm install @viniciuskanh/monvy-finance
```

O pacote é publicado em `https://npm.pkg.github.com`, então seu projeto consumidor precisa de um
`.npmrc` apontando o escopo `@viniciuskanh` para esse registro (veja a seção seguinte) e de
autenticação (um token do GitHub com permissão `read:packages`, configurado em `~/.npmrc` ou em
variável de ambiente `NODE_AUTH_TOKEN`, conforme a [documentação oficial do GitHub Packages](https://docs.github.com/pt/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)).

## 7. Configuração do `.npmrc`

No projeto consumidor, crie (ou edite) o arquivo `.npmrc` na raiz:

```ini
@viniciuskanh:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

## 8. Exemplos JavaScript

```js
import {
  simulateCompoundInterest,
  calculatePrice,
  calculateSac,
  simulateDebtPayoff,
} from '@viniciuskanh/monvy-finance';

const investimento = simulateCompoundInterest({
  initialAmount: 10000,
  monthlyContribution: 500,
  annualRate: 12,
  months: 60,
  contributionTiming: 'end',
});

const financiamento = calculatePrice({
  principal: 100000,
  monthlyRatePct: 1,
  months: 120,
});

console.log(investimento.finalBalance, financiamento.installment);
```

## 9. Exemplos TypeScript

```ts
import {
  simulateCompoundInterest,
  type CompoundInterestResult,
  calculateRequiredContribution,
} from '@viniciuskanh/monvy-finance';

const resultado: CompoundInterestResult = simulateCompoundInterest({
  initialAmount: 1000,
  monthlyContribution: 300,
  annualRate: 10,
  months: 24,
});

const aporte = calculateRequiredContribution({
  targetAmount: 20000,
  initialAmount: 2000,
  months: 24,
  monthlyRatePct: 0.8,
});
```

## 10. Juros compostos

```ts
simulateCompoundInterest({ initialAmount, monthlyContribution, annualRate, months, contributionTiming? })
```

- Convenção padrão: aporte no **fim** do mês (`contributionTiming: 'end'`), igual ao
  comportamento original de `CompoundInterest.jsx`.
- Retorna capital inicial, aporte, total aportado, juros acumulados, saldo final, taxa mensal
  efetiva, taxa anual informada e a série mês a mês.
- Casos extremos tratados sem lançar erro: taxa zero, prazo zero, aporte zero, capital inicial
  zero e taxas negativas matematicamente válidas (> -100%).

## 11. PRICE e SAC

```ts
calculatePrice({ principal, monthlyRatePct, months })
calculateSac({ principal, monthlyRatePct, months })
compareAmortizationSystems({ principal, monthlyRatePct, months, extraCosts? })
```

Ambas retornam a tabela completa de amortização (parcela, juros, amortização e saldo devedor por
período), juros totais e total pago. `compareAmortizationSystems` compara os dois sistemas lado a
lado **sem declarar um vencedor universal** — o SAC tende a pagar menos juros totais, mas o
Price tem parcela fixa; CET, seguros e tarifas só entram na conta se informados em `extraCosts`.

## 12. Quitação de dívidas

```ts
simulateDebtPayoff({ debts, strategy: 'avalanche' | 'snowball', extraPayment? })
compareDebtStrategies({ debts, extraPayment? })
```

Cada dívida é identificada por `id` (nunca pelo nome — nomes podem se repetir). O simulador tem um
limite de 600 meses para evitar loop infinito e sinaliza em `debtsWithInsufficientMinimumPayment`
quando o pagamento mínimo informado nem cobre os juros do mês, em vez de produzir uma projeção de
quitação enganosa.

## 13. Metas financeiras

```ts
calculateRequiredContribution({ targetAmount, initialAmount, months, monthlyRatePct })
estimateTimeToGoal({ targetAmount, initialAmount, monthlyContribution, monthlyRatePct })
simulateSavingsGoal({ targetAmount, initialAmount, monthlyContribution, monthlyRatePct, months })
```

Metas já atingidas retornam `alreadyReached: true` e aporte/tempo zero; metas matematicamente
inalcançáveis (sem aporte e sem rendimento suficiente) retornam `months: null` em vez de um
número arbitrário.

## 14. Reserva de emergência

```ts
calculateEmergencyFund({ averageMonthlyExpense, currentReserve, targetMonths })
projectEmergencyFund({ averageMonthlyExpense, currentReserve, targetMonths, monthlyContribution })
```

`targetMonths` é um **parâmetro configurável** — a biblioteca não embute uma regra fixa de "3 a 6
meses" como se fosse uma verdade universal.

## 15. FIRE (independência financeira)

```ts
calculateFireTarget({ monthlyExpense, multipleOfAnnualExpense })
simulateFireProjection({ currentNetWorth, monthlyContribution, monthlyExpense, annualReturnRatePct, multipleOfAnnualExpense })
withdrawalRateToMultiple(withdrawalRatePct) // ex.: 4 -> 25x (regra dos 4%)
```

A projeção é **determinística**, não uma previsão de mercado. O módulo não mistura taxa nominal
com taxa real automaticamente — recomenda-se informar `annualReturnRatePct` já como retorno real
(acima da inflação), documentando essa escolha no seu próprio produto.

## 16. Comparações de investimentos

```ts
compareSavingsVsFixedIncome({ initialAmount, months, selicAnnualPct, cdiAnnualPct, percentOfCdi, irBrackets?, savingsRule?, daysPerMonth? })
```

Todas as taxas (Selic, CDI, regra da poupança, alíquotas de IR) são **parâmetros explícitos** —
a função não chama a API do Banco Central nem embute uma taxa de mercado "atual". A tabela de IR
regressivo padrão (`DEFAULT_FIXED_INCOME_IR_BRACKETS`) reflete a estrutura de faixas da
legislação de renda fixa, sobrescrevível via `irBrackets`.

## 17. Fluxo de caixa

```ts
monthlySeries(transactions, monthKeys)
monthTotals(transactions, monthKey)
categoryBreakdown(transactions, type, monthKey?)
linearRegression(ys)
forecastNextMonth(transactions, monthKeys)
projectBalance(startBalance, monthlyNet, months, extraDelta?)
```

Nenhuma dessas funções acessa banco de dados — os lançamentos são sempre passados como parâmetro.
`forecastNextMonth` sinaliza explicitamente `isEstimate: true` e devolve `sampleSize`, para que o
consumidor possa avaliar a confiabilidade da estimativa (ver limitações na seção 21).

## 18. Divisão de despesas

```ts
splitBill({ totalAmount, tipPct?, participantCount, individualItems? })
splitExpenses({ participants, expenses, mode: 'equal' | 'income' })
calculateSettlements(balances)
```

A soma das parcelas sempre fecha exatamente com o total (ver política de centavos na seção 19).
Participantes são identificados por `id`, nunca por nome.

## 19. Convenções monetárias

- Todas as funções operam com `number` (double de 64 bits) internamente, igual ao código-fonte
  original do Monvy.
- Arredondamento só acontece na **fronteira de saída** (`roundCurrency`), nunca em cada passo
  intermediário de um cálculo iterativo (ex.: juros compostos mês a mês).
- Quando a soma de partes precisa fechar exatamente com um total (divisão de contas, SAC), o
  pacote usa **centavos inteiros** (`toCents`/`fromCents`/`distributeCents`/`splitExact`) e
  distribui o resíduo de forma determinística, em vez de `toFixed(2)` por parcela.
- Nenhuma função lê o relógio do sistema: datas e parâmetros variáveis no tempo são sempre
  injetados pelo consumidor.

## 20. Conversão de taxas

- "Percentual" (`Pct`, ex.: 12 = 12%) vs. "fração decimal" (`Fraction`, ex.: 0.12).
- Conversão anual ↔ mensal sempre por **capitalização composta** — nunca divisão/multiplicação
  simples por 12: `annualToMonthly`, `monthlyToAnnual`, `toMonthlyRate`.
- Composição de taxas (ex.: juros + indexador) via `composeRates`/`effectiveMonthlyRate`:
  `(1+a)(1+b) - 1`, nunca soma simples.

## 21. Limitações matemáticas e financeiras

- `linearRegression`/`forecastNextMonth` são uma regressão OLS simples sobre poucos pontos, sem
  intervalo de confiança, sem tratamento de sazonalidade e sensível a mudanças estruturais na
  série (ex.: o usuário trocou de emprego, teve um gasto único grande). Trate como estimativa.
- As simulações de FIRE, metas e juros compostos são **determinísticas**: aplicam uma taxa
  constante informada pelo consumidor. Elas não preveem o comportamento real do mercado
  financeiro nem constituem recomendação de investimento individualizada.
- `compareSavingsVsFixedIncome` simula regras simplificadas e parametrizáveis da poupança e do IR
  regressivo — não substitui o extrato oficial de uma instituição financeira nem contempla IOF,
  taxas de administração ou outras particularidades contratuais.
- O pacote **não inclui** módulos de cálculo de INSS/IRRF/carga tributária nesta versão (ver
  seção de limitações no CHANGELOG) — as tabelas existentes no app Monvy (`src/lib/taxRates.js`)
  têm vigência associada a anos específicos (2024/2025) e precisam de validação adicional antes
  de entrarem na API pública.

## 22. Referência da API pública

| Módulo | Principais exports |
|---|---|
| `core/money` | `roundCurrency`, `toCents`, `fromCents`, `distributeCents`, `splitExact`, `sumCurrency` |
| `core/rates` | `percentToFraction`, `fractionToPercent`, `annualToMonthly`, `monthlyToAnnual`, `toMonthlyRate`, `composeRates`, `effectiveMonthlyRate` |
| `core/validation` | `FinanceValidationError`, `assertFiniteNumber`, `assertNonNegative`, `assertPositive`, `assertInteger`, `assertPositiveInteger`, `assertValidRateFraction`, `assertNonEmptyArray` |
| `investments/compoundInterest` | `simulateCompoundInterest` |
| `investments/goalPlanner` | `calculateRequiredContribution`, `estimateTimeToGoal`, `simulateSavingsGoal` |
| `investments/fire` | `calculateFireTarget`, `simulateFireProjection`, `withdrawalRateToMultiple` |
| `investments/savingsComparison` | `compareSavingsVsFixedIncome`, `fixedIncomeIrRate`, `savingsMonthlyRatePct` |
| `credit/price` | `calculatePrice`, `priceInstallmentAmount` |
| `credit/sac` | `calculateSac` |
| `credit/amortization` | `compareAmortizationSystems` |
| `debts/debtPayoff` | `simulateDebtPayoff`, `compareDebtStrategies` |
| `planning/emergencyFund` | `calculateEmergencyFund`, `projectEmergencyFund` |
| `planning/expenseSplit` | `splitBill`, `splitExpenses`, `calculateSettlements` |
| `analytics/cashFlow` | `monthlySeries`, `monthTotals`, `categoryBreakdown`, `linearRegression`, `forecastNextMonth`, `projectBalance`, `lastMonthKeys` |

Todos os tipos de entrada/saída (ex.: `CompoundInterestInput`, `DebtPayoffResult`) são exportados
junto com as funções — o editor oferece IntelliSense completo a partir de `dist/index.d.ts`.

## 23. Desenvolvimento local

```bash
cd packages/monvy-finance
npm install
npm run typecheck   # tsc --noEmit
npm run build       # tsup -> dist/ (ESM + .d.ts)
npm test            # build + node --test tests/*.test.mjs (roda contra dist/)
npm run pack:check  # npm pack --dry-run — audita o conteúdo do tarball
```

## 24. Testes

62 testes (`node:test`, nativo do Node ≥ 18) cobrem: juros compostos (taxa zero, aporte zero,
prazo zero, aporte no início/fim do mês, taxas negativas válidas, longo prazo), PRICE/SAC
(incluindo o caso de referência de R$1.200,00 a 0% em 12 meses = parcelas de R$100,00), dívidas
(avalanche, snowball, ids duplicados, pagamento mínimo insuficiente, limite de iterações), metas e
FIRE (meta já atingida, meta impossível), divisão de despesas (soma exata, centavos residuais,
rendas iguais/diferentes) e precisão monetária (casos clássicos de arredondamento de ponto
flutuante, com valores de referência calculados independentemente do código testado).

Os testes rodam contra `dist/` (o artefato efetivamente empacotado), não contra os arquivos-fonte
em `src/`, conforme exigido no processo de aceite da biblioteca.

## 25. Versionamento

[Semantic Versioning](https://semver.org/lang/pt-BR/): PATCH para correções compatíveis, MINOR
para novas funcionalidades compatíveis, MAJOR para mudanças incompatíveis na API pública. Durante
a série `0.x`, a API pode mudar em versões MINOR — ver [CHANGELOG.md](./CHANGELOG.md). O
versionamento deste pacote é **independente** do versionamento do aplicativo Monvy.

## 26. Publicação

A publicação no GitHub Packages acontece via o workflow
[`.github/workflows/publish-monvy-finance.yml`](../../.github/workflows/publish-monvy-finance.yml),
disparado por uma tag no padrão `monvy-finance-v0.1.0` (namespace próprio, para não colidir com
tags do aplicativo). **A primeira publicação depende de autorização humana explícita** — este
workflow nunca publica automaticamente a cada commit na `main`. Veja o relatório de entrega para
o passo a passo de autorização.

## 27. Contribuições

Este pacote vive dentro do monorepo do [Monvy](https://github.com/ViniciusKanh/Monvy). Para
contribuir: abra um branch a partir de `packages/monvy-finance`, rode `npm test` e
`npm run typecheck` antes de abrir um PR, e descreva no PR qual fórmula/comportamento está sendo
alterado e por quê (ver `CHANGELOG.md`).

## 28. Licença e autoria

Autor: Vinicius Santos ([@ViniciusKanh](https://github.com/ViniciusKanh)).

O `package.json` deste pacote declara `"license": "MIT"`, espelhando o badge de licença MIT já
publicado no README principal do Monvy. **Não existe, porém, um arquivo `LICENSE` formal neste
repositório** — este README não substitui essa verificação. Antes da primeira publicação pública,
confirme com o proprietário do repositório se a licença MIT é de fato a pretendida e adicione o
arquivo `LICENSE` correspondente (ver item "Pendências" do relatório de entrega).
