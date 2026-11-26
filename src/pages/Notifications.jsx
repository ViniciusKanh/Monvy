import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Notification, Transaction } from '../api/entities.js';
import { Spinner } from '../components/ui';
import { HeroTitle, Panel, Donut, KebabMenu, Pager } from '../components/kit.jsx';
import { BellArt } from '../components/art/PageArt.jsx';
import { formatCurrency } from '../lib/utils.js';
import { Bell, CheckCheck, Trash2, CalendarClock, AlertTriangle, DollarSign, Sparkles, Settings, LayoutGrid, Circle, Wallet, CalendarDays, MailOpen, Mail, ArrowRight } from 'lucide-react';

// agrupamento dos tipos de alerta que o Monvy gera
const GROUPS = [
  { id: 'contas', label: 'Contas', kpi: 'Contas a vencer', sub: 'vencidas e próximas', kinds: ['overdue', 'invoice', 'reminder'], icon: CalendarClock, c: '#fb7185', action: 'Resolver' },
  { id: 'orcamento', label: 'Orçamento', kpi: 'Alertas de orçamento', sub: 'gastos fora do previsto', kinds: ['budget', 'anomaly', 'savings'], icon: AlertTriangle, c: '#fbbf24', action: 'Ver gastos' },
  { id: 'saldo', label: 'Saldo', kpi: 'Saldo e contas', sub: 'saldo negativo/baixo', kinds: ['balance'], icon: Wallet, c: '#34d399', action: 'Ver contas' },
  { id: 'cambio', label: 'Câmbio', kpi: 'Alertas de câmbio', sub: 'alvos de cotação', kinds: ['fx'], icon: DollarSign, c: '#818cf8', action: 'Ver câmbio' },
  { id: 'resumos', label: 'Resumos', kpi: 'Resumos', sub: 'relatórios automáticos', kinds: ['summary'], icon: Sparkles, c: '#c084fc', action: 'Ver resumo' },
  { id: 'sistema', label: 'Sistema', kpi: 'Sistema', sub: 'suporte e avisos', kinds: ['ticket', 'info', 'alert'], icon: Settings, c: '#94a3b8', action: 'Abrir' },
];
const groupOf = (kind) => GROUPS.find((g) => g.kinds.includes(kind)) || GROUPS[GROUPS.length - 1];
const ago = (d) => { if (!d) return ''; const m = Math.round((Date.now() - new Date(d).getTime()) / 60000); if (m < 1) return 'agora'; if (m < 60) return `há ${m} min`; const h = Math.round(m / 60); if (h < 24) return `há ${h} h`; const dd = Math.round(h / 24); return dd === 1 ? 'ontem' : dd < 30 ? `há ${dd} dias` : new Date(d).toLocaleDateString('pt-BR'); };
const PER = 8;

