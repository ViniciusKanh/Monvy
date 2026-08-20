import { useMemo, useRef, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trigger, Category, Account, Transaction, Investment, Debt, Goal, Subscription, CreditCardInvoice, Support, AppSettings } from '../api/entities.js';
import { useAuth } from '../context/AuthContext.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Button, Input, Select, Field, Modal, Spinner, EmptyState, Badge, Textarea } from '../components/ui';
import { Reveal } from '../components/Animated.jsx';
import { toast } from '../lib/toast.js';
import { converse } from '../lib/chat.js';
import { deliberate } from '../lib/assistant.js';
import { CouncilThinking } from '../components/Splash.jsx';
import { Bot, Plus, Pencil, Trash2, MessageSquare, Send, Sparkles, X, Filter, Play, Clock, Zap, Wallet, BarChart3, TrendingUp, Globe, CalendarClock } from 'lucide-react';

const FOCUS = [
  { k: 'geral', label: 'Assistente geral', emoji: '🤖', icon: Bot, desc: 'Responde sobre tudo: saldo, gastos, dividas, patrimonio, metas...' },
  { k: 'saldo', label: 'Saldo & Contas', emoji: '💰', icon: Wallet, desc: 'De olho no seu saldo e movimentacao das contas.' },
  { k: 'gastos', label: 'Gastos & Categorias', emoji: '📊', icon: BarChart3, desc: 'Monitora onde voce mais gasta e estouros.' },
  { k: 'entradas', label: 'Entradas & Renda', emoji: '💵', icon: TrendingUp, desc: 'Acompanha o que entra: salarios e recebimentos.' },
  { k: 'patrimonio', label: 'Patrimonio & Investimentos', emoji: '📈', icon: TrendingUp, desc: 'Acompanha patrimonio liquido e carteira.' },
  { k: 'mercado', label: 'Mercado & Impostos', emoji: '🌎', icon: Globe, desc: 'Cotacoes (dolar, euro, cripto), Selic/IPCA e Imposto de Renda.' },
  { k: 'vencimentos', label: 'Vencimentos & Contas', emoji: '📅', icon: CalendarClock, desc: 'Avisa o que esta pra vencer.' },
];
const focusOf = (k) => FOCUS.find((f) => f.k === k) || FOCUS[0];
const EMOJIS = ['🤖', '💰', '📊', '📈', '🌎', '📅', '🦾', '🧠', '🛡️', '🦉', '🐱', '🚀', '💡', '🕵️', '📎'];

const METRICS = [
  { k: 'total_balance', label: 'Saldo total das contas', unit: 'R$' },
  { k: 'month_balance', label: 'Saldo do mes (receita - despesa)', unit: 'R$' },
  { k: 'month_income', label: 'Receita do mes', unit: 'R$' },
  { k: 'month_expense', label: 'Despesa do mes (inclui cartao)', unit: 'R$' },
  { k: 'savings_rate', label: 'Taxa de poupanca do mes', unit: '%' },
  { k: 'category_spend', label: 'Gasto em uma categoria (mes)', unit: 'R$', needsCategory: true },
  { k: 'pending_count', label: 'Lancamentos vencidos nao pagos', unit: 'un' },
  { k: 'net_worth', label: 'Patrimonio liquido', unit: 'R$' },
  { k: 'debt_monthly', label: 'Parcelas de dividas por mes', unit: 'R$' },
  { k: 'goals_saved', label: 'Guardado em metas/cofres', unit: 'R$' },
  { k: 'card_invoice_total', label: 'Faturas de cartao em aberto', unit: 'R$' },
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
  { k: 'email_bills', label: 'Enviar vencimentos proximos' },
];
const actLabel = (k) => (ACTIONS.find((a) => a.k === k) || ACTIONS[0]).label;
const FREQ = [['daily', 'Todo dia'], ['weekly', 'Toda semana'], ['monthly', 'Todo mes']];
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

