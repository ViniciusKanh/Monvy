// Motor da "Minha Carga Tributaria".
//
// Funcoes PURAS (sem DOM, sem rede) para poderem ser testadas por scripts/test.mjs.
// A UI (TaxBurden.jsx) apenas coleta entradas e exibe — todo o calculo tributario
// mora aqui. Regra de ouro do produto:
//   - "confirmed": valor sustentado por uma fonte (holerite/INSS descontado, IOF
//                  lancado, IPVA/IPTU cadastrado pelo usuario).
//   - "estimated": media/tabela (consumo IBPT). NUNCA apresentar como recolhido.
//   - "manual":    informado a mao pelo usuario (ex.: IPVA/IPTU anual).
// Nao inventamos tributos para "encher" a tela: sem dado, a categoria fica
// "indisponivel" (amount 0, available:false).

import { DEFAULT_TAX, calcMensal } from './tax.js';
import {
  getInssTabela, CONSUMO_BUCKETS, IOF_INFO, STATUS, SOURCE, IRRF_INFO,
} from './taxRates.js';

const n = (v) => { const x = Number(v); return isNaN(x) ? 0 : x; };
const round2 = (v) => Math.round(n(v) * 100) / 100;

// ---------------------------------------------------------------------------
// INSS progressivo (por faixa) — retorna valor e aliquota efetiva.
// ---------------------------------------------------------------------------
export function calcInss(bruto, ano = 2025) {
  bruto = Math.max(0, n(bruto));
  const tabela = getInssTabela(ano);
  let inss = 0, anterior = 0;
  for (const f of tabela.faixas) {
    if (bruto > f.ate) {
      inss += (f.ate - anterior) * f.aliq;
      anterior = f.ate;
    } else {
      inss += (bruto - anterior) * f.aliq;
      anterior = bruto;
      break;
    }
  }
  if (bruto > tabela.teto) inss = tabela.faixas.reduce((s, f, i) => {
    const ini = i === 0 ? 0 : tabela.faixas[i - 1].ate;
    return s + (f.ate - ini) * f.aliq;
  }, 0);
  inss = round2(inss);
  return {
    valor: inss,
    base: bruto,
    aliquotaEfetiva: bruto > 0 ? round2((inss / bruto) * 100) : 0,
    ano: tabela.ano,
    fonte: tabela.fonte,
  };
}

// ---------------------------------------------------------------------------
// IRRF mensal — reusa o motor existente (src/lib/tax.js).
// base = bruto - INSS - dependentes*deducao - outras deducoes.
// ---------------------------------------------------------------------------
export function calcIrrf({ bruto, inss, dependentes = 0, deducoes = 0 }, cfg = DEFAULT_TAX) {
  const r = calcMensal({ rendimento: bruto, inss, dependentes, despesas: deducoes }, cfg);
  return {
    valor: round2(r.imposto),
    base: round2(r.base),
    aliquota: r.aliq,
    aliquotaEfetiva: round2(r.aliquotaEfetiva),
    fonte: IRRF_INFO.fonte,
  };
}

