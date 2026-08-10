// Analise de credito: financiamento (imovel/veiculo) e emprestimo. Tudo local, sem servico externo.
const n = (v) => { const x = Number(v); return isNaN(x) ? 0 : x; };

// Parcela fixa (Tabela Price)
export function priceInstallment(P, iPct, meses) {
  P = n(P); const i = n(iPct) / 100; const m = n(meses);
  if (!P || !m) return 0;
  if (i === 0) return P / m;
  return (P * i) / (1 - Math.pow(1 + i, -m));
}
// SAC: amortizacao constante; primeira parcela e a maior
export function sacInstallments(P, iPct, meses) {
  P = n(P); const i = n(iPct) / 100; const m = n(meses);
  if (!P || !m) return { first: 0, last: 0, total: 0 };
  const amort = P / m;
  const first = amort + P * i;
  const last = amort + amort * i;
  let total = 0, saldo = P;
  for (let k = 0; k < m; k++) { total += amort + saldo * i; saldo -= amort; }
  return { first, last, total };
}

// Parametros minimos por tipo (regra de mercado; ajustaveis)
export const CREDIT_TYPES = {
  imovel: { label: 'Financiamento imobiliario', ltvMax: 0.80, entradaMinPct: 0.20, prazoMaxMeses: 420 },
  veiculo: { label: 'Financiamento de veiculo', ltvMax: 0.90, entradaMinPct: 0.10, prazoMaxMeses: 72 },
  pessoal: { label: 'Emprestimo pessoal', ltvMax: 1, entradaMinPct: 0, prazoMaxMeses: 96 },
  consignado: { label: 'Emprestimo consignado', ltvMax: 1, entradaMinPct: 0, prazoMaxMeses: 96 },
};

// Regra de comprometimento de renda (parcela+outras dividas) / renda
const COMPROMETIMENTO = { consignado: 0.35, default: 0.30 };

export function analyzeCredit(inp) {
  const tipo = inp.tipo || 'imovel';
  const cfg = CREDIT_TYPES[tipo] || CREDIT_TYPES.imovel;
  const isFinanciamento = tipo === 'imovel' || tipo === 'veiculo';
  const rendaMensal = n(inp.rendaMensal);
  const outrasParcelas = n(inp.outrasParcelas);
  const taxaMes = n(inp.taxaMes);
  const prazo = Math.max(1, Math.round(n(inp.prazo)));
  const sistema = inp.sistema === 'sac' ? 'sac' : 'price';

  const valorBem = n(inp.valorBem);
  const entrada = isFinanciamento ? n(inp.entrada) : 0;
  const financiado = isFinanciamento ? Math.max(0, valorBem - entrada) : n(inp.valorEmprestimo);

  const parcelaPrice = priceInstallment(financiado, taxaMes, prazo);
  const sac = sacInstallments(financiado, taxaMes, prazo);
  const parcela = sistema === 'sac' ? sac.first : parcelaPrice; // conservador: SAC usa a maior parcela
  const totalPago = sistema === 'sac' ? sac.total : parcelaPrice * prazo;
  const jurosTotal = Math.max(0, totalPago - financiado);

  const compLimit = COMPROMETIMENTO[tipo] || COMPROMETIMENTO.default;
  const comprometimento = rendaMensal > 0 ? (parcela + outrasParcelas) / rendaMensal : Infinity;
  const ltv = isFinanciamento && valorBem > 0 ? financiado / valorBem : 0;
  const rendaMinima = (parcela + outrasParcelas) / compLimit;

  const reasons = [];
  let status = 'aprovavel';
  // comprometimento de renda
  if (comprometimento <= compLimit) reasons.push({ ok: true, text: `Parcela compromete ${(comprometimento * 100).toFixed(0)}% da renda (limite ~${(compLimit * 100).toFixed(0)}%).` });
  else if (comprometimento <= compLimit + 0.10) { status = 'limitrofe'; reasons.push({ ok: false, text: `Comprometimento de ${(comprometimento * 100).toFixed(0)}% acima do ideal (~${(compLimit * 100).toFixed(0)}%).` }); }
  else if (comprometimento <= compLimit + 0.20) { status = 'dificil'; reasons.push({ ok: false, text: `Comprometimento alto: ${(comprometimento * 100).toFixed(0)}% da renda.` }); }
  else { status = 'reprovavel'; reasons.push({ ok: false, text: `Comprometimento inviavel: ${isFinite(comprometimento) ? (comprometimento * 100).toFixed(0) + '%' : 'renda nao informada'}.` }); }

  // entrada / LTV (financiamento)
  if (isFinanciamento) {
    const entradaPct = valorBem > 0 ? entrada / valorBem : 0;
    if (ltv <= cfg.ltvMax) reasons.push({ ok: true, text: `Entrada de ${(entradaPct * 100).toFixed(0)}% cobre o minimo (${(cfg.entradaMinPct * 100).toFixed(0)}%).` });
    else {
      reasons.push({ ok: false, text: `Entrada de ${(entradaPct * 100).toFixed(0)}% abaixo do minimo de ${(cfg.entradaMinPct * 100).toFixed(0)}% (banco financia ate ${(cfg.ltvMax * 100).toFixed(0)}%).` });
      if (status === 'aprovavel') status = 'limitrofe'; else if (status === 'limitrofe') status = 'dificil';
    }
  }
  // prazo
  if (prazo > cfg.prazoMaxMeses) { reasons.push({ ok: false, text: `Prazo de ${prazo} meses acima do usual (${cfg.prazoMaxMeses}).` }); if (status === 'aprovavel') status = 'limitrofe'; }
  if (rendaMensal <= 0) { status = 'reprovavel'; }

  // score amigavel 0-100
  let score = 100;
  score -= Math.max(0, comprometimento - compLimit) * 300;
  if (isFinanciamento && ltv > cfg.ltvMax) score -= (ltv - cfg.ltvMax) * 200;
  if (prazo > cfg.prazoMaxMeses) score -= 8;
  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    tipo, cfg, isFinanciamento, sistema,
    financiado, entrada, valorBem, prazo, taxaMes,
    parcela, parcelaPrice, sac, totalPago, jurosTotal,
    comprometimento, compLimit, ltv, rendaMinima, rendaMensal, outrasParcelas,
    status, score, reasons,
  };
}

export const STATUS_META = {
  aprovavel: { label: 'Provavelmente aprovado', color: '#10b981', emoji: '✅', hint: 'Seu perfil cabe nos criterios usuais dos bancos.' },
  limitrofe: { label: 'No limite', color: '#f59e0b', emoji: '⚠️', hint: 'Da pra tentar, mas ajuste entrada, prazo ou valor para melhorar.' },
  dificil: { label: 'Dificil aprovacao', color: '#f97316', emoji: '🟠', hint: 'O comprometimento esta alto. Considere um valor menor ou mais entrada.' },
  reprovavel: { label: 'Provavelmente negado', color: '#ef4444', emoji: '⛔', hint: 'Os numeros nao fecham. Reveja renda, valor e prazo.' },
};
