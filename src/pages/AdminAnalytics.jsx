import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { BarChart3, Users, Eye, Activity, Star, Megaphone, TrendingUp, TrendingDown, UserX, UserMinus, Flame, CalendarDays } from 'lucide-react';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Button, Input, Select, Field, Badge, Spinner, EmptyState } from '../components/ui';
import { AnimatedValue, Reveal } from '../components/Animated.jsx';
import { Admin } from '../api/entities.js';
import { findNavItem } from '../lib/screens.js';
import { toast } from '../lib/toast.js';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const labelFor = (key) => findNavItem(key)?.label || key || '—';
const relDay = (d) => { if (!d) return 'nunca'; const diff = Math.round((Date.now() - new Date(d + 'T00:00').getTime()) / 86400000); return diff <= 0 ? 'hoje' : diff === 1 ? 'ontem' : `há ${diff} dias`; };
const STATUS_UI = { ativo: { label: 'Ativo', color: 'emerald' }, sumiu: { label: 'Sumiu', color: 'rose' }, nunca: { label: 'Nunca usou', color: 'slate' } };

function Stat({ icon: Icon, label, value, tone = 'slate' }) {
  const tones = { slate: 'text-slate-500', emerald: 'text-emerald-600', rose: 'text-rose-500', amber: 'text-amber-600', violet: 'text-violet-600', blue: 'text-blue-600' };
  return (
    <Card className="p-3">
      <p className="text-[11px] text-muted flex items-center gap-1"><Icon className={`w-3.5 h-3.5 ${tones[tone]}`} /> {label}</p>
      <p className="font-display text-xl sm:text-2xl font-bold leading-tight mt-0.5">{typeof value === 'number' ? <AnimatedValue value={value} /> : value}</p>
    </Card>
  );
}

