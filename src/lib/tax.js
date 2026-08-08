// Calculo de Imposto de Renda PF (Brasil). Tabelas e limites sao EDITAVEIS pelo usuario.
// Valores padrao com base nas tabelas 2024/2025 — confira sempre no site da Receita, pois mudam a cada ano.

export const DEFAULT_TAX = {
  ano: 2025,
  fonte: 'Base 2024/2025 — confira valores vigentes na Receita Federal',
  // Tabela ANUAL do ajuste (declaracao)
  anual: [
    { ate: 24511.92, aliq: 0, ded: 0 },
    { ate: 33919.80, aliq: 7.5, ded: 1838.39 },
    { ate: 45012.60, aliq: 15, ded: 4382.38 },
    { ate: 55976.16, aliq: 22.5, ded: 7758.32 },
    { ate: Infinity, aliq: 27.5, ded: 10557.13 },
  ],
  // Tabela MENSAL (IRRF / carne-leao)
  mensal: [
    { ate: 2259.20, aliq: 0, ded: 0 },
    { ate: 2826.65, aliq: 7.5, ded: 169.44 },
    { ate: 3751.05, aliq: 15, ded: 381.44 },
    { ate: 4664.68, aliq: 22.5, ded: 662.77 },
    { ate: Infinity, aliq: 27.5, ded: 896.00 },
  ],
  descontoSimplificadoMensal: 564.80,
  descontoSimplificadoAnualPct: 20,
  descontoSimplificadoAnualTeto: 16754.34,
  deducaoDependenteAnual: 2275.08,
  deducaoDependenteMensal: 189.59,
  tetoEducacaoAnual: 3561.50,
  // Renda variavel (regras gerais PF — confira casos especiais)
  rv: {
    tetoAcoesMensal: 20000,   // isencao de ganho em acoes se vendas no mes <= este valor
    aliqAcoes: 15,            // % sobre ganho liquido em acoes (mercado a vista)
    aliqDaytrade: 20,         // % day-trade (sem isencao)
    aliqFII: 20,              // % fundos imobiliarios (sem isencao)
    tetoCriptoMensal: 35000,  // isencao de cripto se vendas no mes <= este valor
    aliqCripto: 15,           // % sobre ganho em cripto acima do teto
  },
};

const n = (v) => { const x = Number(v); return isNaN(x) ? 0 : x; };

// Aplica uma tabela progressiva (faixas ordenadas por 'ate') a uma base de calculo.
export function aplicarTabela(base, tabela) {
  base = Math.max(0, n(base));
  const faixas = [...tabela].sort((a, b) => a.ate - b.ate);
  for (const f of faixas) {
    if (base <= f.ate) return { aliq: f.aliq, ded: f.ded, imposto: Math.max(0, base * f.aliq / 100 - f.ded) };
  }
  const last = faixas[faixas.length - 1];
  return { aliq: last.aliq, ded: last.ded, imposto: Math.max(0, base * last.aliq / 100 - last.ded) };
}

// Estimativa anual: compara desconto simplificado x deducoes legais (completo) e escolhe o menor imposto.
export function calcAnual(inp, cfg = DEFAULT_TAX) {
  const tributavel = n(inp.tributavel);
  const dependentes = Math.max(0, Math.floor(n(inp.dependentes)));
  const educacaoDed = Math.min(n(inp.educacao), cfg.tetoEducacaoAnual * (dependentes + 1));

  const dedCompleto = n(inp.inss) + dependentes * cfg.deducaoDependenteAnual + n(inp.saude) + educacaoDed + n(inp.previdencia) + n(inp.pensao) + n(inp.outras);
  const baseCompleto = Math.max(0, tributavel - dedCompleto);
  const fCompleto = aplicarTabela(baseCompleto, cfg.anual);

  const descSimpl = Math.min(tributavel * cfg.descontoSimplificadoAnualPct / 100, cfg.descontoSimplificadoAnualTeto);
  const baseSimpl = Math.max(0, tributavel - descSimpl);
  const fSimpl = aplicarTabela(baseSimpl, cfg.anual);

  const impostoCompleto = fCompleto.imposto;
  const impostoSimpl = fSimpl.imposto;
  const melhor = impostoCompleto <= impostoSimpl ? 'completo' : 'simplificado';
  const imposto = Math.min(impostoCompleto, impostoSimpl);

  return {
    completo: { deducoes: dedCompleto, base: baseCompleto, ...fCompleto },
    simplificado: { desconto: descSimpl, base: baseSimpl, ...fSimpl },
    melhor, imposto,
    economia: Math.abs(impostoCompleto - impostoSimpl),
    aliquotaEfetiva: tributavel > 0 ? imposto / tributavel * 100 : 0,
  };
}

// Carne-Leao / IRRF mensal.
export function calcMensal(inp, cfg = DEFAULT_TAX) {
  const rendimento = n(inp.rendimento);
  const dependentes = Math.max(0, Math.floor(n(inp.dependentes)));
  const base = Math.max(0, rendimento - n(inp.inss) - dependentes * cfg.deducaoDependenteMensal - n(inp.despesas));
  const f = aplicarTabela(base, cfg.mensal);
  return { rendimento, base, ...f, aliquotaEfetiva: rendimento > 0 ? f.imposto / rendimento * 100 : 0 };
}

// Renda variavel — DARF mensal (codigo 6015). Considera isencao de acoes (vendas <= teto) e de cripto.
export function calcRendaVariavel(inp, cfg = DEFAULT_TAX) {
  const rv = cfg.rv || DEFAULT_TAX.rv;
  // Acoes mercado a vista
  const acoesVendas = n(inp.acoesVendas);
  const acoesIsento = acoesVendas > 0 && acoesVendas <= rv.tetoAcoesMensal;
  const acoesBase = Math.max(0, n(inp.acoesGanho) - n(inp.acoesPrejuizo));
  const acoesImposto = acoesIsento ? 0 : acoesBase * rv.aliqAcoes / 100;
  // Day-trade (sem isencao)
  const dtBase = Math.max(0, n(inp.daytradeGanho) - n(inp.daytradePrejuizo));
  const dtImposto = dtBase * rv.aliqDaytrade / 100;
  // FIIs (sem isencao)
  const fiiBase = Math.max(0, n(inp.fiiGanho) - n(inp.fiiPrejuizo));
  const fiiImposto = fiiBase * rv.aliqFII / 100;
  // Cripto
  const criptoVendas = n(inp.criptoVendas);
  const criptoIsento = criptoVendas > 0 && criptoVendas <= rv.tetoCriptoMensal;
  const criptoBase = Math.max(0, n(inp.criptoGanho));
  const criptoImposto = criptoIsento ? 0 : criptoBase * rv.aliqCripto / 100;

  const itens = [
    { chave: 'acoes', label: 'Acoes (a vista)', aliq: rv.aliqAcoes, base: acoesBase, isento: acoesIsento, imposto: acoesImposto },
    { chave: 'daytrade', label: 'Day-trade', aliq: rv.aliqDaytrade, base: dtBase, isento: false, imposto: dtImposto },
    { chave: 'fii', label: 'Fundos imobiliarios', aliq: rv.aliqFII, base: fiiBase, isento: false, imposto: fiiImposto },
    { chave: 'cripto', label: 'Criptoativos', aliq: rv.aliqCripto, base: criptoBase, isento: criptoIsento, imposto: criptoImposto },
  ];
  const total = itens.reduce((s, i) => s + i.imposto, 0);
  return { itens, total: Math.round(total * 100) / 100 };
}
