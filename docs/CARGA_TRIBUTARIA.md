# Minha Carga Tributária — documentação técnica

Funcionalidade que mostra, com transparência, quanto o usuário paga (e estima pagar) em tributos por mês e por ano.

## 1. Decisão de arquitetura (leia primeiro)

A especificação sugeria React Native + FastAPI + PostgreSQL. O Monvy **já possui** stack e backend próprios, e a própria spec instrui a *"analisar a estrutura atual, identificar o backend existente e respeitar a arquitetura"*, só criando um backend FastAPI novo *"se o projeto ainda não possuir backend apropriado"*. Como o Monvy já tem backend, a funcionalidade foi **adaptada à stack real**:

| Spec original | Implementado no Monvy |
|---|---|
| React Native | React 18 + Vite + Tailwind (web, JSX) |
| FastAPI (Python) | Vercel serverless (Node) já existente — **sem nova função** (limite de 12 respeitado) |
| PostgreSQL | Turso (libSQL) via `api/_lib/db.js` |
| TypeScript | JSX + JSDoc (convenção do projeto) |
| Backend calcula tudo | Motor puro client-side (`src/lib/taxBurden.js`) + dados reais do Monvy |

Todo o cálculo tributário roda no dispositivo, reutilizando o motor de IRRF já existente (`src/lib/tax.js`) e os lançamentos reais do usuário.

## 2. Regra de ouro do produto

**Não se descobre a carga tributária de uma pessoa apenas consultando o CPF.** O CPF é usado só como identificador (e nunca exibido por inteiro). Cada valor é classificado por status:

- **Confirmado** (`confirmed`) — sustentado por uma fonte: INSS/IRRF do holerite informado, IOF lançado, IPVA/IPTU cadastrado.
- **Estimado** (`estimated`) — média/tabela (consumo padrão IBPT). **Nunca** apresentado como efetivamente recolhido.
- **Informado** (`manual`) — digitado pelo usuário (IPVA/IPTU anual mensalizado).

Sem dado, a categoria fica **indisponível** (valor 0, não entra na soma). Não inventamos tributos para "encher" a tela.

## 3. Arquivos criados / modificados

**Criados**
- `src/lib/taxRates.js` — tabelas escopadas por ano com `fonte` declarada: INSS 2025 (progressiva), ponteiro do IRRF, buckets de consumo padrão IBPT, referência de IOF, enums `STATUS`/`SOURCE`.
- `src/lib/taxBurden.js` — motor puro: `calcInss`, `calcIrrf` (reusa `tax.js`), `estimateConsumo`, `mensalizar`, `buildTaxRecords`, `aggregate`, `explain`, e providers `MockOpenFinanceProvider` / `DefaultTaxEstimateProvider`.
- `src/pages/TaxBurden.jsx` — tela completa (ver §5).
- `docs/CARGA_TRIBUTARIA.md` — este documento.

**Modificados**
- `api/_lib/schema.js` — coluna `cpf` em `users` + migração `017_users_cpf`.
- `api/_handlers/auth_profile.js` — aceita `cpf` (guarda só dígitos), retorna `cpf_masked`/`cpf_set`. Nunca loga o CPF.
- `api/_handlers/auth_me.js` — retorna `cpf_masked`/`cpf_set`.
- `src/pages/Settings.jsx` — campo CPF no perfil (mascarado; nunca pré-preenchido com o valor real).
- `src/App.jsx` — rota `/carga-tributaria` (`screenKey="taxburden"`).
- `src/lib/screens.js` — item de menu no grupo *Inteligência IA*.
- `scripts/test.mjs` — 21 asserções do motor (INSS progressivo e teto, fronteiras de faixa, IRRF isento/positivo, soma dos componentes = total, percentual, dias equivalentes, mensalização, classificação, "sem salário não inventa").

## 4. Métricas

- `totalConfirmado`, `totalEstimado`, `totalManual`
- `totalCarga = confirmado + estimado + IPVA_mensalizado + IPTU_mensalizado`
- `percentualCarga = totalCarga / rendaBruta × 100`
- `diasEquivalentes = 365 × percentualCarga / 100` — apresentado como *"equivale a aproximadamente N dias de trabalho"*, com tooltip explicando que é **equivalência financeira**, não pagamento diário literal.

