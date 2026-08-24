import { useMemo, useRef, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trigger, Category, Account, Transaction, Investment, Debt, Goal, Subscription, CreditCardInvoice, Support, AppSettings, Robots, Notification } from '../api/entities.js';
import { useAuth } from '../context/AuthContext.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Button, Input, Select, Field, Modal, Spinner, EmptyState, Badge, Textarea } from '../components/ui';
import { Reveal } from '../components/Animated.jsx';
import { toast } from '../lib/toast.js';
import { converse } from '../lib/chat.js';
import { deliberate, suggestFor } from '../lib/assistant.js';
import { useNavigate } from 'react-router-dom';
import { CouncilThinking } from '../components/Splash.jsx';
import { Bot, Plus, Pencil, Trash2, MessageSquare, Send, Sparkles, X, Filter, Play, Clock, Zap, Wallet, BarChart3, TrendingUp, Globe, CalendarClock, RefreshCw } from 'lucide-react';

const FOCUS = [
  { k: 'geral', label: 'Assistente geral', emoji: '🤖', icon: Bot, desc: 'Responde sobre tudo: saldo, gastos, dividas, patrimônio, metas...' },
  { k: 'saldo', label: 'Saldo & Contas', emoji: '💰', icon: Wallet, desc: 'De olho no seu saldo e movimentação das contas.' },
  { k: 'gastos', label: 'Gastos & Categorias', emoji: '📊', icon: BarChart3, desc: 'Monitora onde você mais gasta e estouros.' },
  { k: 'entradas', label: 'Entradas & Renda', emoji: '💵', icon: TrendingUp, desc: 'Acompanha o que entra: salários e recebimentos.' },
  { k: 'patrimonio', label: 'Patrimônio & Investimentos', emoji: '📈', icon: TrendingUp, desc: 'Acompanha patrimônio líquido e carteira.' },
  { k: 'mercado', label: 'Mercado & Impostos', emoji: '🌎', icon: Globe, desc: 'Cotações (dolar, euro, cripto), Selic/IPCA e Imposto de Renda.' },
  { k: 'vencimentos', label: 'Vencimentos & Contas', emoji: '📅', icon: CalendarClock, desc: 'Avisa o que esta pra vencer.' },
  { k: 'inteligencia', label: 'Inteligência & Análise', emoji: '🧠', icon: BarChart3, desc: 'Raio-X, saude financeira, comportamento e recomendações.' },
  { k: 'metas', label: 'Metas & Objetivos', emoji: '🎯', icon: TrendingUp, desc: 'Acompanha o progresso das suas metas e cobra.' },
];
const focusOf = (k) => FOCUS.find((f) => f.k === k) || FOCUS[0];
const EMOJIS = ['🤖', '💰', '📊', '📈', '🌎', '📅', '🦾', '🧠', '🛡️', '🦉', '🐱', '🚀', '💡', '🕵️', '📎'];

const METRICS = [
  { k: 'total_balance', label: 'Saldo total das contas', unit: 'R$' },
  { k: 'month_balance', label: 'Saldo do mês (receita - despesa)', unit: 'R$' },
  { k: 'month_income', label: 'Receita do mês', unit: 'R$' },
  { k: 'month_expense', label: 'Despesa do mês (inclui cartao)', unit: 'R$' },
  { k: 'savings_rate', label: 'Taxa de poupança do mês', unit: '%' },
  { k: 'category_spend', label: 'Gasto em uma categoria (mes)', unit: 'R$', needsCategory: true },
  { k: 'pending_count', label: 'Lançamentos vencidos não pagos', unit: 'un' },
  { k: 'net_worth', label: 'Patrimônio liquido', unit: 'R$' },
  { k: 'debt_monthly', label: 'Parcelas de dividas por mês', unit: 'R$' },
  { k: 'goals_saved', label: 'Guardado em metas/cofres', unit: 'R$' },
  { k: 'card_invoice_total', label: 'Faturas de cartão em aberto', unit: 'R$' },
  { k: 'investments_total', label: 'Total investido', unit: 'R$' },
  { k: 'open_tickets', label: 'Chamados em aberto', unit: 'un' },
];
const mInfo = (k) => METRICS.find((m) => m.k === k) || METRICS[0];
const OPS = [{ k: 'lt', label: 'menor que' }, { k: 'lte', label: 'menor ou igual a' }, { k: 'gt', label: 'maior que' }, { k: 'gte', label: 'maior ou igual a' }, { k: 'eq', label: 'igual a' }];
const opLabel = (k) => (OPS.find((o) => o.k === k) || OPS[0]).label;
const ACTIONS = [
  { k: 'notify', label: 'Notificar no app' },
  { k: 'email_alert', label: 'Enviar alerta por e-mail' },
  { k: 'open_ticket', label: 'Abrir um chamado' },
  { k: 'email_summary', label: 'Enviar resumo financeiro' },
  { k: 'email_bills', label: 'Enviar vencimentos próximos' },
];
const actLabel = (k) => (ACTIONS.find((a) => a.k === k) || ACTIONS[0]).label;
const FREQ = [['daily', 'Todo dia'], ['weekly', 'Toda semana'], ['monthly', 'Todo mês']];
const freqLabel = (f) => (FREQ.find((x) => x[0] === f) || FREQ[0])[1];
const WEEKDAYS = ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado'];

