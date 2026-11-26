// IOF do cartão de crédito — fonte única para todas as telas de impostos.
//
// O IOF chega por dois caminhos:
//  1) TaxLedger (source 'invoice'): gravado na importação da fatura, com o total
//     que a IA achou na fatura INTEIRA (itens + resumo/encargos);
//  2) CreditCardTransaction: linhas "IOF ..." que entraram como lançamento
//     (faturas antigas, leitura local, lançamento manual).
// Para cada cartão+mês fica o MAIOR dos dois (são visões do mesmo imposto —
// somar duplicaria). IOF lançado à mão no ledger (outra origem) soma à parte.

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
// "IOF", "I.O.F.", "IOF de 'Loja'", "Imp. s/ Op. Financeiras", "Imposto sobre operações..."
const IOF_RE = /(^|[^a-z0-9])i\.?\s?o\.?\s?f(?![a-z0-9])|imposto sobre opera|imp\.?\s*s\/\s*op/;
export const isIofText = (s) => IOF_RE.test(norm(s));

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const txMonth = (t) => t.competence_month || String(t.date || '').slice(0, 7);

// Lista consolidada: [{ key, card_id, mk, amount, via, label, fromTx, fromLedger, txCount }]
export function iofEntries(ledger = [], cardTxs = [], { cardNames = {} } = {}) {
  const map = new Map();
  const get = (cardId, mk) => {
    const k = `${cardId || '-'}|${mk}`;
    if (!map.has(k)) map.set(k, { key: k, card_id: cardId || null, mk, fromTx: 0, fromLedger: 0, txCount: 0, label: cardNames[cardId] || '' });
    return map.get(k);
  };
  for (const t of cardTxs || []) {
    if (!isIofText(t.description)) continue;
    const mk = txMonth(t); if (!mk) continue;
    const e = get(t.card_id, mk);
    e.fromTx += Math.abs(Number(t.amount) || 0); e.txCount += 1;
  }
  const extras = [];
  for (const r of ledger || []) {
    if (r.kind !== 'IOF' || !r.reference_month) continue;
    const amt = Math.abs(Number(r.amount) || 0);
    if (r.source === 'invoice') {
      const e = get(r.origin_id, r.reference_month);
      e.fromLedger += amt; if (!e.label) e.label = r.origin_label || '';
    } else {
      extras.push({ key: `l${r.id}`, card_id: null, mk: r.reference_month, amount: r2(amt), via: r.source || 'manual', label: r.origin_label || 'IOF lançado', fromTx: 0, fromLedger: amt, txCount: 0 });
    }
  }
  const rows = [...map.values()].map((e) => ({
    ...e,
    fromTx: r2(e.fromTx), fromLedger: r2(e.fromLedger),
    amount: r2(Math.max(e.fromTx, e.fromLedger)),
    via: e.fromLedger >= e.fromTx ? 'fatura' : 'lançamentos',
    label: e.label || 'Cartão de crédito',
  }));
  return [...rows, ...extras].filter((e) => e.amount > 0).sort((a, b) => (a.mk < b.mk ? 1 : -1));
}

export function iofByMonth(ledger, cardTxs) {
  const m = {};
  for (const e of iofEntries(ledger, cardTxs)) m[e.mk] = r2((m[e.mk] || 0) + e.amount);
  return m;
}
export const iofForMonth = (mk, ledger, cardTxs) => iofByMonth(ledger, cardTxs)[mk] || 0;
export function iofForYear(year, ledger, cardTxs) {
  const ys = String(year);
  return r2(Object.entries(iofByMonth(ledger, cardTxs)).filter(([mk]) => mk.startsWith(ys)).reduce((s, [, v]) => s + v, 0));
}
