import { useMemo, useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Transaction, CreditCardInvoice, Subscription, Category, Account, Notification } from '../api/entities.js';
import { computeAlerts } from '../lib/analytics.js';
import { getFxAlerts, isHit } from '../lib/fxAlerts.js';
import { Bell, AlertTriangle, CalendarClock, PiggyBank, Zap, Wallet, TrendingDown, CheckCircle2, DollarSign, Ticket, FileText, CheckCheck } from 'lucide-react';

const KIND_ICON = { overdue: AlertTriangle, invoice: CalendarClock, budget: PiggyBank, anomaly: Zap, balance: Wallet, savings: TrendingDown, fx: DollarSign, reminder: CalendarClock, summary: FileText, ticket: Ticket, alert: Zap, info: Bell };

async function fetchFx() {
  const r = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL,BTC-BRL');
  if (!r.ok) throw new Error('fx');
  return r.json();
}
const fmtBRL = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const SEV = { danger: 'text-rose-500 bg-rose-500/10', warn: 'text-amber-500 bg-amber-500/10', info: 'text-sky-500 bg-sky-500/10' };

export function AlertsBell({ dark }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const { data: transactions = [] } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: invoices = [] } = useQuery({ queryKey: ['invoices'], queryFn: () => CreditCardInvoice.list() });
  const { data: subscriptions = [] } = useQuery({ queryKey: ['subscriptions'], queryFn: () => Subscription.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => Account.list() });
  const { data: notifications = [] } = useQuery({ queryKey: ['notifications'], queryFn: () => Notification.list({ _limit: 50 }), refetchInterval: 120_000 });
  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);

  const baseAlerts = useMemo(() => computeAlerts({ transactions, invoices, subscriptions, categories, accounts, catMap }), [transactions, invoices, subscriptions, categories, accounts, catMap]);
  const { data: fx } = useQuery({ queryKey: ['fx-bell'], queryFn: fetchFx, retry: 1, staleTime: 30_000, refetchInterval: 60_000 });
  const fxAlerts = useMemo(() => {
    if (!fx) return [];
    return getFxAlerts().map((a) => {
      const cur = Number((fx[`${a.code}BRL`] || {}).bid) || 0;
      if (!isHit(a, cur)) return null;
      return { id: a.id, kind: 'fx', severity: 'info', title: `${a.code} ${a.dir === 'above' ? 'passou de' : 'caiu abaixo de'} ${fmtBRL(a.value)}`, text: `Cotacao atual: ${fmtBRL(cur)}`, path: '/mercado' };
    }).filter(Boolean);
  }, [fx]);

  const alerts = useMemo(() => [...fxAlerts, ...baseAlerts], [fxAlerts, baseAlerts]);
  const unread = useMemo(() => notifications.filter((n) => !n.read), [notifications]);
  const count = unread.length + alerts.length;

  const markRead = useMutation({ mutationFn: (id) => Notification.update(id, { read: true }), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });
  const markAll = useMutation({ mutationFn: async () => { for (const n of unread) await Notification.update(n.id, { read: true }); }, onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });
  const openNotif = (n) => { markRead.mutate(n.id); setOpen(false); if (n.path) navigate(n.path); };

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className={`p-2 rounded-lg relative ${dark ? 'hover:bg-white/10' : 'hover:bg-black/5 dark:hover:bg-white/10'}`}>
        <Bell className="w-5 h-5" />
        {count > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center animate-[popIn_.3s_ease]">{count > 9 ? '9+' : count}</span>}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] card p-0 z-50 overflow-hidden animate-[popIn_.15s_ease]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--border))]">
            <h4 className="font-semibold text-sm text-[hsl(var(--text))] flex items-center gap-2"><Bell className="w-4 h-4" /> Notificacoes</h4>
            {unread.length > 0 && <button onClick={() => markAll.mutate()} className="text-xs text-emerald-600 font-semibold flex items-center gap-1"><CheckCheck className="w-3.5 h-3.5" /> Marcar lidas</button>}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {count === 0 ? (
              <div className="flex flex-col items-center py-10 text-muted"><CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" /><p className="text-sm text-[hsl(var(--text))] font-medium">Tudo em dia!</p><p className="text-xs">Nenhuma notificacao no momento.</p></div>
            ) : (
              <>
                {unread.length > 0 && <p className="px-4 pt-2 pb-1 text-[10px] font-bold tracking-widest text-muted">RECENTES</p>}
                {unread.map((n) => { const Icon = KIND_ICON[n.kind] || Bell; return (
                  <button key={n.id} onClick={() => openNotif(n)} className="w-full flex items-start gap-3 px-4 py-3 hover:bg-black/5 dark:hover:bg-white/5 text-left border-b border-[hsl(var(--border))]">
                    <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-emerald-500 bg-emerald-500/10"><Icon className="w-4 h-4" /></span>
                    <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[hsl(var(--text))] leading-tight">{n.title}</p><p className="text-xs text-muted leading-tight mt-0.5">{n.text}</p><p className="text-[10px] text-muted mt-0.5">{n.created_date ? new Date(n.created_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</p></div>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mt-1" />
                  </button>
                ); })}
                {alerts.length > 0 && <p className="px-4 pt-2 pb-1 text-[10px] font-bold tracking-widest text-muted">AGORA</p>}
                {alerts.map((a) => { const Icon = KIND_ICON[a.kind] || Bell; return (
                  <button key={a.id} onClick={() => { setOpen(false); navigate(a.path); }} className="w-full flex items-start gap-3 px-4 py-3 hover:bg-black/5 dark:hover:bg-white/5 text-left border-b border-[hsl(var(--border))] last:border-0">
                    <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${SEV[a.severity]}`}><Icon className="w-4 h-4" /></span>
                    <div className="min-w-0"><p className="text-sm font-semibold text-[hsl(var(--text))] leading-tight">{a.title}</p><p className="text-xs text-muted leading-tight mt-0.5">{a.text}</p></div>
                  </button>
                ); })}
              </>
            )}
          </div>
          <button onClick={() => { setOpen(false); navigate('/notificacoes'); }} className="w-full text-center text-xs text-emerald-600 font-semibold py-2.5 border-t border-[hsl(var(--border))] hover:bg-black/5 dark:hover:bg-white/5">Ver todas</button>
        </div>
      )}
    </div>
  );
}
