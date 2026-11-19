import { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Megaphone, Star, Eye, MousePointerClick, XCircle, Users, Calendar } from 'lucide-react';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Button, Input, Select, Field, Badge, Spinner } from '../components/ui';
import { AnimatedValue } from '../components/Animated.jsx';
import { Admin } from '../api/entities.js';
import { toast } from '../lib/toast.js';

const ICONS = ['⭐', '🎉', '💚', '🚀', '🙏', '✨'];
const emptyForm = { active: false, title: 'Gostando do Monvy?', message: 'Sua avaliação nos ajuda demais. Que tal avaliar o Monvy na loja? Leva 10 segundos ❤️', url: '', icon: '⭐', start_date: '', end_date: '', id: '' };

function Stat({ icon: Icon, label, value, tone = 'slate' }) {
  const tones = { slate: 'text-slate-500', emerald: 'text-emerald-600', rose: 'text-rose-500', violet: 'text-violet-600' };
  return (
    <Card className="p-3">
      <p className="text-[11px] text-muted flex items-center gap-1"><Icon className={`w-3.5 h-3.5 ${tones[tone]}`} /> {label}</p>
      <p className="font-display text-xl sm:text-2xl font-bold leading-tight mt-0.5">{typeof value === 'number' ? <AnimatedValue value={value} /> : value}</p>
    </Card>
  );
}

export default function AdminCampaign() {
  const campQ = useQuery({ queryKey: ['admin-campaign'], queryFn: () => Admin.getCampaign() });
  const statsQ = useQuery({ queryKey: ['admin-campaign-stats'], queryFn: () => Admin.getCampaignStats(), refetchInterval: 30_000 });
  const usageQ = useQuery({ queryKey: ['admin-usage-context'], queryFn: () => Admin.usage(30) });

  const [form, setForm] = useState(null);
  const camp = campQ.data?.campaign;
  useEffect(() => { if (campQ.isSuccess) setForm(camp ? { ...emptyForm, ...camp } : { ...emptyForm }); }, [campQ.isSuccess, camp?.id, camp?.updated_at]);

  const save = useMutation({
    mutationFn: () => {
      const payload = { ...form };
      // nova campanha (novo id) sempre que ativar/editar => reexibe para quem já tinha dispensado, e zera a métrica
      if (payload.active && (!payload.id || camp?.active !== true)) payload.id = `c${Date.now()}`;
      return Admin.saveCampaign(payload);
    },
    onSuccess: (r) => { toast.success('Campanha salva.'); setForm({ ...emptyForm, ...r.campaign }); campQ.refetch(); statsQ.refetch(); },
    onError: (e) => toast.error(e.message || 'Falha ao salvar.'),
  });

  const stats = statsQ.data?.current || { shown: 0, clicked: 0, dismissed: 0 };
  const ctr = stats.shown > 0 ? Math.round((stats.clicked / stats.shown) * 100) : 0;
  const totalUsers = usageQ.data?.totals?.users || 0;
  const reach = totalUsers > 0 ? Math.round((stats.shown / totalUsers) * 100) : 0;

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageHeader title={<span className="flex items-center gap-2"><Megaphone className="w-6 h-6 text-violet-500" /> Campanhas</span>}
        subtitle="Configure e acompanhe a campanha de avaliação na loja" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <Stat icon={Eye} label="Exibida" value={stats.shown} tone="violet" />
        <Stat icon={MousePointerClick} label="Cliques em avaliar" value={stats.clicked} tone="emerald" />
        <Stat icon={XCircle} label="Dispensada" value={stats.dismissed} tone="rose" />
        <Stat icon={Users} label={`Alcance (${totalUsers} usr)`} value={`${reach}%`} />
      </div>
      {stats.shown > 0 && <p className="text-xs text-muted">Taxa de clique (de quem viu, quantos tocaram em avaliar): <b>{ctr}%</b>. Métricas acumuladas desde que esta campanha foi ativada — zeram quando uma nova campanha é criada.</p>}

      <Card>
        <h3 className="font-semibold flex items-center gap-2 mb-1"><Star className="w-4 h-4 text-amber-500" /> Configuração da campanha</h3>
        <p className="text-xs text-muted mb-3">Um lembrete que aparece <b>uma única vez</b> por usuário, dentro da janela de datas (se definida). Ao ativar (ou reativar), ele volta a aparecer para todos — como uma nova campanha, e a métrica acima reinicia.</p>
        {campQ.isLoading || !form ? <div className="py-4"><Spinner className="w-5 h-5" /></div> : (
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={!!form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="w-4 h-4 accent-emerald-500" />
              Campanha ativa {form.active ? <Badge color="emerald">no ar</Badge> : <Badge color="slate">pausada</Badge>}
            </label>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Título"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
              <Field label="Ícone">
                <Select value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })}>
                  {ICONS.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Mensagem"><Input value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></Field>
            <Field label="Link da loja (Microsoft Store)" hint="cole a URL do app na loja"><Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://apps.microsoft.com/detail/..." /></Field>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Início (opcional)" hint="a campanha só aparece a partir desta data">
                <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </Field>
              <Field label="Fim (opcional)" hint="a campanha para de aparecer após esta data">
                <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </Field>
            </div>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs text-muted flex items-center gap-1.5">
                {camp?.id ? <>campanha atual: {camp.id}{(form.start_date || form.end_date) && <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> {form.start_date || '—'} a {form.end_date || '—'}</span>}</> : 'nenhuma campanha salva'}
              </span>
              <Button disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? <Spinner className="w-4 h-4" /> : <><Star className="w-4 h-4" /> Salvar campanha</>}</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