const emptyAction = () => ({ action: 'notify', subject: '', message: '', ticketCategory: '', aiWrite: false });
const emptyForm = () => ({ name: '', frequency: 'weekly', weekday: 1, enabled: true, config: { focus: 'geral', emoji: '🤖', greeting: '', personality: '', monitor: false, match: 'all', conditions: [], actions: [emptyAction()], cooldownDays: 0, dayOfMonth: 1 } });
const normConfig = (c) => ({
  focus: c?.focus || 'geral', emoji: c?.emoji || '🤖', greeting: c?.greeting || '', personality: c?.personality || '', monitor: !!c?.monitor,
  match: c?.match || 'all',
  conditions: Array.isArray(c?.conditions) ? c.conditions : [],
  cooldownDays: Number(c?.cooldownDays) || 0,
  dayOfMonth: Number(c?.dayOfMonth) || 1,
  actions: Array.isArray(c?.actions) && c.actions.length ? c.actions.map((a) => ({ action: a.action || 'notify', subject: a.subject || '', message: a.message || '', ticketCategory: a.ticketCategory || '', aiWrite: !!a.aiWrite })) : [{ action: c?.action || 'notify', subject: c?.subject || '', message: c?.message || '', ticketCategory: c?.ticketCategory || '', aiWrite: false }],
});

// Galeria de robos prontos (1 clique). Acao padrão = notificação no app (não exige e-mail).
const GALLERY = [
  { name: 'Vigia dos Gastos', emoji: '📊', tag: 'Gastos', desc: 'Avisa quando seus gastos do mês passam de R$ 3.000.', frequency: 'weekly',
    config: { focus: 'gastos', emoji: '📊', greeting: 'Fico de olho nos seus gastos.', monitor: true, match: 'all', conditions: [{ metric: 'month_expense', op: 'gt', value: 3000 }], actions: [{ action: 'notify', subject: 'Gastos acima do previsto', message: 'Seus gastos do mês passaram de R$ 3.000.' }] } },
  { name: 'Radar de Vencimentos', emoji: '📅', tag: 'Vencimentos', desc: 'Avisa quando ha contas vencidas ou a vencer.', frequency: 'weekly',
    config: { focus: 'vencimentos', emoji: '📅', greeting: 'Nao deixo nenhuma conta passar.', monitor: true, match: 'all', conditions: [{ metric: 'pending_count', op: 'gte', value: 1 }], actions: [{ action: 'notify', subject: 'Você tem contas a pagar', message: 'Ha lançamentos vencidos ou próximos do vencimento.' }] } },
  { name: 'Guardiao do Saldo', emoji: '🛡️', tag: 'Saldo', desc: 'Alerta na hora se o saldo total ficar abaixo de R$ 500.', frequency: 'daily',
    config: { focus: 'saldo', emoji: '🛡️', greeting: 'Protejo seu saldo de sustos.', monitor: true, match: 'all', conditions: [{ metric: 'total_balance', op: 'lt', value: 500 }], actions: [{ action: 'notify', subject: 'Saldo baixo', message: 'Seu saldo total nas contas ficou baixo.' }] } },
  { name: 'Vigia do Cartão', emoji: '💳', tag: 'Cartão', desc: 'Avisa quando as faturas de cartão em aberto passam de R$ 2.000.', frequency: 'weekly',
    config: { focus: 'vencimentos', emoji: '💳', greeting: 'Fico de olho nas faturas do cartão.', monitor: true, match: 'all', conditions: [{ metric: 'card_invoice_total', op: 'gt', value: 2000 }], actions: [{ action: 'notify', subject: 'Faturas de cartão altas', message: 'Suas faturas de cartão em aberto passaram de R$ 2.000.' }] } },
  { name: 'Guardiao das Entradas', emoji: '💵', tag: 'Entradas', desc: 'Resumo mensal do que entrou (salários e recebimentos).', frequency: 'monthly',
    config: { focus: 'entradas', emoji: '💵', greeting: 'Acompanho tudo que entra na sua conta.', monitor: true, match: 'all', conditions: [], actions: [{ action: 'notify', subject: 'Resumo de entradas', message: 'Confira o que você recebeu no último período.' }], dayOfMonth: 1 } },
  { name: 'Analista de Mercado & Impostos', emoji: '🌎', tag: 'Mercado', desc: 'Tira dúvidas de dolar, euro, cripto, Selic/IPCA e Imposto de Renda no chat.', frequency: 'weekly',
    config: { focus: 'mercado', emoji: '🌎', greeting: 'Pergunte sobre cotações, taxas e impostos.', monitor: false } },
  { name: 'Consultor de Patrimônio', emoji: '📈', tag: 'Patrimônio', desc: 'Alerta na hora se seu patrimônio zerar ou ficar negativo.', frequency: 'daily',
    config: { focus: 'patrimonio', emoji: '📈', greeting: 'Cuido do crescimento do seu patrimônio.', monitor: true, match: 'all', conditions: [{ metric: 'net_worth', op: 'lte', value: 0 }], actions: [{ action: 'notify', subject: 'Patrimônio zerado ou negativo', message: 'Seu patrimônio líquido chegou a zero ou ficou negativo. Vale revisar contas, dívidas e gastos.' }] } },
  { name: 'Analista de Inteligência', emoji: '🧠', tag: 'Inteligência', desc: 'Faz o raio-X: saude financeira, comportamento, previsao e recomendações.', frequency: 'monthly',
    config: { focus: 'inteligencia', emoji: '🧠', greeting: 'Peca um raio-X das suas finanças quando quiser.', monitor: false } },
  { name: 'Coach de Metas', emoji: '🎯', tag: 'Metas', desc: 'Acompanha suas metas e te lembra de guardar todo mês.', frequency: 'monthly',
    config: { focus: 'metas', emoji: '🎯', greeting: 'Bora bater suas metas? Me pergunte como elas estao.', monitor: true, match: 'all', conditions: [], actions: [{ action: 'notify', subject: 'Hora de guardar', message: 'Lembrete do mês: separe um valor para suas metas.' }], dayOfMonth: 5 } },
  { name: 'Alfred', emoji: '🦾', tag: 'Geral', desc: 'Assistente geral: responde qualquer pergunta sobre suas finanças.', frequency: 'weekly',
    config: { focus: 'geral', emoji: '🦾', greeting: 'Pergunte o que quiser sobre suas finanças.', monitor: false } },
];

