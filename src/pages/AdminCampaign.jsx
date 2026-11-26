import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Megaphone, Star, Eye, MousePointerClick, XCircle, Users, Calendar, Settings2, Target, Percent, X, CalendarDays, ShieldCheck, Send, LineChart as LineIcon, ExternalLink, Info, Repeat, Clock } from 'lucide-react';
import { Input, Select, Spinner, Textarea } from '../components/ui';
import { HeroTitle, Panel, Donut, GlowButton, TIP } from '../components/kit.jsx';
import { MegaphoneArt } from '../components/art/PageArt.jsx';
import { Admin } from '../api/entities.js';
import { toast } from '../lib/toast.js';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const ICONS = ['⭐', '🎉', '💚', '🚀', '🙏', '✨'];
const emptyForm = { active: false, title: 'Gostando do Monvy?', message: 'Sua avaliação nos ajuda demais. Que tal avaliar o Monvy na loja? Leva 10 segundos ❤️', url: '', icon: '⭐', start_date: '', end_date: '', id: '' };
const iso = (d) => d.toISOString().slice(0, 10);
const br = (s) => (s ? new Date(s + 'T00:00').toLocaleDateString('pt-BR') : '—');
const pct = (v) => (v == null || !Number.isFinite(v) ? '—' : `${v.toFixed(1).replace('.', ',')}%`);

function Spark({ data, c }) {
  if (!data || data.length < 2 || data.every((v) => !v)) return null;
  const max = Math.max(...data, 1); const w = 110, h = 30;
  return <svg width={w} height={h} className="absolute right-3 bottom-3 opacity-90" aria-hidden><polyline points={data.map((v, i) => `${(i / (data.length - 1)) * w},${h - 2 - (v / max) * (h - 6)}`).join(' ')} fill="none" stroke={c} strokeWidth="2" style={{ filter: `drop-shadow(0 0 4px ${c})` }} /></svg>;
}

