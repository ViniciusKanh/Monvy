import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UserSearch, Users, Activity, Eye, Flame, CalendarDays } from 'lucide-react';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Select, Badge, Spinner } from '../components/ui';
import { Admin } from '../api/entities.js';
import { findNavItem } from '../lib/screens.js';

const labelFor = (key) => findNavItem(key)?.label || key || '—';
const relDay = (d) => { if (!d) return 'nunca'; const diff = Math.round((Date.now() - new Date(d + 'T00:00').getTime()) / 86400000); return diff <= 0 ? 'hoje' : diff === 1 ? 'ontem' : `há ${diff} dias`; };
const STATUS_UI = { ativo: { label: 'Ativo', color: 'emerald' }, sumiu: { label: 'Sumiu', color: 'rose' }, nunca: { label: 'Nunca usou', color: 'slate' } };

export default function AdminUserAnalytics() {
  const [days, setDays] = useState(30);
  const [uid, setUid] = useState('all');
  const { data, isLoading } = useQuery({ queryKey: ['admin-usage', days], queryFn: () => Admin.usage(days) });

  const perUser = data?.perUser || [];
  const selected = useMemo(() => perUser.find((u) => u.id === uid) || null, [perUser, uid]);
  const maxEvents = Math.max(1, ...perUser.map((u) => u.events));

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <PageHeader title={<span className="flex items-center gap-2"><UserSearch className="w-6 h-6 text-indigo-500" /> Analytics por Usuário</span>}
          subtitle="O que cada usuário usa no Monvy — filtre por pessoa ou veja todos" />
        <div className="flex gap-2">
          <Select value={uid} onChange={(e) => setUid(e.target.value)} className="w-auto min-w-[180px]">
            <option value="all">Todos os usuários</option>
            {perUser.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
          <Select value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-auto">
            <option value={7}>7 dias</option><option value={30}>30 dias</option><option value={90}>90 dias</option>
          </Select>
        </div>
      </div>

      {isLoading ? <div className="flex justify-center py-16"><Spinner className="w-7 h-7" /></div> : uid === 'all' ? (
        <Card>
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-indigo-500" /> {perUser.length} usuário(s)</h3>
          {!perUser.length ? <p className="text-sm text-muted py-4 text-center">Sem dados ainda.</p> : (
            <div className="divide-y divide-[hsl(var(--border))]">
              {perUser.map((u) => { const st = STATUS_UI[u.status] || STATUS_UI.nunca; return (
                <button key={u.id} onClick={() => setUid(u.id)} className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-black/5 dark:hover:bg-white/5 rounded-lg px-1.5 -mx-1.5">
                  <div className="w-7 h-7 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 flex items-center justify-center text-xs font-bold shrink-0">{(u.name || '?').slice(0, 1).toUpperCase()}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{u.name}</p>
                    <p className="text-xs text-muted truncate">{u.topScreen ? `mais usa: ${labelFor(u.topScreen)}` : 'sem uso no período'} · visto {relDay(u.lastSeen)}</p>
                  </div>
                  <div className="hidden sm:block w-24 shrink-0"><div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${(u.events / maxEvents) * 100}%` }} /></div></div>
                  <div className="text-right shrink-0 w-16"><p className="text-sm font-bold leading-none">{u.events}</p><p className="text-[10px] text-muted">acessos</p></div>
                  <Badge color={st.color}>{st.label}</Badge>
                </button>
              ); })}
            </div>
          )}
          <p className="text-[11px] text-muted mt-3">Clique num usuário para ver exatamente quais telas e recursos ele usa.</p>
        </Card>
      ) : !selected ? (
        <Card><p className="text-sm text-muted py-4 text-center">Usuário não encontrado no período selecionado.</p></Card>
      ) : (
        <>
          <Card className="flex flex-wrap items-center gap-3 justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 flex items-center justify-center font-bold shrink-0">{(selected.name || '?').slice(0, 1).toUpperCase()}</div>
              <div>
                <p className="font-semibold">{selected.name}</p>
                <p className="text-xs text-muted">{selected.email} · {selected.role === 'admin' ? 'Administrador' : 'Usuário'}</p>
              </div>
            </div>
            <Badge color={(STATUS_UI[selected.status] || STATUS_UI.nunca).color}>{(STATUS_UI[selected.status] || STATUS_UI.nunca).label}</Badge>
          </Card>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Card className="p-3"><p className="text-[11px] text-muted flex items-center gap-1"><Eye className="w-3.5 h-3.5 text-violet-500" /> Acessos ({days}d)</p><p className="font-display text-xl font-bold mt-0.5">{selected.events}</p></Card>
            <Card className="p-3"><p className="text-[11px] text-muted flex items-center gap-1"><Activity className="w-3.5 h-3.5 text-emerald-500" /> Telas distintas</p><p className="font-display text-xl font-bold mt-0.5">{selected.screens.length}</p></Card>
            <Card className="p-3"><p className="text-[11px] text-muted flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> Visto</p><p className="font-display text-base font-bold mt-0.5">{relDay(selected.lastSeen)}</p></Card>
          </div>
          <Card>
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Flame className="w-4 h-4 text-amber-500" /> Recursos que este usuário usa</h3>
            {!selected.screens.length ? <p className="text-sm text-muted py-4 text-center">Nenhum acesso registrado neste período.</p> : (
              <div className="space-y-2">
                {selected.screens.map((s, i) => (
                  <div key={s.screen_key}>
                    <div className="flex justify-between text-sm"><span className="truncate">{i + 1}. {labelFor(s.screen_key)}</span><span className="text-muted ml-2 shrink-0">{s.views} acesso(s) · {s.days} dia(s) · visto {relDay(s.last)}</span></div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className="h-2 rounded-full bg-amber-500" style={{ width: `${(s.views / selected.screens[0].views) * 100}%` }} /></div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