// ---------------------------------------------------------------------------
// Classificacao de um gasto num bucket de consumo (por categoria/descricao).
// ---------------------------------------------------------------------------
export function classificarBucket(texto) {
  const t = String(texto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  for (const [chave, cfg] of Object.entries(CONSUMO_BUCKETS.buckets)) {
    if (chave === 'outros') continue;
    if (cfg.palavras.some((p) => t.includes(p))) return chave;
  }
  return 'outros';
}

// ---------------------------------------------------------------------------
// Estimativa de tributos sobre consumo a partir de despesas REAIS do mes.
// Recebe uma lista de gastos { valor, categoria|descricao } (valores positivos).
// Devolve total estimado + detalhamento por bucket, com metadados de fonte.
// ---------------------------------------------------------------------------
export function estimateConsumo(gastos = []) {
  const acc = {};
  let totalGasto = 0, totalTributo = 0;
  for (const g of gastos) {
    const valor = Math.max(0, n(g.valor ?? g.amount));
    if (valor <= 0) continue;
    const chave = g.bucket || classificarBucket(g.categoria || g.category || g.descricao || g.description);
    const cfg = CONSUMO_BUCKETS.buckets[chave] || CONSUMO_BUCKETS.buckets.outros;
    const tributo = round2(valor * cfg.percentualMedio);
    if (!acc[chave]) acc[chave] = { chave, label: cfg.label, percentual: cfg.percentualMedio, gasto: 0, tributo: 0 };
    acc[chave].gasto = round2(acc[chave].gasto + valor);
    acc[chave].tributo = round2(acc[chave].tributo + tributo);
    totalGasto = round2(totalGasto + valor);
    totalTributo = round2(totalTributo + tributo);
  }
  return {
    total: totalTributo,
    totalGasto,
    percentualMedio: totalGasto > 0 ? round2((totalTributo / totalGasto) * 100) : 0,
    itens: Object.values(acc).sort((a, b) => b.tributo - a.tributo),
    fonte: CONSUMO_BUCKETS.fonte,
    tipo: 'estimado',
  };
}

// ---------------------------------------------------------------------------
// Mensalizacao de tributo anual (IPVA/IPTU): equivalencia analitica (anual/12).
// NAO representa necessariamente a parcela paga naquele mes.
// ---------------------------------------------------------------------------
export function mensalizar(valorAnual) {
  return round2(Math.max(0, n(valorAnual)) / 12);
}

// ---------------------------------------------------------------------------
// Monta os TaxRecord de um mes a partir das entradas disponiveis.
// entrada = {
//   ano, mes, salarioBruto, dependentes, deducoes,
//   inssConfirmado, irrfConfirmado,  // valores do holerite (se houver) -> confirmed
//   gastos: [{valor, categoria|descricao}],       // p/ consumo estimado
//   iofLancado,                                     // IOF identificado -> confirmed
//   ipvaAnual, iptuAnual,                           // manual
//   lastUpdatedAt,
// }
// ---------------------------------------------------------------------------
export function buildTaxRecords(entrada = {}) {
  const ano = entrada.ano || new Date().getFullYear();
  const mes = entrada.mes || (new Date().getMonth() + 1);
  const ref = `${ano}-${String(mes).padStart(2, '0')}`;
  const at = entrada.lastUpdatedAt || new Date().toISOString();
  const bruto = n(entrada.salarioBruto);
  const temSalario = bruto > 0;
  const records = [];

  // --- INSS ---
  if (temSalario) {
    const inssCalc = calcInss(bruto, ano);
    const confirmado = entrada.inssConfirmado != null && entrada.inssConfirmado !== '';
    const valor = confirmado ? round2(n(entrada.inssConfirmado)) : inssCalc.valor;
    records.push({
      id: `inss-${ref}`, key: 'inss', name: 'INSS', amount: valor, referenceMonth: ref,
      source: confirmado ? SOURCE.payroll : SOURCE.calculated,
      status: confirmado ? STATUS.confirmed : STATUS.estimated,
      available: true, lastUpdatedAt: at,
      meta: { base: inssCalc.base, aliquotaEfetiva: inssCalc.aliquotaEfetiva, ano: inssCalc.ano, fonte: inssCalc.fonte },
    });
  } else {
    records.push({ id: `inss-${ref}`, key: 'inss', name: 'INSS', amount: 0, referenceMonth: ref, source: SOURCE.calculated, status: STATUS.estimated, available: false, lastUpdatedAt: at, meta: { fonte: 'Sem salario informado' } });
  }

  // --- IRRF --- (sempre mostra categoria; pode ser R$ 0,00)
  if (temSalario) {
    const inssParaIrrf = (entrada.inssConfirmado != null && entrada.inssConfirmado !== '')
      ? n(entrada.inssConfirmado) : calcInss(bruto, ano).valor;
    const confirmado = entrada.irrfConfirmado != null && entrada.irrfConfirmado !== '';
    const irrfCalc = calcIrrf({ bruto, inss: inssParaIrrf, dependentes: entrada.dependentes, deducoes: entrada.deducoes });
    const valor = confirmado ? round2(n(entrada.irrfConfirmado)) : irrfCalc.valor;
    records.push({
      id: `irrf-${ref}`, key: 'irrf', name: 'IRRF', amount: valor, referenceMonth: ref,
      source: confirmado ? SOURCE.payroll : SOURCE.calculated,
      status: confirmado ? STATUS.confirmed : STATUS.estimated,
      available: true, lastUpdatedAt: at,
      meta: { base: irrfCalc.base, aliquota: irrfCalc.aliquota, aliquotaEfetiva: irrfCalc.aliquotaEfetiva, fonte: irrfCalc.fonte, isento: valor <= 0 },
    });
  } else {
    records.push({ id: `irrf-${ref}`, key: 'irrf', name: 'IRRF', amount: 0, referenceMonth: ref, source: SOURCE.calculated, status: STATUS.estimated, available: false, lastUpdatedAt: at, meta: { fonte: 'Sem salario informado' } });
  }

  // --- Consumo (estimado) ---
  const gastos = entrada.gastos || [];
  if (gastos.length) {
    const c = estimateConsumo(gastos);
    records.push({
      id: `consumo-${ref}`, key: 'consumo', name: 'Tributos sobre consumo', amount: c.total, referenceMonth: ref,
      source: SOURCE.ibpt, status: STATUS.estimated, available: true, lastUpdatedAt: at,
      meta: { totalGasto: c.totalGasto, percentualMedio: c.percentualMedio, itens: c.itens, fonte: c.fonte },
    });
  } else {
    records.push({ id: `consumo-${ref}`, key: 'consumo', name: 'Tributos sobre consumo', amount: 0, referenceMonth: ref, source: SOURCE.ibpt, status: STATUS.estimated, available: false, lastUpdatedAt: at, meta: { fonte: CONSUMO_BUCKETS.fonte } });
  }

  // --- IOF (so se identificado) ---
  const iof = n(entrada.iofLancado);
  records.push(iof > 0
    ? { id: `iof-${ref}`, key: 'iof', name: 'IOF', amount: round2(iof), referenceMonth: ref, source: SOURCE.calculated, status: STATUS.confirmed, available: true, lastUpdatedAt: at, meta: { fonte: IOF_INFO.fonte } }
    : { id: `iof-${ref}`, key: 'iof', name: 'IOF', amount: 0, referenceMonth: ref, source: SOURCE.calculated, status: STATUS.confirmed, available: false, lastUpdatedAt: at, meta: { fonte: IOF_INFO.fonte } });

  // --- IPVA (manual, mensalizado) ---
  const ipvaAnual = n(entrada.ipvaAnual);
  records.push(ipvaAnual > 0
    ? { id: `ipva-${ref}`, key: 'ipva', name: 'IPVA', amount: mensalizar(ipvaAnual), referenceMonth: ref, source: SOURCE.manual, status: STATUS.manual, available: true, lastUpdatedAt: at, meta: { anual: round2(ipvaAnual), mensalizado: true, fonte: 'Informado manualmente' } }
    : { id: `ipva-${ref}`, key: 'ipva', name: 'IPVA', amount: 0, referenceMonth: ref, source: SOURCE.manual, status: STATUS.manual, available: false, lastUpdatedAt: at, meta: { fonte: 'Informado manualmente' } });

  // --- IPTU (manual, mensalizado) ---
  const iptuAnual = n(entrada.iptuAnual);
  records.push(iptuAnual > 0
    ? { id: `iptu-${ref}`, key: 'iptu', name: 'IPTU', amount: mensalizar(iptuAnual), referenceMonth: ref, source: SOURCE.manual, status: STATUS.manual, available: true, lastUpdatedAt: at, meta: { anual: round2(iptuAnual), mensalizado: true, fonte: 'Informado manualmente' } }
    : { id: `iptu-${ref}`, key: 'iptu', name: 'IPTU', amount: 0, referenceMonth: ref, source: SOURCE.manual, status: STATUS.manual, available: false, lastUpdatedAt: at, meta: { fonte: 'Informado manualmente' } });

  return records;
}

// ---------------------------------------------------------------------------
// Agrega os TaxRecord num resumo com as metricas do produto.
// totalCarga = confirmado + estimado + IPVA_mensalizado + IPTU_mensalizado.
// percentualCarga = totalCarga / rendaBruta * 100.
// diasEquivalentes = 365 * percentual / 100.
// ---------------------------------------------------------------------------
export function aggregate(records = [], rendaBruta = 0) {
  const disponiveis = records.filter((r) => r.available);
  let totalConfirmado = 0, totalEstimado = 0, totalManual = 0, totalCarga = 0;
  for (const r of disponiveis) {
    const v = n(r.amount);
    totalCarga = round2(totalCarga + v);
    if (r.status === STATUS.confirmed) totalConfirmado = round2(totalConfirmado + v);
    else if (r.status === STATUS.estimated) totalEstimado = round2(totalEstimado + v);
    else if (r.status === STATUS.manual) totalManual = round2(totalManual + v);
  }
  const renda = n(rendaBruta);
  const percentualCarga = renda > 0 ? round2((totalCarga / renda) * 100) : 0;
  const diasEquivalentes = round2((365 * percentualCarga) / 100);

  // categorias sem dado -> a "carga conhecida ate agora" ainda esta incompleta
  const categoriasSemDado = records.filter((r) => !r.available).map((r) => r.key);
  const temDadoSuficiente = disponiveis.some((r) => r.key === 'inss' || r.key === 'irrf' || r.key === 'consumo');

  return {
    totalConfirmado, totalEstimado, totalManual, totalCarga,
    rendaBruta: renda, percentualCarga, diasEquivalentes,
    categoriasSemDado, temDadoSuficiente,
    // soma dos componentes = total apresentado (garantia p/ os testes e para os graficos)
    componentes: disponiveis.map((r) => ({ key: r.key, name: r.name, amount: n(r.amount), status: r.status })),
  };
}

// ---------------------------------------------------------------------------
// "Como calculamos este valor?" — explicacao legivel por record.
// ---------------------------------------------------------------------------
export function explain(record) {
  if (!record) return null;
  const m = record.meta || {};
  return {
    name: record.name,
    status: record.status,
    source: record.source,
    fonte: m.fonte || IRRF_INFO.fonte,
    atualizadoEm: record.lastUpdatedAt,
    detalhe: m,
    confirmado: record.status === STATUS.confirmed,
  };
}

// ===========================================================================
// PROVIDERS de integracao — interfaces + mocks. Nenhuma conexao real a banco
// com usuario/senha. Um provider real (Open Finance / SERPRO) deve implementar
// a mesma interface e so entra em uso apos consentimento explicito.
// ===========================================================================

// Interface esperada de um provedor Open Finance:
//   isConnected(): boolean
//   connect(consent): Promise<{ ok, consentId, expiresAt }>
//   disconnect(): Promise<void>
//   fetchTaxRelevantData(period): Promise<{ transactions, taxes }>
export class MockOpenFinanceProvider {
  constructor() { this.connected = false; this.name = 'Open Finance (simulado)'; }
  isConnected() { return this.connected; }
  async connect() { this.connected = true; return { ok: true, consentId: 'mock-consent', expiresAt: null, mock: true }; }
  async disconnect() { this.connected = false; }
  // Mock NAO inventa tributos: devolve vazio ate existir integracao real.
  async fetchTaxRelevantData() { return { transactions: [], taxes: [], mock: true }; }
}

// Interface de estimativa de consumo (IBPT). O default usa CONSUMO_BUCKETS;
// um provider real pode carregar o CSV/JSON oficial do IBPT por NCM/estado.
export class DefaultTaxEstimateProvider {
  constructor() { this.name = 'IBPT (medias de referencia)'; }
  estimate(gastos) { return estimateConsumo(gastos); }
}