const SECTOR_COLOR = { gastos: '#f43f5e', entradas: '#10b981', vencimentos: '#f59e0b', patrimonio: '#6366f1', mercado: '#0ea5e9', inteligencia: '#a855f7', metas: '#ec4899', saldo: '#14b8a6', geral: '#8b5cf6' };
const SECTORS = ['gastos', 'entradas', 'vencimentos', 'patrimonio', 'mercado', 'inteligencia', 'metas', 'geral'];
const hireFor = (focus) => GALLERY.find((g) => g.config.focus === focus) || { name: focusOf(focus).label, frequency: 'weekly', config: { focus, emoji: focusOf(focus).emoji, monitor: false } };
const relTime = (iso) => { if (!iso) return ''; const d = (Date.now() - new Date(iso).getTime()) / 1000; if (!isFinite(d)) return ''; if (d < 3600) return `há ${Math.max(1, Math.round(d / 60))}min`; if (d < 86400) return `há ${Math.round(d / 3600)}h`; return `há ${Math.round(d / 86400)}d`; };

function Bold({ text }) {
  const parts = String(text).split(/\*\*/);
  return <>{parts.map((p, i) => i % 2 ? <strong key={i}>{p}</strong> : <span key={i}>{p}</span>)}</>;
}

export default function Agents() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: agents = [], isLoading } = useQuery({ queryKey: ['triggers'], queryFn: () => Trigger.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });
  const { data: sup } = useQuery({ queryKey: ['support-config'], queryFn: () => Support.config() });
  const { data: notifs = [] } = useQuery({ queryKey: ['notifications'], queryFn: () => Notification.list({ _limit: 50 }), refetchInterval: 60_000 });
  const ticketCats = sup?.categories || [];
  const expenseCats = categories.filter((c) => c.type === 'expense');
  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);

  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [chatFor, setChatFor] = useState(null);

  const inval = () => qc.invalidateQueries({ queryKey: ['triggers'] });
  const save = useMutation({ mutationFn: (p) => editing ? Trigger.update(editing.id, p) : Trigger.create(p), onSuccess: () => { inval(); setModal(false); toast.success('Agente salvo'); }, onError: (e) => toast.error(e.message || 'Falha') });
  const del = useMutation({ mutationFn: (id) => Trigger.remove(id), onSuccess: inval });
  const toggle = useMutation({ mutationFn: ({ id, enabled }) => Trigger.update(id, { enabled }), onSuccess: inval });
  const quickCreate = useMutation({ mutationFn: (p) => Trigger.create({ name: p.name, frequency: p.frequency || 'weekly', weekday: 1, enabled: true, type: 'agent', config: normConfig(p.config) }), onSuccess: () => { inval(); toast.success('Robo adicionado! Ja esta trabalhando pra você.'); }, onError: (e) => toast.error(e.message || 'Falha') });

  const openNew = () => { setEditing(null); setForm(emptyForm()); setModal(true); };
  const openEdit = (t) => { setEditing(t); setForm({ name: t.name || '', frequency: t.frequency || 'weekly', weekday: t.weekday ?? 1, enabled: t.enabled !== false, config: normConfig(t.config) }); setModal(true); };
  const customFrom = (p) => { setEditing(null); setForm({ ...emptyForm(), name: p.name, frequency: p.frequency || 'weekly', config: normConfig(p.config) }); setModal(true); };
  const ownedFocuses = new Set(agents.map((a) => normConfig(a.config).focus));
  const [checking, setChecking] = useState(false);
  const runCheck = async () => { setChecking(true); try { const { fired } = await Robots.check(); qc.invalidateQueries({ queryKey: ['notifications'] }); inval(); toast.success(fired ? `${fired} alerta(s) gerado(s) agora.` : 'Verificado — nenhum alerta no momento.'); } catch (e) { toast.error(e.message || 'Falha'); } finally { setChecking(false); } };

  const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setC = (k, v) => setForm((f) => ({ ...f, config: { ...f.config, [k]: v } }));
  const setCond = (i, patch) => setForm((f) => ({ ...f, config: { ...f.config, conditions: f.config.conditions.map((c, idx) => idx === i ? { ...c, ...patch } : c) } }));
  const addCond = () => setForm((f) => ({ ...f, config: { ...f.config, conditions: [...f.config.conditions, { metric: 'total_balance', op: 'lt', value: 0 }] } }));
  const rmCond = (i) => setForm((f) => ({ ...f, config: { ...f.config, conditions: f.config.conditions.filter((_, idx) => idx !== i) } }));
  const setAct = (i, patch) => setForm((f) => ({ ...f, config: { ...f.config, actions: f.config.actions.map((a, idx) => idx === i ? { ...a, ...patch } : a) } }));
  const addAct = () => setForm((f) => ({ ...f, config: { ...f.config, actions: [...f.config.actions, emptyAction()] } }));
  const rmAct = (i) => setForm((f) => ({ ...f, config: { ...f.config, actions: f.config.actions.length > 1 ? f.config.actions.filter((_, idx) => idx !== i) : f.config.actions } }));

  const submit = () => {
    if (!form.name) return toast.error('De um nome ao seu robo');
    const cfg = form.config;
    if (cfg.monitor) {
      const directOnly = cfg.actions.every((a) => a.action === 'email_summary' || a.action === 'email_bills');
      if (!directOnly && cfg.conditions.length === 0) return toast.error('Adicione ao menos uma condição ou use apenas ações de envio direto');
    }
    save.mutate({ ...form, weekday: Number(form.weekday), type: 'agent' });
  };

  const cfg = form.config;

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageHeader
        title={<span className="flex items-center gap-2"><Bot className="w-6 h-6 text-emerald-500" /> Agentes & Robos</span>}
        subtitle="Crie robos com nome e foco. Eles monitoram suas finanças e conversam com você."
        actions={<div className="flex gap-2"><Button variant="outline" onClick={runCheck} disabled={checking}>{checking ? <Spinner className="w-4 h-4" /> : <><RefreshCw className="w-4 h-4" /> Verificar agora</>}</Button><Button onClick={openNew}><Plus className="w-4 h-4" /> Novo robo</Button></div>}
      />

      {/* HERO EMPRESA */}
      {(() => {
        const ativos = agents.filter((a) => { const c = normConfig(a.config); return c.monitor && a.enabled !== false; }).length;
        const setoresOcupados = new Set(agents.map((a) => normConfig(a.config).focus)).size;
        return (
          <div className="relative overflow-hidden rounded-3xl p-6 text-white shadow-soft" style={{ background: 'linear-gradient(135deg,#0f172a 0%,#065f46 55%,#4338ca 100%)' }}>
            <div className="absolute -top-16 -right-10 w-64 h-64 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(255,255,255,.15), transparent 70%)' }} />
            <div className="relative flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-[11px] tracking-[0.28em] font-medium text-emerald-200"><Bot className="w-3.5 h-3.5" /> SUA EQUIPE FINANCEIRA</div>
                <p className="font-display text-2xl font-extrabold mt-1">Monvy · Central de Robôs</p>
                <p className="text-white/80 text-sm mt-1 max-w-lg">Cada robô cuida de um setor e monitora suas finanças 24/7. Contrate para as áreas vazias e converse com eles quando quiser.</p>
              </div>
              <div className="flex gap-5 text-center">
                <div><p className="font-display text-2xl font-extrabold">{agents.length}</p><p className="text-white/70 text-xs">funcionários</p></div>
                <div><p className="font-display text-2xl font-extrabold text-emerald-300">{ativos}</p><p className="text-white/70 text-xs">monitorando</p></div>
                <div><p className="font-display text-2xl font-extrabold">{setoresOcupados}/{SECTORS.length}</p><p className="text-white/70 text-xs">setores</p></div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ORGANOGRAMA: você (CEO) -> departamentos */}
      <div className="flex flex-col items-center">
        <div className="px-4 py-2 rounded-2xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-sm flex items-center gap-2">
          <span className="w-9 h-9 rounded-xl text-white flex items-center justify-center text-sm font-bold" style={{ background: 'linear-gradient(135deg,#10b981,#6366f1)' }}>{((user?.first_name || user?.full_name || 'V')[0] || 'V').toUpperCase()}</span>
          <div><p className="text-sm font-semibold leading-tight">{user?.full_name || 'Você'}</p><p className="text-[11px] text-muted">CEO · comanda a equipe</p></div>
        </div>
        <div className="w-px h-5" style={{ background: 'hsl(var(--border))' }} />
        <div className="w-full max-w-4xl h-px" style={{ background: 'hsl(var(--border))' }} />
      </div>

      {isLoading ? <div className="flex justify-center py-10"><Spinner className="w-6 h-6 text-emerald-500" /></div> : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 -mt-1">
          {[...new Set([...SECTORS, ...agents.map((a) => normConfig(a.config).focus)])].map((focus) => {
            const foc = focusOf(focus); const color = SECTOR_COLOR[focus] || '#64748b';
            const staff = agents.filter((a) => normConfig(a.config).focus === focus);
            return (
              <Card key={focus} className="p-0 overflow-hidden hover-lift flex flex-col">
                <div className="px-4 py-3 flex items-center gap-2" style={{ background: `linear-gradient(135deg, ${color}22, ${color}0d)` }}>
                  <span className="w-9 h-9 rounded-xl flex items-center justify-center text-lg text-white shrink-0" style={{ background: color }}>{foc.emoji}</span>
                  <div className="min-w-0 flex-1"><p className="font-semibold text-sm leading-tight">{foc.label}</p><p className="text-[11px] text-muted">Departamento · {staff.length} func.</p></div>
                </div>
                <div className="p-3 space-y-2 flex-1">
                  {staff.length === 0 ? (
                    <button onClick={() => quickCreate.mutate(hireFor(focus))} disabled={quickCreate.isPending} className="w-full h-full min-h-[92px] rounded-xl border-2 border-dashed border-[hsl(var(--border))] flex flex-col items-center justify-center gap-1 text-muted hover:border-emerald-500 hover:text-emerald-600 transition text-sm">
                      <Plus className="w-5 h-5" /> Contratar {foc.label.split(' ')[0]}
                    </button>
                  ) : staff.map((t) => { const c = normConfig(t.config); const on = t.enabled !== false; return (
                    <div key={t.id} className="rounded-xl border border-[hsl(var(--border))] p-2.5">
                      <div className="flex items-center gap-2">
                        <span className="relative w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: 'linear-gradient(135deg,#10b98122,#6366f122)' }}>{c.emoji}<span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[hsl(var(--card))] ${c.monitor && on ? 'bg-emerald-500' : 'bg-slate-400'}`} /></span>
                        <div className="min-w-0 flex-1"><p className="font-semibold text-sm leading-tight truncate">{t.name}</p><p className="text-[11px] text-muted">{c.monitor ? (on ? 'monitorando' : 'pausado') : 'só chat'}</p></div>
                        <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10" title="Ajustar"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => del.mutate(t.id)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10" title="Demitir"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                      {c.monitor && <p className="text-[11px] text-muted mt-1.5 truncate"><Filter className="w-3 h-3 inline mr-1" />{c.conditions.length ? c.conditions.map((x) => `${mInfo(x.metric).label} ${opLabel(x.op)} ${x.value}`).join(c.match === 'any' ? ' ou ' : ' e ') : 'resumo periódico'}</p>}
                      <div className="flex items-center gap-2 mt-2">
                        <Button size="sm" className="flex-1" onClick={() => setChatFor(t)}><MessageSquare className="w-4 h-4" /> Conversar</Button>
                        {c.monitor && <label className="flex items-center gap-1 text-[11px] cursor-pointer" title="Ativar/pausar"><input type="checkbox" className="w-4 h-4 accent-emerald-500" checked={on} onChange={(e) => toggle.mutate({ id: t.id, enabled: e.target.checked })} /></label>}
                      </div>
                    </div>
                  ); })}
                  {staff.length > 0 && <button onClick={() => quickCreate.mutate(hireFor(focus))} disabled={quickCreate.isPending} className="w-full text-[11px] text-muted hover:text-emerald-600 py-1">+ mais um neste setor</button>}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted">Cada robô tem um <b>chat</b> que lê seus dados (100% local, ou com IA se você configurar a chave Gemini) e pode <b>monitorar 24/7</b> e te avisar. Precisa de algo sob medida? <button onClick={openNew} className="underline text-emerald-600">Criar do zero</button>.</p>

      {/* LINHA DO TEMPO DOS ROBOS */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2"><Clock className="w-4 h-4 text-indigo-500" /> Linha do tempo da equipe</h3>
          <span className="text-xs text-muted">o que os robôs sinalizaram</span>
        </div>
        {notifs.length === 0 ? <p className="text-sm text-muted py-2">Nenhum sinal ainda. Quando um robô detectar algo, aparece aqui.</p>
          : (
            <div className="relative pl-4 space-y-3 before:absolute before:left-1 before:top-1 before:bottom-1 before:w-px before:bg-[hsl(var(--border))]">
              {[...notifs].sort((a, b) => String(b.created_date || '').localeCompare(String(a.created_date || ''))).slice(0, 12).map((n) => (
                <div key={n.id} className="relative">
                  <span className="absolute -left-3 top-1.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-[hsl(var(--card))]" />
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight">{n.title}</p>
                      {n.text && <p className="text-xs text-muted leading-tight">{n.text}</p>}
                    </div>
                    <span className="text-[10px] text-muted shrink-0 mt-0.5">{relTime(n.created_date)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
      </Card>

      {/* Modal criar/editar robo */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar robo' : 'Novo robo'} maxWidth="max-w-xl"
        footer={<><Button variant="outline" onClick={() => setModal(false)}>Cancelar</Button><Button onClick={submit} disabled={save.isPending}>{save.isPending ? <Spinner className="w-4 h-4" /> : 'Salvar robo'}</Button></>}>
        <div className="space-y-4">
          <div className="grid grid-cols-[auto,1fr] gap-3 items-end">
            <Field label="Emoji"><Select value={cfg.emoji} onChange={(e) => setC('emoji', e.target.value)} className="w-20 text-xl">{EMOJIS.map((e) => <option key={e} value={e}>{e}</option>)}</Select></Field>
            <Field label="Nome do robo"><Input value={form.name} onChange={(e) => setF('name', e.target.value)} placeholder="Ex: Alfred" /></Field>
          </div>
          <Field label="Foco / especialidade">
            <Select value={cfg.focus} onChange={(e) => setC('focus', e.target.value)}>{FOCUS.map((f) => <option key={f.k} value={f.k}>{f.emoji} {f.label}</option>)}</Select>
          </Field>
          <p className="text-xs text-muted -mt-2">{focusOf(cfg.focus).desc}</p>
          <Field label="Mensagem de boas-vindas (opcional)"><Input value={cfg.greeting} onChange={(e) => setC('greeting', e.target.value)} placeholder="Ex: Pergunte o que quiser sobre suas finanças." /></Field>
          <Field label="Personalidade / estilo (opcional)"><Textarea rows={2} value={cfg.personality} onChange={(e) => setC('personality', e.target.value)} placeholder="Ex: direto e objetivo; ou bem-humorado e motivador. Usado quando a IA (Gemini) esta ativa." /></Field>

          <label className="flex items-center justify-between p-3 rounded-xl border border-[hsl(var(--border))] cursor-pointer">
            <span className="text-sm font-medium flex items-center gap-2"><Zap className="w-4 h-4 text-amber-500" /> Monitoramento automático</span>
            <input type="checkbox" className="w-5 h-5 accent-emerald-500" checked={cfg.monitor} onChange={(e) => setC('monitor', e.target.checked)} />
          </label>

          {cfg.monitor && (
            <div className="space-y-3">
              <div className="rounded-xl border border-[hsl(var(--border))] p-3">
                <div className="flex items-center gap-2 mb-2"><span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 rounded px-1.5 py-0.5">QUANDO</span><span className="text-sm font-medium">Frequencia</span></div>
                <div className="grid grid-cols-2 gap-2">
                  <Select value={form.frequency} onChange={(e) => setF('frequency', e.target.value)}>{FREQ.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
                  {form.frequency === 'weekly' && <Select value={form.weekday} onChange={(e) => setF('weekday', e.target.value)}>{WEEKDAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}</Select>}
                  {form.frequency === 'monthly' && <Select value={cfg.dayOfMonth} onChange={(e) => setC('dayOfMonth', Number(e.target.value))}>{Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>Dia {d}</option>)}</Select>}
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm"><span className="text-muted">Nao repetir por</span><Input type="number" min="0" value={cfg.cooldownDays} onChange={(e) => setC('cooldownDays', Number(e.target.value))} className="w-20" /><span className="text-muted">dia(s)</span></div>
              </div>

              <div className="rounded-xl border border-[hsl(var(--border))] p-3">
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-2"><span className="text-[10px] font-bold text-sky-500 bg-sky-500/10 rounded px-1.5 py-0.5">SE</span><span className="text-sm font-medium">Condições</span></div>
                  {cfg.conditions.length > 1 && <div className="inline-flex p-0.5 rounded-lg bg-black/5 dark:bg-white/5 text-xs">{[['all', 'TODAS'], ['any', 'QUALQUER']].map(([v, l]) => <button key={v} type="button" onClick={() => setC('match', v)} className={`px-2 py-1 rounded-md font-semibold ${cfg.match === v ? 'bg-[hsl(var(--card))] shadow' : 'text-muted'}`}>{l}</button>)}</div>}
                </div>
                <div className="space-y-2">
                  {cfg.conditions.length === 0 && <p className="text-xs text-muted">Sem condições = dispara sempre na frequencia (útil para resumo/vencimentos).</p>}
                  {cfg.conditions.map((c, i) => { const mi = mInfo(c.metric); return (
                    <div key={i} className="rounded-lg bg-black/5 dark:bg-white/5 p-2 space-y-2">
                      <div className="flex items-center gap-2">
                        <Select value={c.metric} onChange={(e) => setCond(i, { metric: e.target.value })} className="flex-1">{METRICS.map((m) => <option key={m.k} value={m.k}>{m.label}</option>)}</Select>
                        <button type="button" onClick={() => rmCond(i)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 shrink-0"><X className="w-4 h-4" /></button>
                      </div>
                      {mi.needsCategory && <Select value={c.categoryId || ''} onChange={(e) => setCond(i, { categoryId: e.target.value })}><option value="">Selecione a categoria</option>{expenseCats.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>}
                      <div className="flex items-center gap-2">
                        <Select value={c.op} onChange={(e) => setCond(i, { op: e.target.value })} className="flex-1">{OPS.map((o) => <option key={o.k} value={o.k}>{o.label}</option>)}</Select>
                        <Input type="number" step="0.01" value={c.value} onChange={(e) => setCond(i, { value: Number(e.target.value) })} className="w-28" />
                        <span className="text-xs text-muted w-6">{mi.unit}</span>
                      </div>
                    </div>
                  ); })}
                  <Button size="sm" variant="outline" onClick={addCond}><Plus className="w-4 h-4" /> Adicionar condição</Button>
                </div>
              </div>

              <div className="rounded-xl border border-[hsl(var(--border))] p-3">
                <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 rounded px-1.5 py-0.5">ENTAO</span><span className="text-sm font-medium">Ações ({cfg.actions.length})</span></div><Button size="sm" variant="outline" onClick={addAct}><Plus className="w-4 h-4" /> Acao</Button></div>
                <div className="space-y-3">
                  {cfg.actions.map((a, i) => (
                    <div key={i} className="rounded-lg bg-black/5 dark:bg-white/5 p-2.5 space-y-2">
                      <div className="flex items-center gap-2">
                        <Select value={a.action} onChange={(e) => setAct(i, { action: e.target.value })} className="flex-1">{ACTIONS.map((x) => <option key={x.k} value={x.k}>{x.label}</option>)}</Select>
                        {cfg.actions.length > 1 && <button type="button" onClick={() => rmAct(i)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 shrink-0"><X className="w-4 h-4" /></button>}
                      </div>
                      {(a.action === 'email_alert' || a.action === 'open_ticket' || a.action === 'notify') && (
                        <div className="space-y-2">
                          {a.action === 'open_ticket' && <Select value={a.ticketCategory || ''} onChange={(e) => setAct(i, { ticketCategory: e.target.value })}><option value="">Categoria do chamado</option>{ticketCats.map((c) => <option key={c} value={c}>{c}</option>)}</Select>}
                          <label className="flex items-center gap-2 text-xs cursor-pointer p-2 rounded-lg bg-emerald-500/10">
                            <input type="checkbox" className="w-4 h-4 accent-emerald-500" checked={!!a.aiWrite} onChange={(e) => setAct(i, { aiWrite: e.target.checked })} />
                            <Sparkles className="w-3.5 h-3.5 text-emerald-500" /> Escrever titulo e conteudo com IA (Gemini) — se houver chave configurada
                          </label>
                          {!a.aiWrite && <><Input value={a.subject} onChange={(e) => setAct(i, { subject: e.target.value })} placeholder={a.action === 'open_ticket' ? 'Assunto do chamado' : a.action === 'notify' ? 'Título da notificação' : 'Assunto do e-mail'} />
                          <Textarea rows={2} value={a.message} onChange={(e) => setAct(i, { message: e.target.value })} placeholder="Mensagem (os valores avaliados são incluidos)" /></>}
                          {a.aiWrite && <p className="text-[11px] text-muted">A IA vai gerar o titulo e o texto com base na situação avaliada. Você pode escrever uma instrucao/tom abaixo (opcional).</p>}
                          {a.aiWrite && <Input value={a.message} onChange={(e) => setAct(i, { message: e.target.value })} placeholder="Instrucao pra IA (opcional): ex. tom motivador, foco em economia" />}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {chatFor && <ChatModal agent={chatFor} agents={agents} user={user} catMap={catMap} onClose={() => setChatFor(null)} />}
    </div>
  );
}

function ChatModal({ agent, agents = [], user, catMap, onClose }) {
  const navigate = useNavigate();
  const c = normConfig(agent.config);
  const foc = focusOf(c.focus);
  const { data: transactions = [] } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => Account.list() });
  const { data: investments = [] } = useQuery({ queryKey: ['investments'], queryFn: () => Investment.list() });
  const { data: debts = [] } = useQuery({ queryKey: ['debts'], queryFn: () => Debt.list() });
  const { data: goals = [] } = useQuery({ queryKey: ['goals'], queryFn: () => Goal.list() });
  const { data: subs = [] } = useQuery({ queryKey: ['subscriptions'], queryFn: () => Subscription.list() });
  const { data: invoices = [] } = useQuery({ queryKey: ['invoices'], queryFn: () => CreditCardInvoice.list() });
  const { data: settingsList = [] } = useQuery({ queryKey: ['appsettings'], queryFn: () => AppSettings.list() });
  const apiKey = settingsList[0]?.gemini_api_key;

  const ctx = useMemo(() => ({ user, transactions, accounts, categories: Object.values(catMap), catMap, investments, debts, goals, subs, invoices }), [user, transactions, accounts, catMap, investments, debts, goals, subs, invoices]);
  const persona = { name: agent.name, focus: c.focus, focusLabel: foc.label, emoji: c.emoji, personality: c.personality };

  const [msgs, setMsgs] = useState(() => [{ role: 'agent', text: c.greeting || `${agent.name} na area! Pergunte o que quiser sobre suas finanças.` }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [thinkers, setThinkers] = useState([]);
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, busy]);

  const suggByFocus = {
    geral: ['Como esta minha saude financeira?', 'Onde gasto mais?', 'Qual meu patrimônio?'],
    saldo: ['Quanto tenho?', 'Qual meu saldo total?'],
    gastos: ['Onde gasto mais?', 'Quanto gastei esse mes?'],
    patrimonio: ['Qual meu patrimônio?', 'Como estão meus investimentos?'],
    mercado: ['Como esta o dolar?', 'E o bitcoin?'],
    vencimentos: ['O que vence essa semana?', 'Quanto devo?'],
  };
  const suggestions = suggByFocus[c.focus] || suggByFocus.geral;

  const send = async (text) => {
    const q = (text ?? input).trim(); if (!q || busy) return;
    const history = msgs.filter((m) => m.role === 'user' || m.role === 'agent').slice(-6).map((m) => ({ role: m.role === 'user' ? 'user' : 'agent', text: m.text }));
    const del = deliberate(q, agents).slice(0, 4).map((x) => ({ emoji: x.emoji, name: x.name }));
    setThinkers(del.length ? del : [{ emoji: c.emoji }]);
    setMsgs((m) => [...m, { role: 'user', text: q }]); setInput(''); setBusy(true);
    try {
      const { panel, parts } = await converse({ question: q, ctx, agents, primary: agent, apiKey, history });
      const adds = [];
      if (panel && parts.length > 1) adds.push({ role: 'note', text: `🤝 ${parts.map((p) => p.robot.name).join(' e ')} responderam juntos` });
      const acts = suggestFor(q);
      parts.forEach((p, idx) => adds.push({ role: 'agent', text: p.text, emoji: p.robot.emoji, name: p.robot.name, actions: idx === parts.length - 1 ? acts : [] }));
      setMsgs((m) => [...m, ...adds]);
    }
    catch { setMsgs((m) => [...m, { role: 'agent', text: 'Ops, tive um problema para responder agora. Tente de novo.' }]); }
    finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} maxWidth="max-w-lg"
      title={<span className="flex items-center gap-2"><span className="text-xl">{c.emoji}</span> {agent.name} <Badge color="emerald">{foc.label}</Badge></span>}
      footer={
        <div className="w-full space-y-2">
          <div className="flex flex-wrap gap-1.5">{suggestions.map((s) => <button key={s} onClick={() => send(s)} disabled={busy} className="px-2.5 py-1 rounded-full text-xs bg-black/5 dark:bg-white/5 hover:bg-emerald-500/15 hover:text-emerald-600 transition">{s}</button>)}</div>
          <div className="flex items-center gap-2">
            <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder={`Pergunte ao ${agent.name}...`} className="flex-1" />
            <Button onClick={() => send()} disabled={busy || !input.trim()}>{busy ? <Spinner className="w-4 h-4" /> : <Send className="w-4 h-4" />}</Button>
          </div>
        </div>
      }>
      <div className="space-y-3 max-h-[52vh] overflow-y-auto pr-1">
        {msgs.map((m, i) => m.role === 'note' ? (
          <p key={i} className="text-center text-[11px] text-muted">{m.text}</p>
        ) : (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} gap-2`}>
            {m.role === 'agent' && <span className="w-8 h-8 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: 'linear-gradient(135deg,#10b98122,#6366f122)' }}>{m.emoji || c.emoji}</span>}
            <div className="max-w-[80%]">
              {m.role === 'agent' && m.name && m.name !== agent.name && <p className="text-[10px] text-muted mb-0.5">{m.name}</p>}
              <div className={`rounded-2xl px-3 py-2 text-sm leading-relaxed ${m.role === 'user' ? 'bg-emerald-500 text-white' : 'bg-black/5 dark:bg-white/10'}`}><Bold text={m.text} /></div>
              {m.actions?.length > 0 && <div className="flex flex-wrap gap-1.5 mt-1.5">{m.actions.map((a, k) => <button key={k} onClick={() => { onClose(); navigate(a.path); }} className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition">{a.label} →</button>)}</div>}
            </div>
          </div>
        ))}
        {busy && <div className="rounded-2xl px-3 py-2 bg-black/5 dark:bg-white/10 w-fit">{thinkers.length > 1 ? <CouncilThinking robots={thinkers} label="reunindo os robôs..." /> : <span className="text-sm text-muted">{agent.name} está pensando...</span>}</div>}
        <div ref={endRef} />
      </div>
    </Modal>
  );
}
