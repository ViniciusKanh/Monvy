// Holerites (contracheques) — agregações usadas no Salário Líquido e na Carga Tributária.

export const PAYSLIP_KINDS = [
  { value: 'mensal', label: 'Mensal' },
  { value: 'adiantamento', label: 'Adiantamento' },
  { value: 'decimo_terceiro', label: '13º salário' },
  { value: 'ferias', label: 'Férias' },
  { value: 'plr', label: 'PLR' },
  { value: 'rescisao', label: 'Rescisão' },
  { value: 'outro', label: 'Outro' },
];
export const kindLabel = (k) => PAYSLIP_KINDS.find((x) => x.value === k)?.label || 'Mensal';

const n = (v) => Number(v) || 0;
const r2 = (v) => Math.round(n(v) * 100) / 100;
export const onlyDigits = (s) => String(s || '').replace(/\D/g, '');
export const formatCnpj = (s) => {
  const d = onlyDigits(s);
  return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : (s || '');
};
// chave da empresa: CNPJ quando houver, senão o nome normalizado
export const companyKey = (p) => onlyDigits(p.company_cnpj) || String(p.company || 'Sem empresa').trim().toLowerCase();

// Soma de todos os holerites de uma competência (YYYY-MM): várias empresas/tipos somam.
export function payslipMonth(payslips = [], mk) {
  const list = (payslips || []).filter((p) => p.competence === mk);
  const sum = (k) => r2(list.reduce((s, p) => s + n(p[k]), 0));
  return {
    count: list.length,
    gross: sum('gross'), inss: sum('inss'), irrf: sum('irrf'), fgts: sum('fgts'),
    other: sum('other_deductions'), net: sum('net'),
    companies: [...new Set(list.map((p) => p.company || 'Empresa'))],
    list,
  };
}

// Mescla na config da Carga Tributária: se houver holerite no mês, ele manda
// (salário bruto, INSS e IRRF ficam CONFIRMADOS pelo documento).
export function salaryFromPayslips(cfg, payslips, mk) {
  const m = payslipMonth(payslips, mk);
  if (!m.count) return { ...cfg, _fromPayslip: false, _payslip: m };
  return { ...cfg, salarioBruto: m.gross, inssConfirmado: m.inss, irrfConfirmado: m.irrf, _fromPayslip: true, _payslip: m };
}

// Agrupa por empresa: [{ key, company, cnpj, list, count, gross, inss, irrf, net, fgts, last, first }]
export function groupByCompany(payslips = []) {
  const map = new Map();
  for (const p of payslips || []) {
    const k = companyKey(p);
    if (!map.has(k)) map.set(k, { key: k, company: p.company || 'Sem empresa', cnpj: p.company_cnpj || '', list: [] });
    map.get(k).list.push(p);
  }
  return [...map.values()].map((g) => {
    const list = g.list.sort((a, b) => String(b.competence).localeCompare(String(a.competence)));
    const sum = (k) => r2(list.reduce((s, p) => s + n(p[k]), 0));
    return { ...g, list, count: list.length, gross: sum('gross'), inss: sum('inss'), irrf: sum('irrf'), net: sum('net'), fgts: sum('fgts'), last: list[0]?.competence, first: list[list.length - 1]?.competence };
  }).sort((a, b) => String(b.last).localeCompare(String(a.last)));
}

// Série mensal dos últimos N meses terminando em endMk
export function payslipSeries(payslips = [], endMk, n = 12) {
  const [y, m] = endMk.split('-').map(Number);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const s = payslipMonth(payslips, mk);
    out.push({ mk, gross: s.gross, net: s.net, inss: s.inss, irrf: s.irrf, count: s.count });
  }
  return out;
}