// Galeria de robos prontos (1 clique). Acao padrao = notificacao no app (nao exige e-mail).
const GALLERY = [
  { name: 'Vigia dos Gastos', emoji: '📊', tag: 'Gastos', desc: 'Avisa quando seus gastos do mes passam de R$ 3.000.', frequency: 'weekly',
    config: { focus: 'gastos', emoji: '📊', greeting: 'Fico de olho nos seus gastos.', monitor: true, match: 'all', conditions: [{ metric: 'month_expense', op: 'gt', value: 3000 }], actions: [{ action: 'notify', subject: 'Gastos acima do previsto', message: 'Seus gastos do mes passaram de R$ 3.000.' }] } },
  { name: 'Radar de Vencimentos', emoji: '📅', tag: 'Vencimentos', desc: 'Avisa quando ha contas vencidas ou a vencer.', frequency: 'weekly',
    config: { focus: 'vencimentos', emoji: '📅', greeting: 'Nao deixo nenhuma conta passar.', monitor: true, match: 'all', conditions: [{ metric: 'pending_count', op: 'gte', value: 1 }], actions: [{ action: 'notify', subject: 'Voce tem contas a pagar', message: 'Ha lancamentos vencidos ou proximos do vencimento.' }] } },
  { name: 'Guardiao das Entradas', emoji: '💵', tag: 'Entradas', desc: 'Resumo mensal do que entrou (salarios e recebimentos).', frequency: 'monthly',
    config: { focus: 'entradas', emoji: '💵', greeting: 'Acompanho tudo que entra na sua conta.', monitor: true, match: 'all', conditions: [], actions: [{ action: 'notify', subject: 'Resumo de entradas', message: 'Confira o que voce recebeu no ultimo periodo.' }], dayOfMonth: 1 } },
  { name: 'Analista de Mercado & Impostos', emoji: '🌎', tag: 'Mercado', desc: 'Tira duvidas de dolar, euro, cripto, Selic/IPCA e Imposto de Renda no chat.', frequency: 'weekly',
    config: { focus: 'mercado', emoji: '🌎', greeting: 'Pergunte sobre cotacoes, taxas e impostos.', monitor: false } },
  { name: 'Consultor de Patrimonio', emoji: '📈', tag: 'Patrimonio', desc: 'Resumo mensal do seu patrimonio e investimentos.', frequency: 'monthly',
    config: { focus: 'patrimonio', emoji: '📈', greeting: 'Cuido do crescimento do seu patrimonio.', monitor: true, match: 'all', conditions: [], actions: [{ action: 'notify', subject: 'Resumo do patrimonio', message: 'Veja como esta seu patrimonio este mes.' }], dayOfMonth: 1 } },
  { name: 'Alfred', emoji: '🦾', tag: 'Geral', desc: 'Assistente geral: responde qualquer pergunta sobre suas financas.', frequency: 'weekly',
    config: { focus: 'geral', emoji: '🦾', greeting: 'Pergunte o que quiser sobre suas financas.', monitor: false } },
];

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
  const quickCreate = useMutation({ mutationFn: (p) => Trigger.create({ name: p.name, frequency: p.frequency || 'weekly', weekday: 1, enabled: true, type: 'agent', config: normConfig(p.config) }), onSuccess: () => { inval(); toast.success('Robo adicionado! Ja esta trabalhando pra voce.'); }, onError: (e) => toast.error(e.message || 'Falha') });

  const openNew = () => { setEditing(null); setForm(emptyForm()); setModal(true); };
  const openEdit = (t) => { setEditing(t); setForm({ name: t.name || '', frequency: t.frequency || 'weekly', weekday: t.weekday ?? 1, enabled: t.enabled !== false, config: normConfig(t.config) }); setModal(true); };
  const customFrom = (p) => { setEditing(null); setForm({ ...emptyForm(), name: p.name, frequency: p.frequency || 'weekly', config: normConfig(p.config) }); setModal(true); };
  const ownedFocuses = new Set(agents.map((a) => normConfig(a.config).focus));

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
      if (!directOnly && cfg.conditions.length === 0) return toast.error('Adicione ao menos uma condicao ou use apenas acoes de envio direto');
    }
    save.mutate({ ...form, weekday: Number(form.weekday), type: 'agent' });
  };

  const cfg = form.config;

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageHeader
        title={<span className="flex items-center gap-2"><Bot className="w-6 h-6 text-emerald-500" /> Agentes & Robos</span>}
        subtitle="Crie robos com nome e foco. Eles monitoram suas financas e conversam com voce."
        actions={<Button onClick={openNew}><Plus className="w-4 h-4" /> Novo robo</Button>}
      />

      {/* GALERIA 1-CLIQUE */}
      <Card>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h3 className="font-semibold flex items-center gap-2"><Sparkles className="w-4 h-4 text-emerald-500" /> Adicionar robô em 1 clique</h3>
          <span className="text-xs text-muted">Prontos pra usar — sem precisar configurar nada</span>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {GALLERY.map((p) => { const owned = ownedFocuses.has(p.config.focus); return (
            <div key={p.name} className="rounded-2xl border border-[hsl(var(--border))] p-3 flex flex-col hover-lift">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: 'linear-gradient(135deg,#10b98122,#6366f122)' }}>{p.emoji}</span>
                <div className="min-w-0"><p className="font-semibold text-sm leading-tight truncate">{p.name}</p><span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-muted">{p.tag}</span></div>
              </div>
              <p className="text-xs text-muted flex-1 mt-1">{p.desc}</p>
              <div className="flex items-center gap-2 mt-3">
                <Button size="sm" className="flex-1" onClick={() => quickCreate.mutate(p)} disabled={quickCreate.isPending}><Plus className="w-4 h-4" /> Adicionar</Button>
                <button onClick={() => customFrom(p)} className="text-xs text-muted hover:text-emerald-600 whitespace-nowrap">ajustar</button>
              </div>
              {owned && <p className="text-[10px] text-amber-500 mt-1">Voce ja tem um robô deste tipo</p>}
            </div>
          ); })}
        </div>
        <p className="text-xs text-muted mt-3">A ação padrão é <b>notificação no app</b> (sem precisar de e-mail). Quer personalizar? Use "ajustar" ou <button onClick={openNew} className="underline text-emerald-600">criar do zero</button>.</p>
      </Card>

      {isLoading ? <div className="flex justify-center py-10"><Spinner className="w-6 h-6 text-emerald-500" /></div>
        : agents.length === 0 ? <Card><EmptyState icon={Bot} title="Nenhum robo ainda" subtitle="Crie um robo para monitorar e conversar sobre suas financas." action={<Button onClick={openNew}><Plus className="w-4 h-4" /> Novo robo</Button>} /></Card>
        : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((t, i) => { const c = normConfig(t.config); const on = t.enabled !== false; const foc = focusOf(c.focus); return (
              <Reveal key={t.id} i={Math.min(i, 8)}>
                <Card className="hover-lift h-full flex flex-col">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-sm" style={{ background: 'linear-gradient(135deg,#10b98122,#6366f122)' }}>{c.emoji}</span>
                      <div><p className="font-semibold leading-tight">{t.name}</p><p className="text-xs text-muted">{foc.label}</p></div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => del.mutate(t.id)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  {c.monitor ? (
                    <div className="mt-3 text-xs space-y-1 flex-1">
                      <p className="text-muted"><Clock className="w-3 h-3 inline mr-1" />{freqLabel(t.frequency)}{t.frequency === 'weekly' ? ` · ${WEEKDAYS[t.weekday ?? 1]}` : t.frequency === 'monthly' ? ` · dia ${c.dayOfMonth || 1}` : ''}</p>
                      <p className="text-muted truncate"><Filter className="w-3 h-3 inline mr-1" />{c.conditions.length ? c.conditions.map((x) => `${mInfo(x.metric).label} ${opLabel(x.op)} ${x.value}`).join(c.match === 'any' ? ' ou ' : ' e ') : 'sempre'}</p>
                      <p className="text-emerald-600 dark:text-emerald-400 truncate"><Play className="w-3 h-3 inline mr-1" />{c.actions.map((a) => actLabel(a.action)).join(', ')}</p>
                    </div>
                  ) : <p className="mt-3 text-xs text-muted flex-1">Somente chat (sem monitoramento automatico).</p>}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[hsl(var(--border))]">
                    <Button size="sm" className="flex-1" onClick={() => setChatFor(t)}><MessageSquare className="w-4 h-4" /> Conversar</Button>
                    {c.monitor && <label className="flex items-center gap-1.5 text-xs cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-emerald-500" checked={on} onChange={(e) => toggle.mutate({ id: t.id, enabled: e.target.checked })} />{on ? 'ativo' : 'pausado'}</label>}
                  </div>
                </Card>
              </Reveal>
            ); })}
          </div>
        )}

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
          <Field label="Mensagem de boas-vindas (opcional)"><Input value={cfg.greeting} onChange={(e) => setC('greeting', e.target.value)} placeholder="Ex: Pergunte o que quiser sobre suas financas." /></Field>
          <Field label="Personalidade / estilo (opcional)"><Textarea rows={2} value={cfg.personality} onChange={(e) => setC('personality', e.target.value)} placeholder="Ex: direto e objetivo; ou bem-humorado e motivador. Usado quando a IA (Gemini) esta ativa." /></Field>

          <label className="flex items-center justify-between p-3 rounded-xl border border-[hsl(var(--border))] cursor-pointer">
            <span className="text-sm font-medium flex items-center gap-2"><Zap className="w-4 h-4 text-amber-500" /> Monitoramento automatico</span>
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
                  <div className="flex items-center gap-2"><span className="text-[10px] font-bold text-sky-500 bg-sky-500/10 rounded px-1.5 py-0.5">SE</span><span className="text-sm font-medium">Condicoes</span></div>
                  {cfg.conditions.length > 1 && <div className="inline-flex p-0.5 rounded-lg bg-black/5 dark:bg-white/5 text-xs">{[['all', 'TODAS'], ['any', 'QUALQUER']].map(([v, l]) => <button key={v} type="button" onClick={() => setC('match', v)} className={`px-2 py-1 rounded-md font-semibold ${cfg.match === v ? 'bg-[hsl(var(--card))] shadow' : 'text-muted'}`}>{l}</button>)}</div>}
                </div>
                <div className="space-y-2">
                  {cfg.conditions.length === 0 && <p className="text-xs text-muted">Sem condicoes = dispara sempre na frequencia (util para resumo/vencimentos).</p>}
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
                  <Button size="sm" variant="outline" onClick={addCond}><Plus className="w-4 h-4" /> Adicionar condicao</Button>
                </div>
              </div>

              <div className="rounded-xl border border-[hsl(var(--border))] p-3">
                <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 rounded px-1.5 py-0.5">ENTAO</span><span className="text-sm font-medium">Acoes ({cfg.actions.length})</span></div><Button size="sm" variant="outline" onClick={addAct}><Plus className="w-4 h-4" /> Acao</Button></div>
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
                          {!a.aiWrite && <><Input value={a.subject} onChange={(e) => setAct(i, { subject: e.target.value })} placeholder={a.action === 'open_ticket' ? 'Assunto do chamado' : a.action === 'notify' ? 'Titulo da notificacao' : 'Assunto do e-mail'} />
                          <Textarea rows={2} value={a.message} onChange={(e) => setAct(i, { message: e.target.value })} placeholder="Mensagem (os valores avaliados sao incluidos)" /></>}
                          {a.aiWrite && <p className="text-[11px] text-muted">A IA vai gerar o titulo e o texto com base na situacao avaliada. Voce pode escrever uma instrucao/tom abaixo (opcional).</p>}
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

  const [msgs, setMsgs] = useState(() => [{ role: 'agent', text: c.greeting || `${agent.name} na area! Pergunte o que quiser sobre suas financas.` }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [thinkers, setThinkers] = useState([]);
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, busy]);

  const suggByFocus = {
    geral: ['Como esta minha saude financeira?', 'Onde gasto mais?', 'Qual meu patrimonio?'],
    saldo: ['Quanto tenho?', 'Qual meu saldo total?'],
    gastos: ['Onde gasto mais?', 'Quanto gastei esse mes?'],
    patrimonio: ['Qual meu patrimonio?', 'Como estao meus investimentos?'],
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
      for (const p of parts) adds.push({ role: 'agent', text: p.text, emoji: p.robot.emoji, name: p.robot.name });
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
            </div>
          </div>
        ))}
        {busy && <div className="rounded-2xl px-3 py-2 bg-black/5 dark:bg-white/10 w-fit">{thinkers.length > 1 ? <CouncilThinking robots={thinkers} label="reunindo os robôs..." /> : <span className="text-sm text-muted">{agent.name} está pensando...</span>}</div>}
        <div ref={endRef} />
      </div>
    </Modal>
  );
}