export default function AdminAnalytics() {
  const [days, setDays] = useState(30);
  const [uf, setUf] = useState('all'); // all | heavy | sumiu | nunca
  const { data, isLoading } = useQuery({ queryKey: ['admin-usage', days], queryFn: () => Admin.usage(days) });
  const campQ = useQuery({ queryKey: ['admin-campaign'], queryFn: () => Admin.getCampaign() });

  const [form, setForm] = useState(null);
  const camp = campQ.data?.campaign;
  // inicializa o form uma vez quando a campanha carrega
  if (form === null && campQ.isSuccess) {
    setForm(camp ? { ...camp } : { active: false, title: 'Gostando do Monvy?', message: 'Sua avaliação nos ajuda demais. Que tal avaliar o Monvy na loja? Leva 10 segundos ❤️', url: '', id: '' });
  }

  const save = useMutation({
    mutationFn: () => {
      const payload = { ...form };
      // novo id sempre que ativar/editar => reexibe para quem já tinha dispensado
      if (payload.active && (!payload.id || campQ.data?.campaign?.active !== true)) payload.id = `c${Date.now()}`;
      return Admin.saveCampaign(payload);
    },
    onSuccess: (r) => { toast.success('Campanha salva.'); setForm(r.campaign); campQ.refetch(); },
    onError: (e) => toast.error(e.message || 'Falha ao salvar.'),
  });

  const byScreen = data?.byScreen || [];
  const top = byScreen.slice(0, 10);
  const least = [...byScreen].reverse().slice(0, 6);
  const maxViews = top[0]?.views || 1;

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <PageHeader title={<span className="flex items-center gap-2"><BarChart3 className="w-6 h-6 text-emerald-500" /> Analytics de Uso</span>}
          subtitle="O que seus usuários mais usam — e o que quase ninguém abre" />
        <Select value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-auto">
          <option value={7}>7 dias</option><option value={30}>30 dias</option><option value={90}>90 dias</option>
        </Select>
      </div>

      {isLoading ? <div className="flex justify-center py-16"><Spinner className="w-7 h-7" /></div> : (<>
        {/* Totais */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
          <Stat icon={Users} label="Usuários" value={data?.totals?.users || 0} />
          <Stat icon={Activity} label={`Ativos (${days}d)`} value={data?.totals?.activeUsers || 0} tone="emerald" />
          <Stat icon={UserMinus} label="Sumiram" value={data?.totals?.churned || 0} tone="rose" />
          <Stat icon={UserX} label="Nunca usaram" value={data?.totals?.neverUsed || 0} />
          <Stat icon={Eye} label="Acessos" value={data?.totals?.views || 0} tone="violet" />
          <Stat icon={Flame} label="Média/ativo" value={data?.totals?.avgPerActive || 0} tone="amber" />
        </div>
        {data?.totals?.busiest && <p className="text-xs text-muted flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" /> Dia de pico: <b>{relDay(data.totals.busiest.day)}</b> ({data.totals.busiest.views} acessos)</p>}

        {/* Tendência */}
        <Card>
          <h3 className="font-semibold text-sm mb-3">Acessos por dia</h3>
          {(data?.daily || []).length === 0 ? <EmptyState icon={Activity} title="Sem dados ainda" subtitle="Assim que seus usuários navegarem, o uso aparece aqui." />
            : <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data.daily}>
                  <defs><linearGradient id="gu" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.4} /><stop offset="100%" stopColor="#10b981" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="day" fontSize={10} tickFormatter={(d) => String(d).slice(8)} />
                  <YAxis fontSize={10} allowDecimals={false} />
                  <Tooltip />
                  <Area type="monotone" dataKey="views" stroke="#10b981" fill="url(#gu)" name="Acessos" />
                  <Area type="monotone" dataKey="users" stroke="#6366f1" fillOpacity={0} name="Usuários" />
                </AreaChart>
              </ResponsiveContainer>}
        </Card>

        <div className="grid lg:grid-cols-2 gap-3">
          {/* Mais usadas */}
          <Card>
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-500" /> Ferramentas mais usadas</h3>
            {top.length === 0 ? <p className="text-sm text-muted">Sem dados.</p> : (
              <div className="space-y-2">
                {top.map((r, i) => (
                  <div key={r.screen_key}>
                    <div className="flex justify-between text-sm"><span className="truncate">{i + 1}. {labelFor(r.screen_key)}</span><span className="text-muted ml-2 shrink-0">{r.views} · {r.users} usr</span></div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className="h-2 rounded-full bg-emerald-500" style={{ width: `${(r.views / maxViews) * 100}%` }} /></div>
                  </div>
                ))}
              </div>
            )}
          </Card>
          {/* Menos usadas */}
          <Card>
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><TrendingDown className="w-4 h-4 text-rose-500" /> Quase não usadas</h3>
            {least.length === 0 ? <p className="text-sm text-muted">Sem dados.</p> : (
              <div className="space-y-1.5">
                {least.map((r) => (
                  <div key={r.screen_key} className="flex items-center justify-between text-sm">
                    <span className="truncate">{labelFor(r.screen_key)}</span>
                    <Badge color="slate">{r.views} acesso(s)</Badge>
                  </div>
                ))}
                <p className="text-xs text-muted mt-2">Telas que não aparecem aqui ainda não tiveram nenhum acesso no período.</p>
              </div>
            )}
          </Card>
        </div>

        {/* Usuários — quem usa, quem sumiu */}
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h3 className="font-semibold text-sm flex items-center gap-2"><Users className="w-4 h-4 text-indigo-500" /> Usuários ({(data?.perUser || []).length})</h3>
            <div className="flex flex-wrap gap-1.5">
              {[['all', 'Todos'], ['heavy', 'Usam muito'], ['sumiu', 'Sumiram'], ['nunca', 'Nunca usaram']].map(([k, lb]) => (
                <button key={k} onClick={() => setUf(k)} className={`text-xs px-2.5 py-1 rounded-full font-medium ${uf === k ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-muted'}`}>{lb}</button>
              ))}
            </div>
          </div>
          {(() => {
            let list = data?.perUser || [];
            if (uf === 'heavy') list = list.filter((u) => u.events > 0).slice(0, 15);
            else if (uf === 'sumiu') list = list.filter((u) => u.status === 'sumiu');
            else if (uf === 'nunca') list = list.filter((u) => u.status === 'nunca');
            if (!list.length) return <p className="text-sm text-muted py-4 text-center">Ninguém neste filtro.</p>;
            const maxEv = Math.max(1, ...list.map((u) => u.events));
            return (
              <div className="divide-y divide-[hsl(var(--border))]">
                {list.map((u, i) => { const st = STATUS_UI[u.status] || STATUS_UI.nunca; return (
                  <div key={u.id} className="flex items-center gap-3 py-2">
                    <div className="w-7 h-7 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 flex items-center justify-center text-xs font-bold shrink-0">{(u.name || '?').slice(0, 1).toUpperCase()}</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate flex items-center gap-1.5">{u.name}{uf === 'heavy' && i < 3 && u.events > 0 && <Flame className="w-3.5 h-3.5 text-amber-500" />}</p>
                      <p className="text-xs text-muted truncate">{u.topScreen ? `+ usa: ${labelFor(u.topScreen)}` : 'sem uso no período'} · visto {relDay(u.lastSeen)}</p>
                    </div>
                    <div className="hidden sm:block w-24 shrink-0"><div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${(u.events / maxEv) * 100}%` }} /></div></div>
                    <div className="text-right shrink-0 w-16"><p className="text-sm font-bold leading-none">{u.events}</p><p className="text-[10px] text-muted">acessos</p></div>
                    <Badge color={st.color}>{st.label}</Badge>
                  </div>
                ); })}
              </div>
            );
          })()}
          <p className="text-[11px] text-muted mt-2">"Sumiu" = último acesso há mais de {data?.churnDays || 14} dias. Os dados começam a contar a partir do deploy desta funcionalidade.</p>
        </Card>
      </>)}

      {/* Campanha de avaliação */}
      <Card>
        <h3 className="font-semibold flex items-center gap-2 mb-1"><Megaphone className="w-4 h-4 text-violet-500" /> Campanha de avaliação na loja</h3>
        <p className="text-xs text-muted mb-3">Um lembrete que aparece <b>uma única vez</b> por usuário. Ao ativar (ou reativar), ele volta a aparecer para todos — como uma nova campanha.</p>
        {campQ.isLoading || !form ? <div className="py-4"><Spinner className="w-5 h-5" /></div> : (
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={!!form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="w-4 h-4 accent-emerald-500" />
              Campanha ativa {form.active ? <Badge color="emerald">no ar</Badge> : <Badge color="slate">pausada</Badge>}
            </label>
            <Field label="Título"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <Field label="Mensagem"><Input value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></Field>
            <Field label="Link da loja (Microsoft Store)" hint="cole a URL do app na loja"><Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://apps.microsoft.com/detail/..." /></Field>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">{camp?.id ? `campanha atual: ${camp.id}` : 'nenhuma campanha salva'}</span>
              <Button disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? <Spinner className="w-4 h-4" /> : <><Star className="w-4 h-4" /> Salvar campanha</>}</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
