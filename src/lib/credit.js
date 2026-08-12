// Analise de credito com regras por tipo e subtipo. Tudo local, sem servico externo.
// Regras aproximadas de mercado (Brasil) — editaveis e usadas como orientacao, nao garantia.
const n = (v) => { const x = Number(v); return isNaN(x) ? 0 : x; };

export function priceInstallment(P, iPct, meses) {
  P = n(P); const i = n(iPct) / 100; const m = n(meses);
  if (!P || !m) return 0;
  if (i === 0) return P / m;
  return (P * i) / (1 - Math.pow(1 + i, -m));
}
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

// Matriz de regras. hasSubtipo -> usa subtipos; senao usa base.
export const CREDIT_MATRIX = {
  imovel: {
    label: 'Financiamento imobiliario', hasSubtipo: true, comprometimentoMax: 0.30, custoAquisicaoPct: 0.05, idadeRule: true, tetoSFH: 1500000,
    subtipos: {
      novo: { key: 'novo', label: 'Imovel novo', ltvMax: 0.80, entradaMinPct: 0.20, prazoMaxMeses: 420, taxaTipicaAm: 0.90 },
      usado: { key: 'usado', label: 'Imovel usado', ltvMax: 0.80, entradaMinPct: 0.20, prazoMaxMeses: 420, taxaTipicaAm: 0.95 },
      mcmv: { key: 'mcmv', label: 'Minha Casa Minha Vida', ltvMax: 0.80, entradaMinPct: 0.05, prazoMaxMeses: 420, taxaTipicaAm: 0.45, rendaMax: 8000, obs: 'Faixas com subsidio e juros reduzidos para renda familiar ate ~R$ 8.000.' },
    },
  },
  veiculo: {
    label: 'Financiamento de veiculo', hasSubtipo: true, comprometimentoMax: 0.30, custoAquisicaoPct: 0,
    subtipos: {
      novo: { key: 'novo', label: 'Veiculo 0km', ltvMax: 1.00, entradaMinPct: 0, prazoMaxMeses: 72, taxaTipicaAm: 1.60 },
      usado: { key: 'usado', label: 'Veiculo usado', ltvMax: 0.90, entradaMinPct: 0.10, prazoMaxMeses: 60, taxaTipicaAm: 2.10, veiculoMaxAnos: 12 },
    },
  },
  pessoal: {
    label: 'Emprestimo pessoal', hasSubtipo: false, comprometimentoMax: 0.30, custoAquisicaoPct: 0,
    base: { ltvMax: 1, entradaMinPct: 0, prazoMaxMeses: 96, taxaTipicaAm: 4.50 },
  },
  consignado: {
    label: 'Emprestimo consignado', hasSubtipo: true, comprometimentoMax: 0.35, custoAquisicaoPct: 0,
    subtipos: {
      inss: { key: 'inss', label: 'INSS (aposentados/pensionistas)', ltvMax: 1, entradaMinPct: 0, prazoMaxMeses: 84, taxaTipicaAm: 1.80 },
      publico: { key: 'publico', label: 'Servidor publico', ltvMax: 1, entradaMinPct: 0, prazoMaxMeses: 96, taxaTipicaAm: 1.70 },
      privado: { key: 'privado', label: 'CLT (setor privado)', ltvMax: 1, entradaMinPct: 0, prazoMaxMeses: 48, taxaTipicaAm: 2.20 },
    },
  },
};

export function subtiposDe(tipo) {
  const t = CREDIT_MATRIX[tipo]; if (!t || !t.hasSubtipo) return [];
  return Object.values(t.subtipos);
}
export function rulesFor(tipo, subtipo) {
  const t = CREDIT_MATRIX[tipo] || CREDIT_MATRIX.imovel;
  const sub = t.hasSubtipo ? (t.subtipos[subtipo] || Object.values(t.subtipos)[0]) : t.base;
  return { tipoLabel: t.label, comprometimentoMax: t.comprometimentoMax, custoAquisicaoPct: t.custoAquisicaoPct || 0, idadeRule: !!t.idadeRule, tetoSFH: t.tetoSFH || 0, ...sub };
}

