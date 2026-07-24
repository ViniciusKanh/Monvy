export function cn(...args) {
  return args.flat().filter(Boolean).join(' ');
}

export function formatCurrency(v) {
  const n = Number(v || 0);
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
}

export function fmtK(v) {
  const n = Number(v || 0);
  const abs = Math.abs(n);
  if (abs >= 1e6) return `R$${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `R$${(n / 1e3).toFixed(1)}k`;
  return formatCurrency(n);
}

export function monthKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function inMonth(dateStr, mk) {
  if (!dateStr) return false;
  return String(dateStr).slice(0, 7) === mk;
}

export const MONTHS_PT = ['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export function monthLabel(mk) {
  const [y, m] = mk.split('-').map(Number);
  return `${MONTHS_PT[m - 1]} ${y}`;
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// Lista de meses de "back" atras ate "forward" a frente (mais recente primeiro)
export function monthRange(back = 12, forward = 3) {
  const now = new Date();
  const arr = [];
  for (let i = -forward; i <= back; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    arr.push(monthKey(d));
  }
  return arr; // ja vem do futuro -> passado
}
