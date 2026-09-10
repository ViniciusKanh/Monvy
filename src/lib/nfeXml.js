// Leitura nativa de NF-e / NFC-e a partir do XML (sem IA, sem dependencias).
// A estrutura do XML da nota (padrao SEFAZ) e estavel: infNFe > emit / ide / total.
// Extrai os tributos do bloco de totais (ICMSTot) e, quando presente, o valor
// aproximado dos tributos (vTotTrib, Lei da Transparencia 12.741/2012).

function elNum(scope, tag) { const el = scope && scope.getElementsByTagName(tag)[0]; const v = el ? Number(el.textContent) : 0; return isNaN(v) ? 0 : v; }
function elStr(scope, tag) { const el = scope && scope.getElementsByTagName(tag)[0]; return el ? String(el.textContent || '').trim() : ''; }

export function parseNfeXml(xmlString) {
  const doc = new DOMParser().parseFromString(String(xmlString || ''), 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('XML inválido ou corrompido.');
  const infNFe = doc.getElementsByTagName('infNFe')[0];
  if (!infNFe) throw new Error('Este arquivo não parece ser uma NF-e (elemento infNFe ausente).');

  const emit = doc.getElementsByTagName('emit')[0] || doc;
  const ide = doc.getElementsByTagName('ide')[0] || doc;
  const tot = doc.getElementsByTagName('ICMSTot')[0] || doc;

  const key = (infNFe.getAttribute('Id') || '').replace(/^NFe/i, '');
  const retTrib = doc.getElementsByTagName('retTrib')[0]; // retencoes federais (quando houver)
  const issqnTot = doc.getElementsByTagName('ISSQNtot')[0]; // bloco de servico dentro da NF-e
  const taxes = {
    icms: elNum(tot, 'vICMS'),
    ipi: elNum(tot, 'vIPI'),
    ii: elNum(tot, 'vII'),
    iss: elNum(issqnTot, 'vISS') || elNum(doc, 'vISS'),
    pis: elNum(tot, 'vPIS'),
    cofins: elNum(tot, 'vCOFINS'),
    irrf: elNum(retTrib, 'vIRRF'),
    csll: elNum(retTrib, 'vRetCSLL'),
    inss: elNum(retTrib, 'vRetPrev'),
    ibs: elNum(tot, 'vIBS'), // reforma tributaria (IBS)
    cbs: elNum(tot, 'vCBS'), // reforma tributaria (CBS)
    fcp: elNum(tot, 'vFCP'),
  };
  const aproximado = elNum(tot, 'vTotTrib'); // valor aprox. dos tributos (IBPT)
  const somaExplicita = taxes.icms + taxes.ipi + taxes.ii + taxes.iss + taxes.pis + taxes.cofins + taxes.irrf + taxes.csll + taxes.inss + taxes.ibs + taxes.cbs;
  // total_tax: prioriza o valor explicito dos tributos incidentes; usa o aproximado
  // como piso quando os campos vem zerados (comum em NFC-e de varejo).
  const total_tax = Math.round((somaExplicita > 0 ? somaExplicita : aproximado) * 100) / 100;

  const dh = elStr(ide, 'dhEmi') || elStr(ide, 'dEmi');
  return {
    access_key: key,
    number: elStr(ide, 'nNF'),
    emitter: elStr(emit, 'xNome') || 'Emitente',
    emitter_cnpj: elStr(emit, 'CNPJ'),
    issued_date: (dh || '').slice(0, 10),
    total_value: elNum(tot, 'vNF'),
    taxes: { ...taxes, aproximado },
    total_tax,
    note_type: taxes.iss > 0 ? 'servico' : 'produto',
    source: 'xml',
  };
}