// Regra de idade (financiamento imobiliario): idade + prazo <= 80 anos e 6 meses
const IDADE_LIMITE_MESES = 80 * 12 + 6;

export function analyzeCredit(inp) {
  const tipo = inp.tipo || 'imovel';
  const isFinanciamento = tipo === 'imovel' || tipo === 'veiculo';
  const r = rulesFor(tipo, inp.subtipo);
  const rendaMensal = n(inp.rendaMensal);
  const outrasParcelas = n(inp.outrasParcelas);
  const taxaMes = n(inp.taxaMes);
  const prazo = Math.max(1, Math.round(n(inp.prazo)));
  const sistema = inp.sistema === 'sac' ? 'sac' : 'price';

  const valorBem = n(inp.valorBem);
  const entrada = isFinanciamento ? n(inp.entrada) : 0;
  const fgts = tipo === 'imovel' ? n(inp.fgts) : 0;
  const financiado = isFinanciamento ? Math.max(0, valorBem - entrada) : n(inp.valorEmprestimo);

  const parcelaPrice = priceInstallment(financiado, taxaMes, prazo);
  const sac = sacInstallments(financiado, taxaMes, prazo);
  const parcela = sistema === 'sac' ? sac.first : parcelaPrice;
  const totalPago = sistema === 'sac' ? sac.total : parcelaPrice * prazo;
  const jurosTotal = Math.max(0, totalPago - financiado);

  const compLimit = r.comprometimentoMax;
  const comprometimento = rendaMensal > 0 ? (parcela + outrasParcelas) / rendaMensal : Infinity;
  const ltv = isFinanciamento && valorBem > 0 ? financiado / valorBem : 0;
  const rendaMinima = (parcela + outrasParcelas) / compLimit;

  // custos de aquisicao (imovel): ITBI + registro ~5%; recursos a vista = entrada + custos - fgts
  const custosAquisicao = valorBem * (r.custoAquisicaoPct || 0);
  const recursosNecessarios = Math.max(0, entrada + custosAquisicao - fgts);

  const reasons = [];
  let status = 'aprovavel';
  const worsen = (to) => { const order = ['aprovavel', 'limitrofe', 'dificil', 'reprovavel']; if (order.indexOf(to) > order.indexOf(status)) status = to; };

  // 1) comprometimento de renda
  if (comprometimento <= compLimit) reasons.push({ ok: true, text: `Parcela compromete ${(comprometimento * 100).toFixed(0)}% da renda (limite ~${(compLimit * 100).toFixed(0)}%).` });
  else if (comprometimento <= compLimit + 0.10) { worsen('limitrofe'); reasons.push({ ok: false, text: `Comprometimento de ${(comprometimento * 100).toFixed(0)}% acima do ideal (~${(compLimit * 100).toFixed(0)}%).` }); }
  else if (comprometimento <= compLimit + 0.20) { worsen('dificil'); reasons.push({ ok: false, text: `Comprometimento alto: ${(comprometimento * 100).toFixed(0)}% da renda.` }); }
  else { worsen('reprovavel'); reasons.push({ ok: false, text: `Comprometimento inviavel: ${isFinite(comprometimento) ? (comprometimento * 100).toFixed(0) + '%' : 'renda nao informada'}.` }); }

  // 2) entrada / LTV
  if (isFinanciamento) {
    const entradaPct = valorBem > 0 ? entrada / valorBem : 0;
    if (ltv <= r.ltvMax + 1e-9) reasons.push({ ok: true, text: `Entrada de ${(entradaPct * 100).toFixed(0)}% cobre o minimo de ${(r.entradaMinPct * 100).toFixed(0)}% (financia ate ${(r.ltvMax * 100).toFixed(0)}%).` });
    else { worsen('dificil'); reasons.push({ ok: false, text: `Entrada de ${(entradaPct * 100).toFixed(0)}% abaixo do minimo de ${(r.entradaMinPct * 100).toFixed(0)}% — o banco financia no maximo ${(r.ltvMax * 100).toFixed(0)}% (faltam ${(( (1 - r.ltvMax) - entradaPct) * 100).toFixed(0)} p.p. de entrada).` }); }
  }

  // 3) prazo
  if (prazo > r.prazoMaxMeses) { worsen('limitrofe'); reasons.push({ ok: false, text: `Prazo de ${prazo} meses acima do usual para ${r.label || tipo} (${r.prazoMaxMeses}).` }); }
  else reasons.push({ ok: true, text: `Prazo de ${prazo} meses dentro do limite (${r.prazoMaxMeses}).` });

  // 4) idade do proponente (imovel)
  let maxPrazoIdade = null;
  if (r.idadeRule && n(inp.idadeAnos) > 0) {
    maxPrazoIdade = Math.max(0, IDADE_LIMITE_MESES - Math.round(n(inp.idadeAnos) * 12));
    if (prazo > maxPrazoIdade) { worsen('dificil'); reasons.push({ ok: false, text: `Idade + prazo passam de 80 anos e 6 meses: com ${n(inp.idadeAnos)} anos, o prazo maximo e ~${maxPrazoIdade} meses.` }); }
    else reasons.push({ ok: true, text: `Idade + prazo dentro do limite de 80 anos e 6 meses (max ~${maxPrazoIdade} meses).` });
  }

  // 5) idade do veiculo (usado)
  if (tipo === 'veiculo' && r.veiculoMaxAnos && n(inp.idadeVeiculoAnos) > 0) {
    if (n(inp.idadeVeiculoAnos) > r.veiculoMaxAnos) { worsen('dificil'); reasons.push({ ok: false, text: `Muitos bancos nao financiam veiculo com mais de ${r.veiculoMaxAnos} anos (informado: ${n(inp.idadeVeiculoAnos)}).` }); }
    else reasons.push({ ok: true, text: `Idade do veiculo (${n(inp.idadeVeiculoAnos)} anos) dentro do aceito (ate ${r.veiculoMaxAnos}).` });
  }

  // 6) MCMV: teto de renda
  if (tipo === 'imovel' && inp.subtipo === 'mcmv' && r.rendaMax && rendaMensal > r.rendaMax) {
    worsen('limitrofe'); reasons.push({ ok: false, text: `Renda de ${brl(rendaMensal)} acima do teto do MCMV (~${brl(r.rendaMax)}). Enquadraria em financiamento comum.` });
  }

  // 7) teto SFH (imovel)
  if (tipo === 'imovel' && r.tetoSFH && valorBem > r.tetoSFH) {
    reasons.push({ ok: false, text: `Imovel acima de ${brl(r.tetoSFH)} (fora do SFH): usa regras do SFI, sem FGTS e com taxas de mercado.` });
  }

  if (rendaMensal <= 0) status = 'reprovavel';

  // score amigavel
  let score = 100;
  score -= Math.max(0, comprometimento - compLimit) * 300;
  if (isFinanciamento && ltv > r.ltvMax) score -= (ltv - r.ltvMax) * 250;
  if (prazo > r.prazoMaxMeses) score -= 8;
  if (maxPrazoIdade != null && prazo > maxPrazoIdade) score -= 15;
  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    tipo, subtipo: inp.subtipo, rules: r, isFinanciamento, sistema,
    financiado, entrada, valorBem, prazo, taxaMes, fgts,
    parcela, parcelaPrice, sac, totalPago, jurosTotal,
    comprometimento, compLimit, ltv, rendaMinima, rendaMensal, outrasParcelas,
    custosAquisicao, recursosNecessarios, maxPrazoIdade,
    status, score, reasons,
  };
}

function brl(v) { return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

export const STATUS_META = {
  aprovavel: { label: 'Provavelmente aprovado', color: '#10b981', emoji: '✅', hint: 'Seu perfil cabe nos criterios usuais dos bancos.' },
  limitrofe: { label: 'No limite', color: '#f59e0b', emoji: '⚠️', hint: 'Da pra tentar, mas ajuste entrada, prazo ou valor para melhorar.' },
  dificil: { label: 'Dificil aprovacao', color: '#f97316', emoji: '🟠', hint: 'Ha criterios fora do padrao. Considere um valor menor ou mais entrada.' },
  reprovavel: { label: 'Provavelmente negado', color: '#ef4444', emoji: '⛔', hint: 'Os numeros nao fecham. Reveja renda, valor e prazo.' },
};