export default function AdminCampaign() {
  const campQ = useQuery({ queryKey: ['admin-campaign'], queryFn: () => Admin.getCampaign() });
  const statsQ = useQuery({ queryKey: ['admin-campaign-stats'], queryFn: () => Admin.getCampaignStats(), refetchInterval: 30_000 });
  const usageQ = useQuery({ queryKey: ['admin-usage-context'], queryFn: () => Admin.usage(30) });
  const [form, setForm] = useState(null);
  const [range, setRange] = useState(7);
  const camp = campQ.data?.campaign;
  useEffect(() => { if (campQ.isSuccess) setForm(camp ? { ...emptyForm, ...camp } : { ...emptyForm }); }, [campQ.isSuccess, camp?.id, camp?.updated_at]);

  const save = useMutation({
    mutationFn: () => {
      const payload = { ...form };
      // nova campanha (novo id) ao ativar/reativar => reaparece para quem já tinha dispensado e zera a métrica
      if (payload.active && (!payload.id || camp?.active !== true)) payload.id = `c${Date.now()}`;
      return Admin.saveCampaign(payload);
    },
    onSuccess: (r) => { toast.success('Campanha salva.'); setForm({ ...emptyForm, ...r.campaign }); campQ.refetch(); statsQ.refetch(); },
    onError: (e) => toast.error(e.message || 'Falha ao salvar.'),
  });

  const stats = statsQ.data?.current || { shown: 0, clicked: 0, dismissed: 0 };
  const totals = usageQ.data?.totals || {};
  const totalUsers = totals.users || 0;
  const ctr = stats.shown > 0 ? (stats.clicked / stats.shown) * 100 : null;
  const dismissRate = stats.shown > 0 ? (stats.dismissed / stats.shown) * 100 : null;
  const reach = totalUsers > 0 ? (stats.shown / totalUsers) * 100 : null;
  const pending = Math.max(0, stats.shown - stats.clicked - stats.dismissed);
  // série diária gravada pelo /api/campaign-event (dias sem evento = 0)
  const series = useMemo(() => {
    const days = stats.days || {}; const out = [];
    for (let i = range - 1; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const k = iso(d); const v = days[k] || {}; out.push({ name: d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', ''), shown: v.shown || 0, clicked: v.clicked || 0, dismissed: v.dismissed || 0 }); }
    return out;
  }, [stats, range]);
  const hasSeries = Object.keys(stats.days || {}).length > 0;

  const today = iso(new Date());
  const status = !form ? null : !form.active ? ['Pausada', '#94a3b8'] : form.start_date && form.start_date > today ? ['Agendada', '#38bdf8'] : form.end_date && form.end_date < today ? ['Encerrada', '#fb7185'] : ['No ar', '#34d399'];
  const windowDays = form?.start_date && form?.end_date ? Math.round((new Date(form.end_date) - new Date(form.start_date)) / 864e5) + 1 : null;
  const seg = [
    { name: 'Ativos (30 dias)', value: totals.activeUsers || 0, color: '#22d3ee' },
    { name: 'Sumiram', value: totals.churned || 0, color: '#c084fc' },
    { name: 'Nunca usaram', value: totals.neverUsed || 0, color: '#a78bfa' },
  ];
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const KPIS = [
    [Eye, 'Exibida', stats.shown, '#22d3ee', series.map((s) => s.shown)], [MousePointerClick, 'Cliques em avaliar', stats.clicked, '#a78bfa', series.map((s) => s.clicked)],
    [XCircle, 'Dispensada', stats.dismissed, '#fb7185', series.map((s) => s.dismissed)], [Users, `Alcance (${totalUsers} usuários)`, pct(reach), '#38bdf8'],
  ];

  return (
    <div className="space-y-5 animate-fadeIn">
      <HeroTitle icon={Megaphone} lead="" accent="Campanhas" iconClass="text-fuchsia-400" subtitle="Configure e acompanhe a campanha de avaliação na loja." art={<MegaphoneArt className="w-[26rem] h-40 opacity-95" />} />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {KPIS.map(([Ic, l, v, c, sp]) => (
          <div key={l} className="relative overflow-hidden rounded-2xl ring-1 bg-[hsl(var(--card))] p-4 min-h-[92px]" style={{ '--tw-ring-color': `${c}66`, backgroundImage: `linear-gradient(135deg,${c}24,transparent 70%)`, boxShadow: `0 0 24px -12px ${c}` }}>
            <p className="text-sm flex items-center gap-2"><Ic className="w-5 h-5" style={{ color: c }} />{l}</p>
            <p className="font-display text-3xl font-extrabold mt-1">{statsQ.isLoading ? '…' : v}</p>
            {sp && <Spark data={sp} c={c} />}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[[Target, 'Taxa de clique', 'cliques ÷ exibições', pct(ctr), '#c084fc'], [Percent, 'Taxa de dispensa', '"Agora não" ÷ exibições', pct(dismissRate), '#fb7185'], [Clock, 'Sem resposta', 'viram e fecharam o app', pending, '#fbbf24']].map(([Ic, l, d, v, c]) => (
          <div key={l} className="rounded-2xl ring-1 ring-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 flex items-center gap-3"><Ic className="w-8 h-8 shrink-0" style={{ color: c }} strokeWidth={1.7} /><div><p className="text-sm font-semibold">{l} <span className="text-xs text-muted font-normal">({d})</span></p><p className="font-display text-2xl font-bold">{v}</p></div></div>
        ))}
      </div>
      <p className="text-xs text-muted">Métricas acumuladas desde que esta campanha foi ativada — zeram quando uma nova campanha é criada. A loja não informa ao Monvy quem de fato publicou a avaliação, por isso contamos os cliques em "Avaliar na loja".</p>

      {!form ? <div className="py-10 flex justify-center"><Spinner className="w-6 h-6 text-fuchsia-500" /></div> : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <Panel className="xl:col-span-4" tone="violet" title="Configuração da campanha" icon={Settings2} iconClass="text-sky-400">
            <p className="text-xs text-muted mb-3">Um lembrete que aparece <b>uma única vez</b> por usuário, dentro da janela de datas (se definida). Ao ativar (ou reativar), ele volta a aparecer para todos — como uma nova campanha, e as métricas reiniciam.</p>
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={!!form.active} onChange={(e) => set('active', e.target.checked)} className="w-4 h-4 accent-sky-500" />Campanha ativa<span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ color: status[1], background: `${status[1]}22` }}>{status[0]}</span></label>
              <div className="grid grid-cols-[1fr_96px] gap-2">
                <div><label className="text-sm font-medium">Título</label><Input value={form.title} onChange={(e) => set('title', e.target.value)} className="mt-1" /></div>
                <div><label className="text-sm font-medium">Ícone</label><Select value={form.icon} onChange={(e) => set('icon', e.target.value)} className="mt-1">{ICONS.map((ic) => <option key={ic} value={ic}>{ic}</option>)}</Select></div>
              </div>
              <div><label className="text-sm font-medium">Mensagem</label><Textarea rows={3} value={form.message} onChange={(e) => set('message', e.target.value)} className="mt-1" /></div>
              <div><label className="text-sm font-medium">Link da loja (Microsoft Store)</label>
                <div className="relative mt-1"><Input value={form.url} onChange={(e) => set('url', e.target.value)} placeholder="https://apps.microsoft.com/detail/..." className="pr-10" />{form.url && <a href={form.url} target="_blank" rel="noopener noreferrer" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-sky-500" aria-label="Abrir link"><ExternalLink className="w-4 h-4" /></a>}</div>
                <p className="text-[11px] text-muted mt-0.5">cole a URL do app na loja — sem link, o botão "Avaliar" não aparece</p></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-sm font-medium">Início (opcional)</label><Input type="date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} className="mt-1" /><p className="text-[11px] text-muted mt-0.5">só aparece a partir desta data</p></div>
                <div><label className="text-sm font-medium">Fim (opcional)</label><Input type="date" value={form.end_date} onChange={(e) => set('end_date', e.target.value)} className="mt-1" /><p className="text-[11px] text-muted mt-0.5">para de aparecer após esta data</p></div>
              </div>
              <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                <span className="text-[11px] text-muted flex items-start gap-1.5"><Info className="w-3.5 h-3.5 shrink-0" />{camp?.id ? <span>campanha atual: {camp.id}<br />{(form.start_date || form.end_date) && <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" />{form.start_date || '—'} a {form.end_date || '—'}</span>}</span> : 'nenhuma campanha salva'}</span>
                <GlowButton tone="sky" disabled={save.isPending} onClick={() => save.mutate()} className="py-2.5">{save.isPending ? <Spinner className="w-4 h-4" /> : <><Star className="w-4 h-4" />Salvar campanha</>}</GlowButton>
              </div>
            </div>
          </Panel>

          <div className="xl:col-span-5 space-y-4">
            <Panel tone="sky" title="Prévia da campanha" icon={Eye} iconClass="text-sky-400" action={<span className="text-[11px] px-2.5 py-1 rounded-full ring-1 ring-[hsl(var(--border))]">Como o usuário verá</span>}>
              <div className="relative rounded-2xl ring-1 ring-cyan-400/50 shadow-[0_0_30px_-10px_rgba(34,211,238,.6)] p-4 bg-[hsl(var(--card))]" style={{ backgroundImage: 'linear-gradient(135deg,rgba(14,165,233,.16),rgba(168,85,247,.16))' }}>
                <X className="absolute top-3 right-3 w-4 h-4 text-muted" />
                <div className="flex gap-3">
                  <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 grid place-items-center text-2xl shrink-0">{form.icon}</span>
                  <div className="min-w-0 pr-4"><b className="font-display text-lg">{form.title || 'Gostando do Monvy?'}</b><p className="text-sm text-muted mt-0.5">{form.message}</p><div className="flex gap-0.5 mt-1">{[0, 1, 2, 3, 4].map((i) => <Star key={i} className="w-3.5 h-3.5 text-amber-400" fill="currentColor" />)}</div></div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4">{form.url ? <span className="py-2 rounded-xl text-sm font-semibold text-white text-center bg-gradient-to-r from-sky-500 to-blue-600 flex items-center justify-center gap-1.5"><Star className="w-4 h-4" />Avaliar na loja</span> : <span className="py-2 rounded-xl text-xs text-amber-600 dark:text-amber-300 text-center ring-1 ring-amber-400/40">sem link: botão oculto</span>}<span className="py-2 rounded-xl text-sm font-semibold text-center ring-1 ring-[hsl(var(--border))]">Agora não</span></div>
              </div>
            </Panel>
            <Panel tone="violet" title="Desempenho ao longo do tempo" icon={LineIcon} iconClass="text-sky-400" action={<Select value={range} onChange={(e) => setRange(Number(e.target.value))} className="w-auto text-xs py-1"><option value={7}>Últimos 7 dias</option><option value={14}>Últimos 14 dias</option><option value={30}>Últimos 30 dias</option></Select>}>
              {!hasSeries ? <p className="h-[200px] grid place-items-center text-sm text-muted text-center px-6">A série diária começa a ser registrada a partir de agora; as próximas exibições e cliques aparecem aqui dia a dia.</p> : (
                <ResponsiveContainer width="100%" height={210}>
                  <LineChart data={series} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} minTickGap={12} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} width={36} />
                    <Tooltip contentStyle={TIP} />
                    <Line dataKey="shown" name="Exibições" stroke="#22d3ee" strokeWidth={2.5} dot={{ r: 3 }} />
                    <Line dataKey="clicked" name="Cliques em avaliar" stroke="#c084fc" strokeWidth={2.5} dot={{ r: 3 }} />
                    <Line dataKey="dismissed" name="Dispensas" stroke="#34d399" strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
              <div className="flex justify-center gap-4 text-xs text-muted mt-1">{[['Exibições', '#22d3ee'], ['Cliques em avaliar', '#c084fc'], ['Dispensas', '#34d399']].map(([l, c]) => <span key={l} className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />{l}</span>)}</div>
            </Panel>
          </div>

          <div className="xl:col-span-3 space-y-4">
            <Panel tone="sky" title="Segmentos de público" icon={Users} iconClass="text-sky-400" subtitle="Base de usuários nos últimos 30 dias">
              <div className="flex items-center gap-4"><Donut size={116} thickness={0.22} data={seg} center={<><b className="font-display text-xl">{totalUsers}</b><span className="text-[10px] text-muted">usuários</span></>} />
                <div className="flex-1 space-y-1.5 text-xs">{seg.map((s) => <p key={s.name} className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full" style={{ background: s.color }} /><span className="flex-1">{s.name}</span><b>{totalUsers ? Math.round((s.value / totalUsers) * 100) : 0}%</b></p>)}</div></div>
            </Panel>
            <Panel tone="emerald" title="Janela de exibição" icon={CalendarDays} iconClass="text-emerald-400" action={windowDays && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">{windowDays} dias</span>}>
              <p className="font-semibold">{form.start_date || form.end_date ? `De ${br(form.start_date)} a ${br(form.end_date)}` : 'Sem janela — enquanto estiver ativa'}</p>
              <p className="text-xs text-muted">Período em que a campanha pode aparecer.</p>
            </Panel>
            <Panel tone="violet" title="Regras de exibição" icon={ShieldCheck} iconClass="text-violet-400">
              <ul className="text-xs text-muted space-y-1.5"><li className="flex gap-1.5"><Repeat className="w-3.5 h-3.5 shrink-0 mt-0.5" />Uma vez por usuário, por dispositivo.</li><li className="flex gap-1.5"><Clock className="w-3.5 h-3.5 shrink-0 mt-0.5" />Aparece ~2 s depois que o app carrega.</li><li className="flex gap-1.5"><Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />Reativar cria uma nova campanha e reexibe para todos.</li></ul>
            </Panel>
            <Panel tone="sky" title="Status" icon={Send} iconClass="text-sky-400" action={<span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ color: status[1], background: `${status[1]}22` }}>{status[0]}</span>}>
              <p className="text-sm">{status[0] === 'No ar' ? 'A campanha está aparecendo para quem ainda não a viu.' : status[0] === 'Agendada' ? `Começa a aparecer em ${br(form.start_date)}.` : status[0] === 'Encerrada' ? `Encerrou em ${br(form.end_date)}.` : 'Pausada — ninguém vê a campanha agora.'}</p>
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}
