// Tabelas de aliquotas de tributos — ESCOPADAS POR ANO e com FONTE declarada.
//
// PRINCIPIO: nada aqui e "descoberto" a partir do CPF. Sao tabelas publicas
// (Receita Federal / Previdencia) e medias setoriais (padrao IBPT). Cada bloco
// registra a `fonte` e a `observacao` para que a tela mostre com transparencia
// o que e regra oficial (confirmavel) e o que e media estimada.
//
// Como as tabelas mudam a cada ano, os valores default devem ser conferidos na
// fonte oficial. O motor (taxBurden.js) sempre escolhe o ano disponivel mais
// recente <= ao ano de referencia e expoe qual ano/fonte foi usado.

// ---------------------------------------------------------------------------
// INSS — contribuicao previdenciaria do empregado (CLT), progressiva por faixa.
// Fonte: Portaria Interministerial / tabela de contribuicao do INSS.
// ---------------------------------------------------------------------------
export const INSS_TABELAS = {
  2025: {
    ano: 2025,
    fonte: 'Tabela INSS 2025 (Portaria MPS/MF) — conferir vigencia',
    // aliquota aplicada de forma progressiva sobre a parcela de cada faixa
    faixas: [
      { ate: 1518.00, aliq: 0.075 },
      { ate: 2793.88, aliq: 0.09 },
      { ate: 4190.83, aliq: 0.12 },
      { ate: 8157.41, aliq: 0.14 },
    ],
    teto: 8157.41, // salario de contribuicao maximo
  },
};

// Ano usado como base quando o ano pedido nao tem tabela propria.
export const INSS_ANO_BASE = 2025;

// ---------------------------------------------------------------------------
// IRRF — ja tratado por src/lib/tax.js (DEFAULT_TAX.mensal). Aqui so guardamos
// o ponteiro de fonte para a UI; o calculo reusa o motor existente.
// ---------------------------------------------------------------------------
export const IRRF_INFO = {
  fonte: 'Tabela progressiva IRRF (Receita Federal) — via src/lib/tax.js',
  observacao: 'Calculado sobre base = bruto - INSS - dependentes - deducoes. Pode dar R$ 0,00 (isento).',
};

// ---------------------------------------------------------------------------
// Consumo — carga tributaria media embutida em produtos e servicos.
// PADRAO: IBPT (Lei 12.741/2012, "De Olho no Imposto"). Sao MEDIAS por
// categoria — jamais um valor "efetivamente recolhido" pelo contribuinte.
// Os percentuais abaixo sao aproximacoes de referencia por bucket de gasto e
// DEVEM ser substituidos pela tabela IBPT oficial (CSV/JSON) quando disponivel
// via TaxEstimateProvider. Cada bucket declara a fonte.
//
// percentualMedio = fracao do valor pago que corresponde a tributos embutidos.
// ---------------------------------------------------------------------------
export const CONSUMO_BUCKETS = {
  ano: 2025,
  fonte: 'Medias de referencia padrao IBPT (aproximadas) — substituir por tabela oficial',
  tipo: 'estimado',
  // chave -> { label, percentualMedio, palavras: termos p/ casar com a categoria/descricao }
  buckets: {
    alimentacao:   { label: 'Alimentacao',            percentualMedio: 0.18, palavras: ['aliment', 'mercado', 'supermerc', 'restaur', 'lanch', 'padaria', 'ifood', 'food'] },
    combustivel:   { label: 'Combustivel',            percentualMedio: 0.47, palavras: ['combust', 'gasolin', 'etanol', 'alcool', 'posto', 'diesel', 'shell', 'ipiranga', 'petrobras'] },
    energia:       { label: 'Energia eletrica',       percentualMedio: 0.42, palavras: ['energia', 'luz', 'eletric', 'enel', 'cemig', 'copel', 'light', 'cpfl'] },
    telecom:       { label: 'Telecom / Internet',     percentualMedio: 0.42, palavras: ['telefon', 'celular', 'internet', 'vivo', 'claro', 'tim', 'oi', 'net', 'banda larga'] },
    vestuario:     { label: 'Vestuario',              percentualMedio: 0.35, palavras: ['roupa', 'vestuar', 'calcado', 'sapato', 'moda', 'renner', 'riachuelo', 'zara'] },
    eletronicos:   { label: 'Eletronicos',            percentualMedio: 0.35, palavras: ['eletron', 'celular', 'notebook', 'computad', 'tv ', 'smartphone', 'informatic'] },
    saude:         { label: 'Saude / Farmacia',       percentualMedio: 0.15, palavras: ['saude', 'farmac', 'remedio', 'drogaria', 'medic', 'hospital', 'clinica', 'drogasil', 'raia'] },
    transporte:    { label: 'Transporte',             percentualMedio: 0.16, palavras: ['transport', 'uber', '99', 'onibus', 'metro', 'passagem', 'estacion', 'pedagio'] },
    lazer:         { label: 'Lazer / Assinaturas',    percentualMedio: 0.30, palavras: ['lazer', 'cinema', 'netflix', 'spotify', 'streaming', 'jogo', 'game', 'viagem', 'hotel'] },
    servicos:      { label: 'Servicos gerais',        percentualMedio: 0.30, palavras: ['servico', 'salao', 'barbear', 'academia', 'assinatur', 'consultor'] },
    outros:        { label: 'Outros bens/servicos',   percentualMedio: 0.27, palavras: [] }, // fallback
  },
};

// ---------------------------------------------------------------------------
// IOF — imposto sobre operacoes financeiras. Aqui so como referencia de
// aliquotas para operacoes que o app consiga identificar (ex.: compra em
// moeda estrangeira lancada com marcador). NAO e estimado por CPF.
// ---------------------------------------------------------------------------
export const IOF_INFO = {
  fonte: 'Decreto IOF (Receita Federal) — aliquotas de referencia',
  aliqCartaoInternacional: 0.0338, // 3,38% compras internacionais (referencia, confira vigencia)
  observacao: 'So contabilizado quando ha lancamento identificado como IOF/compra internacional.',
};

// Rotulos de status usados na UI e no motor.
export const STATUS = {
  confirmed: 'confirmed', // fonte confirma o valor (holerite, IOF lancado, cadastro)
  estimated: 'estimated', // media/tabela — nunca "recolhido"
  manual: 'manual',       // informado manualmente pelo usuario
};

// Origens possiveis do dado (TaxDataSource).
export const SOURCE = {
  government_api: 'government_api',
  open_finance: 'open_finance',
  payroll: 'payroll',
  ibpt: 'ibpt',
  manual: 'manual',
  calculated: 'calculated',
};

// Seleciona a tabela INSS do ano (ou a base mais recente disponivel).
export function getInssTabela(ano) {
  if (INSS_TABELAS[ano]) return INSS_TABELAS[ano];
  const anos = Object.keys(INSS_TABELAS).map(Number).sort((a, b) => b - a);
  const escolhido = anos.find((a) => a <= ano) ?? anos[0] ?? INSS_ANO_BASE;
  const t = INSS_TABELAS[escolhido];
  return { ...t, herdadoDe: escolhido, anoPedido: ano };
}
