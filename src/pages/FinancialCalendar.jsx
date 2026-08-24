import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Transaction, CreditCardInvoice, Subscription, CreditCard, Category } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Badge } from '../components/ui';
import { formatCurrency, monthKey, monthLabel, MONTHS_PT } from '../lib/utils.js';
import { useHolidayMap } from '../lib/holidays.js';
import { ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownRight, Lock, CalendarClock, AlertTriangle, CheckCircle2 } from 'lucide-react';

const WD = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
const TYPE_DOT = { income: '#10b981', expense: '#ef4444', due: '#8b5cf6', closing: '#f59e0b', sub: '#3b82f6' };

export default function FinancialCalendar() {
  const [mk, setMk] = useState(monthKey(new Date()));
  const [sel, setSel] = useState(new Date().toISOString().slice(0, 10));

  const { data: transactions = [] } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: invoices = [] } = useQuery({ queryKey: ['invoices'], queryFn: () => CreditCardInvoice.list() });
  const { data: subs = [] } = useQuery({ queryKey: ['subscriptions'], queryFn: () => Subscription.list() });
  const { data: cards = [] } = useQuery({ queryKey: ['cards'], queryFn: () => CreditCard.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });
  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const cardMap = useMemo(() => Object.fromEntries(cards.map((c) => [c.id, c])), [cards]);

  const [y, m] = mk.split('-').map(Number);
  const holidayMap = useHolidayMap(y);
  const daysInMonth = new Date(y, m, 0).getDate();
  const firstWd = new Date(y, m - 1, 1).getDay();

  // eventos por dia (YYYY-MM-DD)
  const eventsByDay = useMemo(() => {
    const map = {};
    const push = (date, ev) => { if (!date) return; (map[date] = map[date] || []).push(ev); };
    for (const t of transactions) {
      if (String(t.date).slice(0, 7) !== mk) continue;
      if (t.type === 'income') push(t.date.slice(0, 10), { kind: 'income', label: t.description || catMap[t.category_id]?.name || 'Receita', amount: t.amount });
      else if (t.type === 'expense') push(t.date.slice(0, 10), { kind: 'expense', label: t.description || catMap[t.category_id]?.name || 'Despesa', amount: t.amount });
    }
    for (const inv of invoices) {
      const cname = cardMap[inv.card_id]?.name || 'Cartão';
      if (inv.due_date && inv.due_date.slice(0, 7) === mk) push(inv.due_date.slice(0, 10), { kind: 'due', label: `Venc. ${cname}`, amount: inv.total_amount });
      if (inv.closing_date && inv.closing_date.slice(0, 7) === mk) push(inv.closing_date.slice(0, 10), { kind: 'closing', label: `Fech. ${cname}`, amount: inv.total_amount });
    }
    for (const s of subs) {
      const day = String(Math.min(Math.max(1, Number(s.renewal_day) || 1), daysInMonth)).padStart(2, '0');
      push(`${mk}-${day}`, { kind: 'sub', label: `${s.icon_emoji || '📱'} ${s.name}`, amount: s.amount });
    }
    return map;
  }, [transactions, invoices, subs, mk, catMap, cardMap, daysInMonth]);

  const cells = [];
  for (let i = 0; i < firstWd; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${mk}-${String(d).padStart(2, '0')}`);

  const shift = (dir) => { const dt = new Date(y, m - 1 + dir, 1); setMk(monthKey(dt)); };

  const monthInsights = useMemo(() => {
    let inc = 0, exp = 0, dueTotal = 0; const byDayExp = {};
    Object.entries(eventsByDay).forEach(([date, evs]) => evs.forEach((e) => {
      if (e.kind === 'income') inc += Number(e.amount || 0);
      if (e.kind === 'expense') { exp += Number(e.amount || 0); byDayExp[date] = (byDayExp[date] || 0) + Number(e.amount || 0); }
      if (e.kind === 'due') dueTotal += Number(e.amount || 0);
    }));
    const heaviest = Object.entries(byDayExp).sort((a, b) => b[1] - a[1])[0];
    return { inc, exp, net: inc - exp, dueTotal, heaviestDay: heaviest ? { date: heaviest[0], value: heaviest[1] } : null };
  }, [eventsByDay]);

  const selEvents = eventsByDay[sel] || [];

  // próximos 14 dias
  const today = new Date(); const in14 = new Date(); in14.setDate(today.getDate() + 14);
  const upcoming = [];
  Object.entries(eventsByDay).forEach(([date, evs]) => { const dd = new Date(date + 'T00:00'); if (dd >= new Date(today.toISOString().slice(0,10)) && dd <= in14) evs.forEach((e) => upcoming.push({ date, ...e })); });
  upcoming.sort((a, b) => a.date < b.date ? -1 : 1);
  const openInvoices = invoices.filter((i) => i.status === 'open' || i.status === 'overdue');

  const kindIcon = (k) => k === 'income' ? <ArrowUpRight className="w-4 h-4" /> : k === 'expense' ? <ArrowDownRight className="w-4 h-4" /> : k === 'due' ? <CalendarClock className="w-4 h-4" /> : k === 'closing' ? <Lock className="w-4 h-4" /> : <CalendarClock className="w-4 h-4" />;

  return (
    <div className="space-y-4 animate-fadeIn">
      <PageHeader title="Calendário Financeiro" subtitle="Vencimentos, faturas e lançamentos por data" />

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 hover-lift">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-lg capitalize">{MONTHS_PT[m - 1]} {y}</h3>
            <div className="flex items-center gap-1">
              <button onClick={() => shift(-1)} className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><ChevronLeft className="w-4 h-4" /></button>
              <button onClick={() => { const t = new Date(); setMk(monthKey(t)); setSel(t.toISOString().slice(0, 10)); }} className="px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/10">Hoje</button>
              <button onClick={() => shift(1)} className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="rounded-xl p-2.5 bg-emerald-50 dark:bg-emerald-500/10"><p className="text-[11px] text-muted">Entradas</p><p className="font-bold text-emerald-600 dark:text-emerald-300 text-sm">{formatCurrency(monthInsights.inc)}</p></div>
            <div className="rounded-xl p-2.5 bg-rose-50 dark:bg-rose-500/10"><p className="text-[11px] text-muted">Saidas</p><p className="font-bold text-rose-600 dark:text-rose-300 text-sm">{formatCurrency(monthInsights.exp)}</p></div>
            <div className="rounded-xl p-2.5 bg-indigo-50 dark:bg-indigo-500/10"><p className="text-[11px] text-muted">Saldo do mês</p><p className="font-bold text-indigo-600 dark:text-indigo-300 text-sm">{formatCurrency(monthInsights.net)}</p></div>
          </div>
          <div className="grid grid-cols-7 text-center text-xs text-muted mb-2">{WD.map((d) => <div key={d}>{d}</div>)}</div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((date, i) => {
              if (!date) return <div key={i} />;
              const evs = eventsByDay[date] || [];
              const isSel = date === sel;
              const isToday = date === new Date().toISOString().slice(0, 10);
              const d = Number(date.slice(8, 10));
              const hol = holidayMap.get(date);
              return (
                <button key={i} onClick={() => setSel(date)} title={hol ? `Feriado: ${hol}` : undefined} className={`aspect-square rounded-xl p-1 flex flex-col items-center justify-start text-sm transition ${isSel ? 'bg-emerald-500 text-white' : isToday ? 'bg-emerald-50 dark:bg-emerald-500/10' : hol ? 'bg-amber-50 dark:bg-amber-500/10' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}>
                  <span className={`font-medium ${!isSel && hol ? 'text-amber-600 dark:text-amber-400' : ''}`}>{d}</span>
                  <div className="flex gap-0.5 mt-1 flex-wrap justify-center">
                    {hol && <span className="w-1.5 h-1.5 rounded-full" style={{ background: isSel ? '#fff' : '#f59e0b' }} />}
                    {evs.slice(0, 3).map((e, j) => <span key={j} className="w-1.5 h-1.5 rounded-full" style={{ background: isSel ? '#fff' : TYPE_DOT[e.kind] }} />)}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3 mt-4 text-xs text-muted">
            {[['income', 'Receita'], ['expense', 'Despesa'], ['due', 'Vencimento'], ['closing', 'Fechamento'], ['sub', 'Assinatura']].map(([k, l]) => (
              <span key={k} className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: TYPE_DOT[k] }} /> {l}</span>
            ))}
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#f59e0b' }} /> Feriado</span>
          </div>

          {monthInsights.heaviestDay && (
            <div className="mt-3 flex items-center gap-2 text-xs p-2.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="w-3.5 h-3.5" /> Dia de maior gasto: {new Date(monthInsights.heaviestDay.date + 'T00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} ({formatCurrency(monthInsights.heaviestDay.value)}){monthInsights.dueTotal > 0 ? ` · faturas a vencer: ${formatCurrency(monthInsights.dueTotal)}` : ''}
            </div>
          )}

          <div className="mt-4 border-t border-[hsl(var(--border))] pt-4">
            <p className="text-sm font-semibold mb-2">{new Date(sel + 'T00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })} — {selEvents.length} evento(s)</p>
            {holidayMap.get(sel) && <div className="mb-2 flex items-center gap-2 text-xs p-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300"><CalendarClock className="w-3.5 h-3.5" /> Feriado: {holidayMap.get(sel)} — pagamentos podem ser compensados no próximo dia útil.</div>}
            {selEvents.length === 0 ? <p className="text-sm text-muted py-3 text-center">Sem eventos neste dia.</p>
              : <div className="space-y-2">{selEvents.map((e, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: `${TYPE_DOT[e.kind]}14` }}>
                    <span style={{ color: TYPE_DOT[e.kind] }}>{kindIcon(e.kind)}</span>
                    <span className="flex-1 text-sm font-medium truncate">{e.label}</span>
                    {e.amount != null && <span className="text-sm font-semibold" style={{ color: TYPE_DOT[e.kind] }}>{formatCurrency(e.amount)}</span>}
                  </div>
                ))}</div>}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="hover-lift">
            <h3 className="font-semibold flex items-center gap-2 mb-3"><AlertTriangle className="w-4 h-4 text-amber-500" /> Próximos 14 dias</h3>
            {upcoming.length === 0 ? <div className="flex flex-col items-center py-6 text-muted"><CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" /><p className="text-sm">Nenhum vencimento próximo</p></div>
              : <div className="space-y-2">{upcoming.slice(0, 8).map((e, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="w-2 h-2 rounded-full" style={{ background: TYPE_DOT[e.kind] }} />
                    <span className="flex-1 truncate">{e.label}</span>
                    <span className="text-muted">{new Date(e.date + 'T00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                  </div>
                ))}</div>}
          </Card>
          <Card className="hover-lift">
            <h3 className="font-semibold mb-2">Faturas em aberto</h3>
            {openInvoices.length === 0 ? <p className="text-sm text-muted">Sem faturas em aberto</p>
              : openInvoices.map((inv) => (
                <div key={inv.id} className="flex justify-between text-sm py-1"><span>{cardMap[inv.card_id]?.name || 'Cartão'} · {inv.competence_month}</span><Badge color={inv.status === 'overdue' ? 'rose' : 'amber'}>{formatCurrency(inv.total_amount)}</Badge></div>
              ))}
          </Card>
        </div>
      </div>
    </div>
  );
}
