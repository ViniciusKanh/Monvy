import { useMemo, useRef, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trigger, Category, Account, Transaction, Investment, Debt, Goal, Subscription, CreditCardInvoice, Support } from '../api/entities.js';
import { useAuth } from '../context/AuthContext.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Button, Input, Select, Field, Modal, Spinner, EmptyState, Badge, Textarea } from '../components/ui';
import { Reveal } from '../components/Animated.jsx';
import { toast } from '../lib/toast.js';
import { formatCurrency } from '../lib/utils.js';
import { askAssistant } from '../lib/assistant.js';
import { Bot, Plus, Pencil, Trash2, MessageSquare, Send, Sparkles, X, Filter, Play, Clock, Zap, Wallet, BarChart3, TrendingUp, Globe, CalendarClock } from 'lucide-react';

const FOCUS = [
  { k: 'geral', label: 'Assistente geral', emoji: '🤖', icon: Bot, desc: 'Responde sobre tudo: saldo, gastos, dividas, patrimonio, metas...' },
  { k: 'saldo', label: 'Saldo & Contas', emoji: '💰', icon: Wallet, desc: 'De olho no seu saldo e movimentacao das contas.' },
  { k: 'gastos', label: 'Gastos & Categorias', emoji: '📊', icon: BarChart3, desc: 'Monitora onde voce mais gasta e estouros.' },
  { k: 'patrimonio', label: 'Patrimonio & Investimentos', emoji: '📈', icon: TrendingUp, desc: 'Acompanha patrimonio liquido e carteira.' },
  { k: 'mercado', label: 'Mercado (nacional/intl)', emoji: '🌎', icon: Globe, desc: 'Cotacoes de dolar, euro, cripto e indicadores.' },
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

const emptyAction = () => ({ action: 'notify', subject: '', message: '', ticketCategory: '' });
const emptyForm = () => ({ name: '', frequency: 'weekly', weekday: 1, enabled: true, config: { focus: 'geral', emoji: '🤖', greeting: '', monitor: false, match: 'all', conditions: [], actions: [emptyAction()], cooldownDays: 0, dayOfMonth: 1 } });
const normConfig = (c) => ({
  focus: c?.focus || 'geral', emoji: c?.emoji || '🤖', greeting: c?.greeting || '', monitor: !!c?.monitor,
  match: c?.match || 'all',
  conditions: Array.isArray(c?.conditions) ? c.conditions : [],
  cooldownDays: Number(c?.cooldownDays) || 0,
  dayOfMonth: Number(c?.dayOfMonth) || 1,
  actions: Array.isArray(c?.actions) && c.actions.length ? c.actions.map((a) => ({ action: a.action || 'notify', subject: a.subject || '', message: a.message || '', ticketCategory: a.ticketCategory || '' })) : [{ action: c?.action || 'notify', subject: c?.subject || '', message: c?.message || '', ticketCategory: c?.ticketCategory || '' }],
});

const PRESETS = [
  { name: 'Alfred', config: { focus: 'geral', emoji: '🦾', greeting: 'Pergunte o que quiser sobre suas financas.', monitor: false } },
  { name: 'Guardiao do Saldo', config: { focus: 'saldo', emoji: '🛡️', monitor: true, match: 'all', conditions: [{ metric: 'total_balance', op: 'lt', value: 500 }], actions: [{ action: 'notify', subject: 'Saldo baixo', message: 'Seu saldo total ficou baixo.' }] }, frequency: 'daily' },
  { name: 'Vigia dos Gastos', config: { focus: 'gastos', emoji: '📊', monitor: true, match: 'all', conditions: [{ metric: 'month_expense', op: 'gt', value: 3000 }], actions: [{ action: 'email_alert', subject: 'Gastos altos no mes' }] }, frequency: 'weekly' },
  { name: 'Radar de Vencimentos', config: { focus: 'vencimentos', emoji: '📅', monitor: true, match: 'all', conditions: [], actions: [{ action: 'email_bills' }] }, frequency: 'weekly' },
  { name: 'Olheiro do Patrimonio', config: { focus: 'patrimonio', emoji: '📈', monitor: true, match: 'all', conditions: [], actions: [{ action: 'email_summary' }] }, frequency: 'monthly' },
  { name: 'Sentinela do Mercado', config: { focus: 'mercado', emoji: '🌎', monitor: false } },
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

  const openNew = () => { setEditing(null); setForm(emptyForm()); setModal(true); };
  const openEdit = (t) => { setEditing(t); setForm({ name: t.name || '', frequency: t.frequency || 'weekly', weekday: t.weekday ?? 1, enabled: t.enabled !== false, config: normConfig(t.config) }); setModal(true); };
  const applyPreset = (p) => { setEditing(null); setForm({ ...emptyForm(), name: p.name, frequency: p.frequency || 'weekly', config: normConfig(p.config) }); setModal(true); };

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

      <div className="flex items-start gap-2 text-xs p-3 rounded-xl bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
        <Sparkles className="w-4 h-4 mt-0.5 shrink-0" />
        <span>Cada robo tem um <b>chat</b> que le seus dados e responde em linguagem natural (100% local, sem IA de terceiros). Opcionalmente, ative o <b>monitoramento automatico</b> para receber avisos por e-mail ou no app.</span>
      </div>

      {agents.length === 0 && (
        <Card>
          <p className="text-sm font-medium mb-2">Comece com um modelo de robo:</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => <button key={p.name} onClick={() => applyPreset(p)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-black/5 dark:bg-white/5 hover:bg-emerald-500/15 hover:text-emerald-600 transition">{p.config.emoji} {p.name}</button>)}
          </div>
        </Card>
      )}

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
                          <Input value={a.subject} onChange={(e) => setAct(i, { subject: e.target.value })} placeholder={a.action === 'open_ticket' ? 'Assunto do chamado' : a.action === 'notify' ? 'Titulo da notificacao' : 'Assunto do e-mail'} />
                          <Textarea rows={2} value={a.message} onChange={(e) => setAct(i, { message: e.target.value })} placeholder="Mensagem (os valores avaliados sao incluidos)" />
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

      {chatFor && <ChatModal agent={chatFor} user={user} catMap={catMap} onClose={() => setChatFor(null)} />}
    </div>
  );
}

function ChatModal({ agent, user, catMap, onClose }) {
  const c = normConfig(agent.config);
  const foc = focusOf(c.focus);
  const { data: transactions = [] } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => Account.list() });
  const { data: investments = [] } = useQuery({ queryKey: ['investments'], queryFn: () => Investment.list() });
  const { data: debts = [] } = useQuery({ queryKey: ['debts'], queryFn: () => Debt.list() });
  const { data: goals = [] } = useQuery({ queryKey: ['goals'], queryFn: () => Goal.list() });
  const { data: subs = [] } = useQuery({ queryKey: ['subscriptions'], queryFn: () => Subscription.list() });
  const { data: invoices = [] } = useQuery({ queryKey: ['invoices'], queryFn: () => CreditCardInvoice.list() });

  const ctx = useMemo(() => ({ user, transactions, accounts, categories: Object.values(catMap), catMap, investments, debts, goals, subs, invoices }), [user, transactions, accounts, catMap, investments, debts, goals, subs, invoices]);

  const [msgs, setMsgs] = useState(() => [{ role: 'agent', text: c.greeting || `${agent.name} na area! Pergunte o que quiser sobre suas financas.` }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
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
    setMsgs((m) => [...m, { role: 'user', text: q }]); setInput(''); setBusy(true);
    try { const r = await askAssistant(q, ctx, agent); setMsgs((m) => [...m, { role: 'agent', text: r.text }]); }
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
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} gap-2`}>
            {m.role === 'agent' && <span className="w-8 h-8 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: 'linear-gradient(135deg,#10b98122,#6366f122)' }}>{c.emoji}</span>}
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${m.role === 'user' ? 'bg-emerald-500 text-white' : 'bg-black/5 dark:bg-white/10'}`}><Bold text={m.text} /></div>
          </div>
        ))}
        {busy && <div className="flex justify-start gap-2"><span className="w-8 h-8 rounded-xl flex items-center justify-center text-lg" style={{ background: 'linear-gradient(135deg,#10b98122,#6366f122)' }}>{c.emoji}</span><div className="rounded-2xl px-3 py-2 bg-black/5 dark:bg-white/10 text-sm text-muted">digitando...</div></div>}
        <div ref={endRef} />
      </div>
    </Modal>
  );
}