Garantia testada: **soma dos componentes exibidos = total apresentado**, e os gráficos usam exatamente os mesmos valores dos cards.

## 5. Tela

Cabeçalho (mês, renda bruta, CPF mascarado) · card principal só quando há dado suficiente (senão *"Carga conhecida até agora… ainda existem categorias sem dados"*) · cards por categoria (INSS, IRRF, Consumo, IOF, IPVA, IPTU) com indicador visual de status · gráfico de distribuição (pizza) + histórico de 6 meses (barras confirmado/estimado) · *Ver detalhes* (RENDA / DIRETOS / CONSUMO / PATRIMÔNIO) · *Como calculamos este valor?* por card (fonte, data, base, regra, confirmado/estimado) · *Fontes conectadas* (Open Finance / Receita-SERPRO / Folha / IBPT) com conectar/revogar. Entradas manuais (salário, holerite, IPVA/IPTU) em *Meus dados*, persistidas em `localStorage` (`monvy:taxBurden:v1`).

## 6. O que é consultado vs. estimado

| Categoria | Origem | Status |
|---|---|---|
| INSS | Tabela oficial 2025 (ou holerite) | estimado / **confirmado** |
| IRRF | `tax.js` (ou holerite); pode ser R$ 0,00 | estimado / **confirmado** |
| Consumo | Despesas reais do Monvy × médias IBPT | **estimado** |
| IOF | Só se houver lançamento identificado | confirmado |
| IPVA / IPTU | Entrada manual, mensalizada ÷ 12 | manual |

## 7. Integrações — reais vs. simuladas

- **Open Finance Brasil** — interface `MockOpenFinanceProvider` (não conecta a banco com usuário/senha). Um provider real deve implementar `isConnected/connect/disconnect/fetchTaxRelevantData`, entrar em uso só após consentimento explícito e permitir revogação. **Requer**: participação regulada, certificado, fluxo de consentimento — não implementado.
- **Receita Federal / SERPRO** (Integra Contador, Compartilha RFB) — **requer contrato, certificado digital e custo**. Documentado como fonte, não conectado.
- **IBPT** — `DefaultTaxEstimateProvider` usa médias de referência em `taxRates.js`; substituir pela tabela oficial (CSV/JSON por NCM/estado) quando disponível.

Nenhuma integração faz scraping de portal protegido, quebra de CAPTCHA ou uso de API não autorizada.

## 8. Segurança / LGPD

CPF armazenado só em dígitos, exibido apenas mascarado (`***.***.***-42`), nunca logado, nunca pré-preenchido na UI. Cálculo no dispositivo (nenhum dado tributário sai do navegador). Consentimento explícito e revogável para qualquer fonte externa. Sem armazenamento de credenciais bancárias ou senha do gov.br.

## 9. Configuração (.env)

Nenhuma variável nova é necessária para a versão atual (tudo client-side + Turso já configurado). Integrações futuras exigiriam, por exemplo: `SERPRO_CLIENT_ID/SECRET`, caminho do certificado, e credenciais de participante Open Finance — **fora do frontend**, apenas no backend.

## 10. Como rodar / validar

```bash
npm test          # 26 asserções (5 do analytics + 21 do motor tributário) — todas passam
npm run build     # build de produção (Vite) — rode no ambiente de deploy
```

Migração `017_users_cpf` roda automaticamente no `ensureSchema()` (idempotente).

## 11. Limitações e próximos passos

- Tabela INSS: só 2025 populada; anos futuros herdam a mais recente (o motor expõe o ano usado). Adicionar 2026 quando publicada.
- Consumo: percentuais são médias aproximadas — trocar pela tabela IBPT oficial por NCM/estado eleva a precisão.
- IOF: só contabilizado se houver lançamento marcado; um marcador de "compra internacional" no lançamento habilitaria cálculo automático.
- Integrações Open Finance/SERPRO ficam como mock até contrato/certificado.
- Próximo: escanear nota fiscal (QR) no app mobile para extrair tributos legalmente acessíveis; histórico persistido por mês no backend, se desejado.
