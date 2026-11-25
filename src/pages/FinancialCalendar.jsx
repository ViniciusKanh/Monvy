import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Transaction, CreditCardInvoice, Subscription, CreditCard, Category } from '../api/entities.js';
import { formatCurrency, monthKey, MONTHS_PT } from '../lib/utils.js';
import { useHolidayMap } from '../lib/holidays.js';
import { HeroTitle, Panel } from '../components/kit.jsx';
import { CalendarArt } from '../components/art/PageArt.jsx';
import { toast } from '../lib/toast.js';
import { Modal, Button } from '../components/ui';
import {
  ChevronLeft, ChevronRight, ArrowDown, ArrowUp, Lock, CalendarDays, CreditCard as CardIcon, RefreshCw, LayoutGrid, Coins, CalendarClock, Wifi, Zap, Droplet, Home, ShoppingCart,
  Car, Dumbbell, Receipt, PlayCircle, Sparkles, Lightbulb, X, ArrowRight, Shield, Check, Umbrella,
} from 'lucide-react';

const WD = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const KIND = { income: { c: '#10b981', l: 'Receita' }, expense: { c: '#f43f5e', l: 'Despesa' }, due: { c: '#3b82f6', l: 'Fatura' }, closing: { c: '#f59e0b', l: 'Fechamento' }, sub: { c: '#a855f7', l: 'Assinatura' } };
const FON = { teal: 'bg-teal-500/25 ring-teal-400 text-teal-700 dark:text-teal-100 shadow-[0_0_12px_rgba(45,212,191,.35)]', emerald: 'bg-emerald-500/20 ring-emerald-400 text-emerald-700 dark:text-emerald-100', rose: 'bg-rose-500/20 ring-rose-400 text-rose-700 dark:text-rose-100', sky: 'bg-sky-500/20 ring-sky-400 text-sky-700 dark:text-sky-100' };
const FILTERS = [['all', 'Tudo', LayoutGrid, 'teal'], ['income', 'Receitas', ArrowDown, 'emerald'], ['expense', 'Despesas', ArrowUp, 'rose'], ['invoice', 'Faturas', CardIcon, 'sky'], ['sub', 'Assinaturas', RefreshCw, 'sky']];
const ICONS = [[/internet|wi-?fi|fibra|vivo|claro|tim\b/i, Wifi], [/luz|energia|enel|eletric/i, Zap], [/agua|água|sabesp/i, Droplet], [/alug|condom|moradia/i, Home], [/mercad|super/i, ShoppingCart], [/carro|seguro|combust|uber/i, Car], [/academia|gym|fit/i, Dumbbell], [/seguro/i, Umbrella]];
const iconFor = (e) => (e.kind === 'due' || e.kind === 'closing' ? CardIcon : e.kind === 'sub' ? PlayCircle : (ICONS.find(([re]) => re.test(e.label)) || [null, e.kind === 'income' ? ArrowDown : Receipt])[1]);
const pad = (n) => String(n).padStart(2, '0');
const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysBetween = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 86400000);