export default function Notifications() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data: items = [], isLoading } = useQuery({ queryKey: ['notifications'], queryFn: () => Notification.list() });
  const { data: txs = [] } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const [tab, setTab] = useState('all');
  const [page, setPage] = useState(1);

  const list = useMemo(() => [...items].sort((a, b) => String(b.created_date || '').localeCompare(String(a.created_date || ''))), [items]);
  const unread = list.filter((n) => !n.read);
  const byGroup = useMemo(() => Object.fromEntries(GROUPS.map((g) => [g.id, list.filter((n) => groupOf(n.kind).id === g.id)])), [list]);
  const shown = tab === 'all' ? list : tab === 'unread' ? unread : byGroup[tab] || [];
  const pages = Math.max(1, Math.ceil(shown.length / PER)); const cur = Math.min(page, pages);

  const inval = () => qc.invalidateQueries({ queryKey: ['notifications'] });
  const setRead = useMutation({ mutationFn: ({ id, read }) => Notification.update(id, { read }), onSuccess: inval });
  const del = useMutation({ mutationFn: (id) => Notification.remove(id), onSuccess: inval });
  const markAll = useMutation({ mutationFn: async () => { for (const n of unread) await Notification.update(n.id, { read: true }); }, onSuccess: inval });
  const clearRead = useMutation({ mutationFn: async () => { for (const n of list.filter((x) => x.read)) await Notification.remove(n.id); }, onSuccess: inval });
  const openN = (n) => { if (!n.read) setRead.mutate({ id: n.id, read: true }); if (n.path) nav(n.path); };

  // próximos lembretes: lançamentos pendentes dos próximos 30 dias
  const today = new Date().toISOString().slice(0, 10);
  const lim = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  const upcoming = useMemo(() => txs.filter((t) => (t.status || 'pending') === 'pending' && t.type !== 'transfer' && String(t.date).slice(0, 10) >= today && String(t.date).slice(0, 10) <= lim).sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(0, 4), [txs, today, lim]);
  const dueWeek = txs.filter((t) => (t.status || 'pending') === 'pending' && t.type === 'expense' && String(t.date).slice(0, 10) >= today && String(t.date).slice(0, 10) <= new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10));

  const donut = GROUPS.map((g) => ({ name: g.label, value: byGroup[g.id].length, color: g.c })).filter((d) => d.value > 0);
  const kpis = GROUPS.filter((g) => g.id !== 'saldo' || byGroup.saldo.length).slice(0, 5);
  const urgent = unread.filter((n) => ['contas', 'orcamento', 'saldo'].includes(groupOf(n.kind).id));
  const resumo = list.length === 0 ? 'Nenhum alerta por enquanto — está tudo em dia.' : unread.length === 0 ? 'Você leu todos os alertas. Bom trabalho!' : `Você tem ${unread.length} alerta${unread.length > 1 ? 's' : ''} não lido${unread.length > 1 ? 's' : ''}${urgent.length ? `, ${urgent.length} sobre contas, orçamento ou saldo` : ''}.`;
  const resumoSub = [dueWeek.length ? `${dueWeek.length} conta(s) vencem nos próximos 7 dias (${formatCurrency(dueWeek.reduce((s, t) => s + Number(t.amount || 0), 0))}).` : null, byGroup.orcamento.some((n) => !n.read) ? 'Fique de olho no orçamento do mês.' : null].filter(Boolean).join(' ');
  const TABS = [['all', 'Todas', LayoutGrid, list.length], ['unread', 'Não lidas', Circle, unread.length], ...GROUPS.filter((g) => byGroup[g.id].length).map((g) => [g.id, g.label, g.icon, byGroup[g.id].length])];

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="relative">
        <HeroTitle icon={Bell} lead="" accent="Notificações" iconClass="text-sky-400" subtitle="Central de alertas, lembretes e resumos automáticos." />
        <div className="hidden xl:flex absolute right-0 -top-4 items-center gap-2 pointer-events-none select-none">
          <BellArt className="w-80 h-36 opacity-95" />
          <div className="w-64"><p className="font-display text-lg font-bold">O Monvy te mantém no controle</p><p className="text-sm text-muted">Prazos, orçamento, câmbio e resumos em um só lugar.</p></div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {kpis.map((g) => { const all = byGroup[g.id].length; const un = byGroup[g.id].filter((n) => !n.read).length; return (
          <button key={g.id} onClick={() => { setTab(g.id); setPage(1); }} className={`text-left rounded-2xl ring-1 bg-[hsl(var(--card))] p-4 flex items-center gap-3 transition ${tab === g.id ? 'ring-2' : ''}`} style={{ '--tw-ring-color': `${g.c}88`, backgroundImage: `linear-gradient(135deg,${g.c}2a,transparent 70%)`, boxShadow: `0 0 24px -12px ${g.c}` }}>
            <span className="w-12 h-12 rounded-xl grid place-items-center shrink-0" style={{ background: `${g.c}26`, color: g.c }}><g.icon className="w-6 h-6" /></span>
            <span className="min-w-0"><b className="font-display text-2xl block leading-tight">{all}</b><b className="text-sm block truncate">{g.kpi}</b><span className="text-[11px] text-muted">{un ? `${un} não lida(s)` : g.sub}</span></span>
          </button>); })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map(([v, l, Ic, n]) => <button key={v} onClick={() => { setTab(v); setPage(1); }} className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold ring-1 transition ${tab === v ? 'bg-sky-500 text-white ring-sky-400 shadow-[0_0_16px_rgba(56,189,248,.45)]' : 'ring-[hsl(var(--border))] bg-[hsl(var(--card))] text-muted hover:text-[hsl(var(--text))]'}`}><Ic className="w-4 h-4" />{l} ({n})</button>)}
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => markAll.mutate()} disabled={!unread.length || markAll.isPending} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold ring-1 ring-[hsl(var(--border))] bg-[hsl(var(--card))] disabled:opacity-50"><CheckCheck className="w-4 h-4" />Marcar todas como lidas</button>
          <KebabMenu items={[{ label: 'Limpar lidas', icon: Trash2, danger: true, onClick: () => clearRead.mutate() }]} />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-8 space-y-2.5">
          {isLoading ? <div className="flex justify-center py-16"><Spinner className="w-7 h-7 text-sky-500" /></div>
            : shown.length === 0 ? <div className="rounded-2xl ring-1 ring-[hsl(var(--border))] bg-[hsl(var(--card))] p-10 text-center"><Bell className="w-10 h-10 mx-auto text-sky-400" /><p className="font-semibold mt-2">Sem notificações aqui</p><p className="text-sm text-muted">Alertas de contas, orçamento, câmbio e resumos aparecem nesta lista.</p></div>
            : shown.slice((cur - 1) * PER, cur * PER).map((n) => { const g = groupOf(n.kind); return (
              <div key={n.id} className={`rounded-2xl ring-1 bg-[hsl(var(--card))] p-3.5 flex items-start sm:items-center gap-3 transition ${!n.read ? 'ring-2' : 'ring-[hsl(var(--border))]'}`} style={!n.read ? { '--tw-ring-color': `${g.c}66`, backgroundImage: `linear-gradient(90deg,${g.c}1f,transparent 55%)` } : undefined}>
                <span className={`w-2 h-2 rounded-full shrink-0 mt-2 sm:mt-0 ${n.read ? 'bg-transparent' : 'bg-sky-400'}`} />
                <span className="w-11 h-11 rounded-xl grid place-items-center shrink-0 ring-1" style={{ background: `${g.c}22`, color: g.c, '--tw-ring-color': `${g.c}55` }}><g.icon className="w-5 h-5" /></span>
                <button onClick={() => openN(n)} className="flex-1 min-w-0 text-left">
                  <p className={`leading-tight ${n.read ? 'font-medium' : 'font-bold'}`}>{n.title}</p>
                  {n.text && <p className="text-sm text-muted leading-snug mt-0.5">{n.text}</p>}
                </button>
                <div className="hidden sm:flex flex-col items-start gap-1 w-24 shrink-0"><span className="text-[11px] font-semibold px-2 py-0.5 rounded-full ring-1" style={{ color: g.c, '--tw-ring-color': `${g.c}66`, background: `${g.c}1a` }}>{g.label}</span><span className="text-[11px] text-muted">{ago(n.created_date)}</span></div>
                {n.path ? <button onClick={() => openN(n)} className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold ring-1 ${!n.read && g.id === 'contas' ? 'bg-sky-500 text-white ring-sky-400' : 'ring-[hsl(var(--border))] hover:bg-black/5 dark:hover:bg-white/10'}`}>{g.action}</button>
                  : !n.read ? <button onClick={() => setRead.mutate({ id: n.id, read: true })} className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold ring-1 ring-[hsl(var(--border))]">Marcar como lida</button> : null}
                <KebabMenu items={[n.read ? { label: 'Marcar como não lida', icon: Mail, onClick: () => setRead.mutate({ id: n.id, read: false }) } : { label: 'Marcar como lida', icon: MailOpen, onClick: () => setRead.mutate({ id: n.id, read: true }) }, { label: 'Excluir', icon: Trash2, danger: true, onClick: () => del.mutate(n.id) }]} />
              </div>); })}
          {pages > 1 && <div className="flex justify-end pt-1"><Pager page={cur} pages={pages} onPage={setPage} /></div>}
        </div>

        <div className="xl:col-span-4 space-y-4">
          <section className="rounded-3xl ring-1 ring-violet-400/50 shadow-[0_0_30px_-12px_rgba(139,92,246,.6)] bg-[hsl(var(--card))] p-5" style={{ backgroundImage: 'linear-gradient(135deg,rgba(139,92,246,.22),transparent 70%)' }}>
            <div className="flex items-center justify-between"><h3 className="font-semibold text-lg flex items-center gap-2"><Sparkles className="w-5 h-5 text-fuchsia-400" />Resumo do dia</h3><span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-violet-500/15 text-violet-600 dark:text-violet-300 ring-1 ring-violet-400/40">Auto</span></div>
            <div className="mt-3 rounded-2xl ring-1 ring-violet-400/30 bg-black/[.03] dark:bg-white/[.03] p-4"><p className="font-display text-lg font-bold">{resumo}</p>{resumoSub && <p className="text-sm text-muted mt-1">{resumoSub}</p>}</div>
          </section>
          <Panel tone="sky" title="Notificações por categoria" icon={LayoutGrid} iconClass="text-sky-400">
            <div className="flex items-center gap-5">
              <Donut size={140} thickness={0.24} data={donut} center={<><b className="font-display text-2xl">{list.length}</b><span className="text-xs text-muted">alertas</span></>} />
              <div className="flex-1 space-y-1.5 text-sm">{GROUPS.filter((g) => byGroup[g.id].length).map((g) => <p key={g.id} className="flex items-center gap-2"><i className="w-2.5 h-2.5 rounded-full" style={{ background: g.c }} /><span className="flex-1">{g.label}</span><b>{byGroup[g.id].length}</b><span className="text-xs text-muted w-10 text-right">({Math.round((byGroup[g.id].length / list.length) * 100)}%)</span></p>)}{list.length === 0 && <p className="text-muted">Sem dados.</p>}</div>
            </div>
          </Panel>
          <Panel tone="violet" title="Próximos lembretes" icon={CalendarDays} iconClass="text-sky-400" action={<button onClick={() => nav('/pagamentos')} className="text-sm font-semibold text-sky-500 hover:underline flex items-center gap-1">Ver todos<ArrowRight className="w-3.5 h-3.5" /></button>}>
            {upcoming.length === 0 ? <p className="text-sm text-muted">Nada pendente nos próximos 30 dias.</p> : (
              <ol className="relative border-l border-sky-400/40 ml-1.5 space-y-3">
                {upcoming.map((t) => <li key={t.id} className="pl-4 relative"><span className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-sky-400 ring-2 ring-sky-400/30" /><p className="text-sm"><b className="font-display mr-2">{new Date(String(t.date).slice(0, 10) + 'T00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</b>{t.description || (t.type === 'income' ? 'Recebimento' : 'Pagamento')} <span className={t.type === 'income' ? 'text-emerald-500' : 'text-rose-500'}>({formatCurrency(t.amount)})</span></p></li>)}
              </ol>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
