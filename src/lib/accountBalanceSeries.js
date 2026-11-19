// Reconstrói a série histórica de saldo a partir de dados reais (saldo
// inicial + lançamentos), sem inventar tendência nenhuma. Transferências
// entre contas da própria carteira não alteram o saldo consolidado (uma
// perna soma, a outra subtrai), então para o total elas se cancelam; para
// o saldo de UMA conta especifica, ambas as pernas contam.

function dayKey(d) { return String(d).slice(0, 10); }
function addDays(iso, n) { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }

// transactions: lista completa (ja filtrada por conta, se for o caso)
// initialTotal: soma dos saldos iniciais das contas consideradas
// accountIds: quando informado, conta transferencias de/para essas contas tambem
export function buildBalanceSeries({ transactions, initialTotal, days, accountIds = null }) {
  const today = new Date().toISOString().slice(0, 10);
  const start = addDays(today, -(days - 1));

  // efeito liquido de cada lancamento no saldo considerado
  const net = (t) => {
    if (t.type === 'income') return Number(t.amount) || 0;
    if (t.type === 'expense') return -(Number(t.amount) || 0);
    if (t.type === 'transfer') {
      if (!accountIds) return 0; // no consolidado, transferencia interna se cancela
      let v = 0;
      if (accountIds.has(t.account_id)) v -= Number(t.amount) || 0;
      if (accountIds.has(t.account_to_id)) v += Number(t.amount) || 0;
      return v;
    }
    return 0;
  };

  // saldo no inicio da janela = saldo inicial + tudo que aconteceu antes da janela
  let running = initialTotal;
  for (const t of transactions) { if (dayKey(t.date) < start) running += net(t); }

  const byDay = {};
  for (const t of transactions) { const k = dayKey(t.date); if (k >= start && k <= today) byDay[k] = (byDay[k] || 0) + net(t); }

  const series = [];
  let cur = running;
  for (let i = 0; i < days; i++) {
    const d = addDays(start, i);
    cur += byDay[d] || 0;
    series.push({ day: d, value: Math.round(cur * 100) / 100 });
  }
  return series;
}