export default function FinancialCalendar() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const todayIso = isoOf(new Date());
  const [mk, setMk] = useState(monthKey(new Date()));
  const [sel, setSel] = useState(todayIso);
  const [filter, setFilter] = useState('all');
  const [hideTip, setHideTip] = useState(false);
  const [listOpen, setListOpen] = useState(null);

  const { data: transactions = [] } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: invoices = [] } = useQuery({ queryKey: ['invoices'], queryFn: () => CreditCardInvoice.list() });
  const { data: subs = [] } = useQuery({ queryKey: ['subscriptions'], queryFn: () => Subscription.list() });
  const { data: cards = [] } = useQuery({ queryKey: ['cards'], queryFn: () => CreditCard.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });
  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const cardMap = useMemo(() => Object.fromEntries(cards.map((c) => [c.id, c])), [cards]);
  const pay = useMutation({ mutationFn: ({ id, done }) => Transaction.update(id, { status: done ? 'completed' : 'pending' }), onSuccess: (_, v) => { qc.invalidateQueries({ queryKey: ['transactions'] }); qc.invalidateQueries({ queryKey: ['accounts'] }); toast.success(v.done ? 'Pagamento marcado como feito' : 'Marcado como pendente'); } });

  const [y, m] = mk.split('-').map(Number);
  const holidayMap = useHolidayMap(y);
  const daysInMonth = new Date(y, m, 0).getDate();
  const firstWd = new Date(y, m - 1, 1).getDay();

  // eventos de um mês (YYYY-MM) agrupados por dia
  const eventsFor = useMemo(() => (key) => {
    const map = {};
    const dim = new Date(Number(key.slice(0, 4)), Number(key.slice(5)), 0).getDate();
    const push = (date, ev) => { if (!date) return; (map[date] = map[date] || []).push(ev); };
    for (const t of transactions) {
      if (String(t.date).slice(0, 7) !== key || (t.type !== 'income' && t.type !== 'expense')) continue;
      push(String(t.date).slice(0, 10), { id: t.id, kind: t.type, label: t.description || catMap[t.category_id]?.name || (t.type === 'income' ? 'Receita' : 'Despesa'), sub: catMap[t.category_id]?.name || (t.type === 'income' ? 'Receita' : 'Despesa'), amount: Number(t.amount || 0), pending: (t.status || 'pending') !== 'completed', tx: true });
    }
    for (const inv of invoices) {
      const cname = cardMap[inv.card_id]?.name || 'Cartão';
      if (inv.due_date && String(inv.due_date).slice(0, 7) === key && (inv.status === 'open' || inv.status === 'overdue' || inv.status === 'closed')) push(String(inv.due_date).slice(0, 10), { kind: 'due', label: `Fatura ${cname}`, sub: `Vencimento da fatura`, amount: Number(inv.total_amount || 0) });
      if (inv.closing_date && String(inv.closing_date).slice(0, 7) === key) push(String(inv.closing_date).slice(0, 10), { kind: 'closing', label: `Fechamento ${cname}`, sub: 'Fechamento da fatura', amount: Number(inv.total_amount || 0) });
    }
    for (const s of subs) { if (s.is_active === false) continue; push(`${key}-${pad(Math.min(Math.max(1, Number(s.renewal_day) || 1), dim))}`, { kind: 'sub', label: `Assinatura ${s.name}`, sub: 'Assinatura mensal', amount: Number(s.amount || 0) }); }
    return map;
  }, [transactions, invoices, subs, catMap, cardMap]);

  const eventsByDay = useMemo(() => eventsFor(mk), [eventsFor, mk]);
  const match = (e) => filter === 'all' || (filter === 'invoice' ? e.kind === 'due' || e.kind === 'closing' : e.kind === filter);
  const totals = useMemo(() => { let inc = 0, exp = 0; Object.values(eventsByDay).flat().forEach((e) => { if (e.kind === 'income') inc += e.amount; if (e.kind === 'expense') exp += e.amount; }); return { inc, exp, net: inc - exp }; }, [eventsByDay]);

  // próximos dias (atravessa a virada do mês)
  const upcoming = useMemo(() => {
    const now = new Date(); const keys = [monthKey(now), monthKey(new Date(now.getFullYear(), now.getMonth() + 1, 1))];
    const out = [];
    for (const k of keys) for (const [date, evs] of Object.entries(eventsFor(k))) { const d = daysBetween(todayIso, date); if (d < 0 || d > 30) continue; for (const e of evs) if (e.kind !== 'income' && e.kind !== 'closing' && (!e.tx || e.pending)) out.push({ ...e, date, in: d }); }
    return out.sort((a, b) => a.date.localeCompare(b.date) || b.amount - a.amount);
  }, [eventsFor, todayIso]);
  const next14 = upcoming.filter((e) => e.in <= 14);
  const next7 = upcoming.filter((e) => e.in <= 7);
  const important = [...upcoming].sort((a, b) => b.amount - a.amount).slice(0, 4).sort((a, b) => a.date.localeCompare(b.date));
  const openInvoices = invoices.filter((i) => i.status === 'open' || i.status === 'overdue').sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));

  const selEvents = (eventsFor(sel.slice(0, 7))[sel] || []);
  const cells = []; for (let i = 0; i < firstWd; i++) cells.push(null); for (let d = 1; d <= daysInMonth; d++) cells.push(`${mk}-${pad(d)}`);
  const shift = (dir) => setMk(monthKey(new Date(y, m - 1 + dir, 1)));
  const dmy = (iso) => { const d = new Date(`${iso}T12:00:00`); return [pad(d.getDate()), MES[d.getMonth()]]; };

  const Kpi = ({ icon: Ic, tone, label, value }) => {
    const T = { emerald: 'ring-emerald-400/50 from-emerald-500/20 text-emerald-400', rose: 'ring-rose-400/50 from-rose-500/20 text-rose-400', violet: 'ring-violet-400/50 from-violet-500/20 text-violet-300', amber: 'ring-amber-400/60 from-amber-500/25 text-amber-400', sky: 'ring-sky-400/50 from-sky-500/20 text-sky-400' }[tone];
    return <div className={`rounded-2xl ring-1 bg-gradient-to-br to-transparent bg-[hsl(var(--card))] px-4 py-3 flex items-center gap-3 min-w-0 ${T.split(' ').slice(0, 2).join(' ')}`}><span className={`w-11 h-11 rounded-full grid place-items-center bg-black/10 dark:bg-white/5 ring-1 ring-current/30 shrink-0 ${T.split(' ')[2]}`}><Ic className="w-6 h-6" /></span><div className="min-w-0"><p className="text-xs text-muted truncate">{label}</p><p className="font-display text-xl font-bold truncate">{value}</p></div></div>;
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_420px] gap-4 items-start">
        <div className="space-y-4 min-w-0">
          <HeroTitle icon={CalendarDays} lead="Calendário Financeiro" accent="" iconClass="text-cyan-400" subtitle="Vencimentos, faturas e lançamentos por data" />
        </div>
        <CalendarArt className="hidden 2xl:block w-[400px] h-40 -mb-10" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 relative z-[1]">
        <Kpi icon={ArrowDown} tone="emerald" label="Entradas do mês" value={formatCurrency(totals.inc)} />
        <Kpi icon={ArrowUp} tone="rose" label="Saídas do mês" value={formatCurrency(totals.exp)} />
        <Kpi icon={Coins} tone="violet" label="Saldo do mês" value={formatCurrency(totals.net)} />
        <Kpi icon={CalendarClock} tone="amber" label="Próximos 7 dias" value={`${next7.length} ${next7.length === 1 ? 'vencimento' : 'vencimentos'}`} />
        <Kpi icon={CardIcon} tone="sky" label="Faturas em aberto" value={`${openInvoices.length} ${openInvoices.length === 1 ? 'fatura' : 'faturas'}`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <Panel className="xl:col-span-8" tone="violet" glow>
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <h2 className="font-display text-2xl font-bold flex items-center gap-2 mr-auto"><CalendarDays className="w-7 h-7 text-cyan-400" />{MONTHS_PT[m - 1]} {y}</h2>
            <div className="flex items-center gap-1">
              <button onClick={() => shift(-1)} className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10" aria-label="Mês anterior"><ChevronLeft className="w-5 h-5" /></button>
              <button onClick={() => { setMk(monthKey(new Date())); setSel(todayIso); }} className="px-4 py-1.5 rounded-xl ring-1 ring-[hsl(var(--border))] text-sm font-semibold">Hoje</button>
              <button onClick={() => shift(1)} className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10" aria-label="Próximo mês"><ChevronRight className="w-5 h-5" /></button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map(([v, l, Ic, t]) => <button key={v} onClick={() => setFilter(v)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold ring-1 transition ${filter === v ? FON[t] : 'ring-[hsl(var(--border))] text-muted'}`}><Ic className="w-3.5 h-3.5" />{l}</button>)}
            </div>
          </div>
          <div className="grid grid-cols-7 text-center text-xs font-semibold text-muted mb-2">{WD.map((d) => <div key={d}>{d}</div>)}</div>
          <div className="grid grid-cols-7 gap-1.5">
            {cells.map((date, i) => {
              if (!date) return <div key={i} />;
              const evs = (eventsByDay[date] || []).filter(match);
              const isSel = date === sel; const isToday = date === todayIso; const hol = holidayMap.get(date); const d = Number(date.slice(8));
              return (
                <button key={i} onClick={() => setSel(date)} title={hol ? `Feriado: ${hol}` : undefined}
                  className={`relative rounded-xl ring-1 text-center transition min-h-[64px] px-1 py-1.5 ${isSel ? 'ring-2 ring-cyan-300 bg-gradient-to-b from-cyan-500/30 to-violet-500/20 shadow-[0_0_22px_rgba(34,211,238,.45)] z-[2]' : hol ? 'ring-amber-400/70 bg-amber-500/20' : isToday ? 'ring-teal-400/70 bg-teal-500/10' : 'ring-[hsl(var(--border))] bg-black/[.02] dark:bg-white/[.03] hover:ring-cyan-400/50'}`}>
                  <span className={`font-display font-bold ${isSel ? 'text-xl' : 'text-lg'} ${hol && !isSel ? 'text-amber-600 dark:text-amber-300' : ''}`}>{d}</span>
                  {isSel && evs.length > 0 ? (
                    <div className="space-y-1 mt-1 text-left">
                      {evs.slice(0, 3).map((e, k) => { const Ic = iconFor(e); return <div key={k} className="flex items-center gap-1 rounded-md bg-black/25 px-1.5 py-0.5 text-[10px] truncate"><Ic className="w-3 h-3 shrink-0" style={{ color: KIND[e.kind].c }} /><span className="truncate">{e.label}</span></div>; })}
                      {evs.length > 3 && <p className="text-[10px] text-center">+{evs.length - 3} lançamentos</p>}
                    </div>
                  ) : <div className="flex gap-0.5 mt-1 justify-center">{hol && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}{evs.slice(0, 4).map((e, j) => <span key={j} className="w-2 h-2 rounded-full" style={{ background: KIND[e.kind].c }} />)}</div>}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3 mt-3 text-xs text-muted">{Object.entries(KIND).map(([k, v]) => <span key={k} className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: v.c }} />{v.l}</span>)}<span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />Feriado</span></div>
        </Panel>

        <div className="xl:col-span-4 space-y-4">
          <Panel tone="violet" title="Próximos 14 dias" icon={CalendarDays} iconClass="text-cyan-400" action={<button onClick={() => setListOpen('upcoming')} className="text-xs text-muted hover:text-[hsl(var(--text))] flex items-center gap-1">Ver todos<ArrowRight className="w-3.5 h-3.5" /></button>}>
            {next14.length === 0 ? <p className="text-sm text-muted">Nenhum vencimento nos próximos 14 dias.</p> : next14.slice(0, 4).map((e, k) => { const Ic = iconFor(e); const [dd, mm] = dmy(e.date); return (
              <div key={k} className="flex items-center gap-2.5 py-1.5">
                <span className="w-11 rounded-lg ring-1 ring-[hsl(var(--border))] text-center py-0.5 shrink-0"><b className="block text-sm leading-tight">{dd}</b><span className="text-[10px] text-muted">{mm}</span></span>
                <Ic className="w-6 h-6 shrink-0" style={{ color: KIND[e.kind].c }} />
                <div className="flex-1 min-w-0"><p className="text-sm font-semibold truncate">{e.label}</p><p className="text-[11px] text-muted truncate">{e.sub}</p></div>
                <div className="text-right"><p className="text-sm font-bold">{formatCurrency(e.amount)}</p><span className="text-[10px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-muted">{e.in === 0 ? 'Hoje' : e.in === 1 ? 'Amanhã' : `Em ${e.in} dias`}</span></div>
              </div>); })}
          </Panel>
          <Panel tone="violet" title="Faturas em aberto" icon={CardIcon} iconClass="text-fuchsia-400" action={<button onClick={() => nav('/cartoes')} className="text-xs text-muted hover:text-[hsl(var(--text))] flex items-center gap-1">Ver todas<ArrowRight className="w-3.5 h-3.5" /></button>}>
            {openInvoices.length === 0 ? <p className="text-sm text-muted">Sem faturas em aberto.</p> : openInvoices.slice(0, 3).map((inv) => { const c = cardMap[inv.card_id]; return (
              <div key={inv.id} className="flex items-center gap-3 py-1.5">
                <span className="w-11 h-8 rounded-lg grid place-items-center text-white text-xs font-black shrink-0" style={{ background: `linear-gradient(135deg, ${c?.color || '#7c3aed'}, ${c?.color || '#7c3aed'}99)` }}>{(c?.name || 'C').slice(0, 2).toUpperCase()}</span>
                <div className="flex-1 min-w-0"><p className="text-sm font-semibold truncate">{c?.name || 'Cartão'}</p><p className="text-[11px] text-muted">{inv.due_date ? `Vence em ${dmy(String(inv.due_date).slice(0, 10)).join(' de ')}` : inv.competence_month}{inv.status === 'overdue' && <b className="text-rose-500"> • vencida</b>}</p></div>
                <b className="text-sm">{formatCurrency(inv.total_amount)}</b>
              </div>); })}
          </Panel>
          <Panel tone="violet" title={<span>Agenda do dia <span className="text-sm font-normal text-muted">— {new Date(`${sel}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}</span></span>} icon={CalendarDays} iconClass="text-fuchsia-400">
            {holidayMap.get(sel) && <p className="text-xs rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-300 px-2.5 py-1.5 mb-2">Feriado: {holidayMap.get(sel)} — pagamentos podem ser compensados no próximo dia útil.</p>}
            {selEvents.length === 0 ? <p className="text-sm text-muted">Sem eventos neste dia.</p> : <div className="max-h-56 overflow-y-auto pr-1">{selEvents.map((e, k) => { const Ic = iconFor(e); const done = e.tx && !e.pending; return (
              <div key={k} className="flex items-center gap-2.5 py-1.5">
                {e.tx ? <button onClick={() => pay.mutate({ id: e.id, done: !done })} aria-label={done ? 'Marcar como pendente' : 'Marcar como pago'} className={`w-5 h-5 rounded-md ring-1 grid place-items-center shrink-0 ${done ? 'bg-emerald-500 ring-emerald-400 text-white' : 'ring-[hsl(var(--border))]'}`}>{done && <Check className="w-3.5 h-3.5" />}</button> : <span className="w-5 h-5 shrink-0" title="Evento automático" />}
                <Ic className="w-5 h-5 shrink-0" style={{ color: KIND[e.kind].c }} />
                <span className={`flex-1 text-sm truncate ${done ? 'line-through text-muted' : ''}`}>{e.kind === 'income' ? 'Receber' : e.kind === 'closing' ? '' : 'Pagar'} {e.label}</span>
                <b className={`text-sm ${e.kind === 'income' ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-500'}`}>{formatCurrency(e.amount)}</b>
              </div>); })}</div>}
          </Panel>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <Panel className="xl:col-span-7" tone="violet" title="Próximos eventos importantes" icon={CalendarDays} iconClass="text-fuchsia-400" action={<button onClick={() => setListOpen('upcoming')} className="text-xs text-muted hover:text-[hsl(var(--text))] flex items-center gap-1">Ver linha do tempo<ArrowRight className="w-3.5 h-3.5" /></button>}>
          {important.length === 0 ? <p className="text-sm text-muted">Nada relevante nos próximos 30 dias.</p> : (
            <div className="relative">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {important.map((e, k) => { const Ic = iconFor(e); const [dd, mm] = dmy(e.date); return (
                  <div key={k} className="relative rounded-xl ring-1 ring-[hsl(var(--border))] px-2.5 py-2 flex items-center gap-2 mb-6">
                    <span className="text-center shrink-0"><b className="block leading-tight">{dd}</b><span className="text-[10px] text-muted">{mm}</span></span>
                    <Ic className="w-6 h-6 shrink-0" style={{ color: KIND[e.kind].c }} />
                    <div className="min-w-0"><p className="text-xs font-semibold truncate">{e.label}</p><p className="text-sm font-bold" style={{ color: KIND[e.kind].c }}>{formatCurrency(e.amount)}</p></div>
                    <span className="absolute -bottom-[22px] left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full ring-4 ring-[hsl(var(--card))]" style={{ background: KIND[e.kind].c, boxShadow: `0 0 10px ${KIND[e.kind].c}` }} />
                  </div>); })}
              </div>
              <div className="absolute left-2 right-2 bottom-[13px] h-0.5 bg-gradient-to-r from-cyan-400 via-violet-500 to-fuchsia-500 -z-0" />
            </div>
          )}
        </Panel>
        {!hideTip && (
          <Panel className="xl:col-span-5" tone="violet" title={<span className="flex items-center gap-2">Lembretes <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-violet-500/20 ring-1 ring-violet-400/50 text-violet-600 dark:text-violet-200">Auto</span></span>} icon={Sparkles} iconClass="text-fuchsia-400" action={<button onClick={() => setHideTip(true)} aria-label="Fechar" className="p-1 rounded-lg text-muted hover:text-[hsl(var(--text))]"><X className="w-4 h-4" /></button>}>
            <div className="rounded-2xl ring-1 ring-violet-400/40 bg-violet-500/10 p-4 flex items-center gap-3">
              <Lightbulb className="w-8 h-8 text-amber-400 shrink-0" />
              <p className="flex-1 text-sm">{next7.length ? <>Você tem <b>{next7.length} {next7.length === 1 ? 'vencimento' : 'vencimentos'}</b> nos próximos 7 dias, somando <b>{formatCurrency(next7.reduce((s, e) => s + e.amount, 0))}</b>. Quer receber avisos antes de vencer?</> : 'Nenhum vencimento nos próximos 7 dias. Configure avisos para não perder os próximos.'}</p>
              <button onClick={() => nav('/notificacoes')} className="shrink-0 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-sky-500 to-blue-600 shadow-[0_0_18px_rgba(56,189,248,.4)]">Configurar agora</button>
            </div>
          </Panel>
        )}
      </div>

      <Modal open={!!listOpen} onClose={() => setListOpen(null)} title="Próximos 30 dias" maxWidth="max-w-xl" footer={<Button onClick={() => setListOpen(null)}>Fechar</Button>}>
        <div className="divide-y divide-[hsl(var(--border))] max-h-[60vh] overflow-y-auto">
          {upcoming.length ? upcoming.map((e, k) => { const Ic = iconFor(e); return <div key={k} className="flex items-center gap-3 py-2"><Ic className="w-5 h-5" style={{ color: KIND[e.kind].c }} /><div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{e.label}</p><p className="text-xs text-muted">{new Date(`${e.date}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })} • {KIND[e.kind].l}</p></div><b className="text-sm">{formatCurrency(e.amount)}</b></div>; }) : <p className="text-sm text-muted py-6 text-center">Nada previsto.</p>}
        </div>
      </Modal>
    </div>
  );
}
