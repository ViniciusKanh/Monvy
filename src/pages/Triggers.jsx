import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trigger, Category, Support } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Button, Input, Select, Field, Modal, Spinner, EmptyState, Badge, Textarea } from '../components/ui';
import { Reveal } from '../components/Animated.jsx';
import { toast } from '../lib/toast.js';
import { formatCurrency } from '../lib/utils.js';
import { Zap, Plus, Pencil, Trash2, Clock, Filter, Play, Mail, X, GitBranch } from 'lucide-react';

// Metricas avaliadas no cron (mantidas em sincronia com api/cron/reminders.js)
const METRICS = [
  { k: 'total_balance', label: 'Saldo total das contas', unit: 'R$' },
  { k: 'month_balance', label: 'Saldo do mes (receita - despesa)', unit: 'R$' },
  { k: 'month_income', label: 'Receita do mes', unit: 'R$' },
  { k: 'month_expense', label: 'Despesa do mes (inclui cartao)', unit: 'R$' },
  { k: 'savings_rate', label: 'Taxa de poupanca do mes', unit: '%' },
  { k: 'category_spend', label: 'Gasto em uma categoria (mes)', unit: 'R$', needsCategory: true },
  { k: 'pending_count', label: 'Lancamentos vencidos nao pagos', unit: 'un' },
  { k: 'net_worth', label: 'Patrimonio liquido (contas + invest. - dividas)', unit: 'R$' },
  { k: 'debt_monthly', label: 'Parcelas de dividas por mes', unit: 'R$' },
  { k: 'open_tickets', label: 'Chamados em aberto', unit: 'un' },
];
const mInfo = (k) => METRICS.find((m) => m.k === k) || METRICS[0];
const OPS = [{ k: 'lt', label: 'menor que' }, { k: 'lte', label: 'menor ou igual a' }, { k: 'gt', label: 'maior que' }, { k: 'gte', label: 'maior ou igual a' }, { k: 'eq', label: 'igual a' }];
const opLabel = (k) => (OPS.find((o) => o.k === k) || OPS[0]).label;
const ACTIONS = [
  { k: 'email_alert', label: 'Enviar alerta por e-mail', desc: 'Manda um e-mail com sua mensagem e os valores avaliados.' },
  { k: 'notify', label: 'Notificar dentro do app', desc: 'Cria uma notificacao no sino e na tela de Notificacoes (sem e-mail).' },
  { k: 'open_ticket', label: 'Abrir um chamado', desc: 'Cria um chamado (ticket) pra voce resolver, na categoria escolhida.' },
  { k: 'email_summary', label: 'Enviar resumo financeiro', desc: 'Panorama completo: saldo, receitas, despesas e poupanca.' },
  { k: 'email_bills', label: 'Enviar vencimentos proximos', desc: 'Lista as contas e faturas a vencer nos proximos dias.' },
];
const actLabel = (k) => (ACTIONS.find((a) => a.k === k) || ACTIONS[0]).label;
const FREQ = [['daily', 'Todo dia'], ['weekly', 'Toda semana'], ['monthly', 'Todo mes']];
const freqLabel = (f) => (FREQ.find((x) => x[0] === f) || FREQ[0])[1];
const WEEKDAYS = ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado'];

const TEMPLATES = [
  { label: 'Saldo baixo', config: { match: 'all', conditions: [{ metric: 'total_balance', op: 'lt', value: 500 }], action: 'email_alert', subject: 'Saldo baixo', message: 'Seu saldo total nas contas ficou baixo. Vale segurar os gastos.' }, frequency: 'daily' },
  { label: 'Poupanca abaixo da meta', config: { match: 'all', conditions: [{ metric: 'savings_rate', op: 'lt', value: 10 }], action: 'email_alert', subject: 'Poupanca abaixo da meta', message: 'Sua taxa de poupanca do mes ficou abaixo da meta.' }, frequency: 'weekly' },
  { label: 'Mes no vermelho', config: { match: 'all', conditions: [{ metric: 'month_balance', op: 'lt', value: 0 }], action: 'email_alert', subject: 'Mes no vermelho', message: 'Voce esta gastando mais do que ganhou neste mes.' }, frequency: 'weekly' },
  { label: 'Gasto alto numa categoria', config: { match: 'all', conditions: [{ metric: 'category_spend', op: 'gt', value: 500, categoryId: '' }], action: 'email_alert', subject: 'Gasto alto em uma categoria', message: 'Uma categoria passou do valor que voce definiu.' }, frequency: 'weekly' },
  { label: 'Resumo diario', config: { match: 'all', conditions: [], action: 'email_summary', subject: '', message: '' }, frequency: 'daily' },
  { label: 'Vencimentos da semana', config: { match: 'all', conditions: [], action: 'email_bills', subject: '', message: '' }, frequency: 'weekly' },
];

const emptyForm = () => ({ name: '', frequency: 'daily', weekday: 1, enabled: true, config: { match: 'all', conditions: [], action: 'email_alert', subject: '', message: '' } });
const normConfig = (c) => ({ match: c?.match || 'all', conditions: Array.isArray(c?.conditions) ? c.conditions : [], action: c?.action || 'email_alert', subject: c?.subject || '', message: c?.message || '', ticketCategory: c?.ticketCategory || '' });

function fmtVal(metric, v) { const u = mInfo(metric).unit; if (u === 'R$') return formatCurrency(v); if (u === '%') return `${v}%`; return String(v); }
function condText(c, catMap) {
  const mi = mInfo(c.metric);
  const name = c.metric === 'category_spend' ? `Gasto em ${catMap[c.categoryId]?.name || 'categoria'}` : mi.label;
  return `${name} ${opLabel(c.op)} ${fmtVal(c.metric, c.value)}`;
}

export default function Triggers() {
  const qc = useQueryClient();
  const { data: triggers = [], isLoading } = useQuery({ queryKey: ['triggers'], queryFn: () => Trigger.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });
  const { data: sup } = useQuery({ queryKey: ['support-config'], queryFn: () => Support.config() });
  const ticketCats = sup?.categories || [];
  const expenseCats = categories.filter((c) => c.type === 'expense');
  const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());

  const inval = () => qc.invalidateQueries({ queryKey: ['triggers'] });
  const save = useMutation({ mutationFn: (p) => editing ? Trigger.update(editing.id, p) : Trigger.create(p), onSuccess: () => { inval(); setModal(false); toast.success('Automacao salva'); }, onError: (e) => toast.error(e.message || 'Falha') });
  const del = useMutation({ mutationFn: (id) => Trigger.remove(id), onSuccess: inval });
  const toggle = useMutation({ mutationFn: ({ id, enabled }) => Trigger.update(id, { enabled }), onSuccess: inval });

  const openNew = () => { setEditing(null); setForm(emptyForm()); setModal(true); };
  const openEdit = (t) => { setEditing(t); setForm({ name: t.name || '', frequency: t.frequency || 'daily', weekday: t.weekday ?? 1, enabled: t.enabled !== false, config: normConfig(t.config) }); setModal(true); };
  const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setC = (k, v) => setForm((f) => ({ ...f, config: { ...f.config, [k]: v } }));
  const setCond = (i, patch) => setForm((f) => ({ ...f, config: { ...f.config, conditions: f.config.conditions.map((c, idx) => idx === i ? { ...c, ...patch } : c) } }));
  const addCond = () => setForm((f) => ({ ...f, config: { ...f.config, conditions: [...f.config.conditions, { metric: 'total_balance', op: 'lt', value: 0 }] } }));
  const rmCond = (i) => setForm((f) => ({ ...f, config: { ...f.config, conditions: f.config.conditions.filter((_, idx) => idx !== i) } }));
  const applyTemplate = (tpl) => setForm((f) => ({ ...f, name: f.name || tpl.label, frequency: tpl.frequency, config: normConfig(tpl.config) }));

  const submit = () => {
    if (!form.name) return toast.error('De um nome a automacao');
    const cfg = form.config;
    if (cfg.action !== 'email_summary' && cfg.action !== 'email_bills' && cfg.conditions.length === 0) return toast.error('Adicione ao menos uma condicao ou escolha uma acao de envio direto');
    save.mutate({ ...form, weekday: Number(form.weekday), type: 'custom' });
  };

  const cfg = form.config;

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageHeader
        title={<span className="flex items-center gap-2"><Zap className="w-6 h-6 text-amber-500" /> Gatilhos & Automacoes</span>}
        subtitle="Monte regras no estilo QUANDO → SE → ENTAO. Personalize condicoes e acoes."
        actions={<Button onClick={openNew}><Plus className="w-4 h-4" /> Nova automacao</Button>}
      />

      <div className="flex items-start gap-2 text-xs p-3 rounded-xl bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
        <Clock className="w-4 h-4 mt-0.5 shrink-0" />
        <span>As automacoes sao avaliadas uma vez por dia (de manha), na frequencia que voce escolher. Quando as condicoes forem atendidas, a acao (e-mail) e disparada para o seu endereco. E preciso que o envio de e-mail esteja configurado pelo administrador.</span>
      </div>

      {isLoading ? <div className="flex justify-center py-10"><Spinner className="w-6 h-6 text-emerald-500" /></div>
        : triggers.length === 0 ? <Card><EmptyState icon={Zap} title="Nenhuma automacao" subtitle="Crie regras personalizadas: QUANDO acontecer algo, ENTAO me avise." action={<Button onClick={openNew}><Plus className="w-4 h-4" /> Nova automacao</Button>} /></Card>
        : (
          <div className="grid md:grid-cols-2 gap-4">
            {triggers.map((t, i) => { const c = normConfig(t.config); const on = t.enabled !== false; return (
              <Reveal key={t.id} i={Math.min(i, 8)}>
                <Card className={`hover-lift h-full ${on ? '' : 'opacity-70'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2"><span className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: on ? '#f59e0b' : '#94a3b8' }}><Zap className="w-5 h-5" /></span><div><p className="font-semibold leading-tight">{t.name}</p><p className="text-xs text-muted">{freqLabel(t.frequency)}{t.frequency === 'weekly' ? ` · ${WEEKDAYS[t.weekday ?? 1]}` : ''}</p></div></div>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => del.mutate(t.id)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1.5 text-sm">
                    <div className="flex items-start gap-2"><span className="text-[10px] font-bold text-sky-500 bg-sky-500/10 rounded px-1.5 py-0.5 mt-0.5">SE</span>
                      <span className="text-muted">{c.conditions.length === 0 ? 'sempre (na frequencia definida)' : c.conditions.map((x) => condText(x, catMap)).join(c.match === 'any' ? '  OU  ' : '  E  ')}</span>
                    </div>
                    <div className="flex items-center gap-2"><span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 rounded px-1.5 py-0.5">ENTAO</span><span className="text-muted flex items-center gap-1"><Mail className="w-3 h-3" /> {actLabel(c.action)}</span></div>
                  </div>
                  <label className="flex items-center justify-between mt-3 pt-3 border-t border-[hsl(var(--border))] text-sm cursor-pointer">
                    <span>{on ? 'Ativa' : 'Pausada'}</span>
                    <input type="checkbox" className="w-5 h-5 accent-emerald-500" checked={on} onChange={(e) => toggle.mutate({ id: t.id, enabled: e.target.checked })} />
                  </label>
                </Card>
              </Reveal>
            ); })}
          </div>
        )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar automacao' : 'Nova automacao'} maxWidth="max-w-xl"
        footer={<><Button variant="outline" onClick={() => setModal(false)}>Cancelar</Button><Button onClick={submit} disabled={save.isPending}>{save.isPending ? <Spinner className="w-4 h-4" /> : 'Salvar'}</Button></>}>
        <div className="space-y-4">
          <Field label="Nome"><Input value={form.name} onChange={(e) => setF('name', e.target.value)} placeholder="Ex: Me avise se o saldo ficar baixo" /></Field>

          <div>
            <p className="text-xs text-muted mb-1.5">Comece de um modelo (opcional):</p>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATES.map((tpl) => <button key={tpl.label} type="button" onClick={() => applyTemplate(tpl)} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-black/5 dark:bg-white/5 hover:bg-emerald-500/15 hover:text-emerald-600 transition">{tpl.label}</button>)}
            </div>
          </div>

          {/* QUANDO */}
          <div className="rounded-xl border border-[hsl(var(--border))] p-3">
            <div className="flex items-center gap-2 mb-2"><span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 rounded px-1.5 py-0.5">QUANDO</span><span className="text-sm font-medium">Frequencia de avaliacao</span></div>
            <div className="grid grid-cols-2 gap-2">
              <Select value={form.frequency} onChange={(e) => setF('frequency', e.target.value)}>{FREQ.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
              {form.frequency === 'weekly' && <Select value={form.weekday} onChange={(e) => setF('weekday', e.target.value)}>{WEEKDAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}</Select>}
            </div>
          </div>

          {/* SE */}
          <div className="rounded-xl border border-[hsl(var(--border))] p-3">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <div className="flex items-center gap-2"><span className="text-[10px] font-bold text-sky-500 bg-sky-500/10 rounded px-1.5 py-0.5">SE</span><span className="text-sm font-medium flex items-center gap-1"><Filter className="w-3.5 h-3.5" /> Condicoes</span></div>
              {cfg.conditions.length > 1 && (
                <div className="inline-flex p-0.5 rounded-lg bg-black/5 dark:bg-white/5 text-xs">
                  {[['all', 'Atender TODAS'], ['any', 'QUALQUER uma']].map(([v, l]) => <button key={v} type="button" onClick={() => setC('match', v)} className={`px-2 py-1 rounded-md font-semibold ${cfg.match === v ? 'bg-[hsl(var(--card))] shadow' : 'text-muted'}`}>{l}</button>)}
                </div>
              )}
            </div>
            <div className="space-y-2">
              {cfg.conditions.length === 0 && <p className="text-xs text-muted">Sem condicoes = dispara sempre na frequencia escolhida (util para o Resumo diario).</p>}
              {cfg.conditions.map((c, i) => {
                const mi = mInfo(c.metric);
                return (
                  <div key={i} className="rounded-lg bg-black/5 dark:bg-white/5 p-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <Select value={c.metric} onChange={(e) => setCond(i, { metric: e.target.value })} className="flex-1">{METRICS.map((m) => <option key={m.k} value={m.k}>{m.label}</option>)}</Select>
                      <button type="button" onClick={() => rmCond(i)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 shrink-0"><X className="w-4 h-4" /></button>
                    </div>
                    {mi.needsCategory && (
                      <Select value={c.categoryId || ''} onChange={(e) => setCond(i, { categoryId: e.target.value })}><option value="">Selecione a categoria</option>{expenseCats.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>
                    )}
                    <div className="flex items-center gap-2">
                      <Select value={c.op} onChange={(e) => setCond(i, { op: e.target.value })} className="flex-1">{OPS.map((o) => <option key={o.k} value={o.k}>{o.label}</option>)}</Select>
                      <Input type="number" step="0.01" value={c.value} onChange={(e) => setCond(i, { value: Number(e.target.value) })} className="w-28" />
                      <span className="text-xs text-muted w-6">{mi.unit}</span>
                    </div>
                  </div>
                );
              })}
              <Button size="sm" variant="outline" onClick={addCond}><Plus className="w-4 h-4" /> Adicionar condicao</Button>
            </div>
          </div>

          {/* ENTAO */}
          <div className="rounded-xl border border-[hsl(var(--border))] p-3">
            <div className="flex items-center gap-2 mb-2"><span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 rounded px-1.5 py-0.5">ENTAO</span><span className="text-sm font-medium flex items-center gap-1"><Play className="w-3.5 h-3.5" /> Acao</span></div>
            <Select value={cfg.action} onChange={(e) => setC('action', e.target.value)}>{ACTIONS.map((a) => <option key={a.k} value={a.k}>{a.label}</option>)}</Select>
            <p className="text-xs text-muted mt-1">{ACTIONS.find((a) => a.k === cfg.action)?.desc}</p>
            {(cfg.action === 'email_alert' || cfg.action === 'open_ticket' || cfg.action === 'notify') && (
              <div className="mt-2 space-y-2">
                {cfg.action === 'open_ticket' && (
                  <Select value={cfg.ticketCategory || ''} onChange={(e) => setC('ticketCategory', e.target.value)}>
                    <option value="">Categoria do chamado</option>
                    {ticketCats.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Select>
                )}
                <Input value={cfg.subject} onChange={(e) => setC('subject', e.target.value)} placeholder={cfg.action === 'open_ticket' ? 'Assunto do chamado' : 'Assunto do e-mail (opcional)'} />
                <Textarea rows={2} value={cfg.message} onChange={(e) => setC('message', e.target.value)} placeholder={cfg.action === 'open_ticket' ? 'Descricao do chamado (a situacao avaliada e incluida)' : 'Mensagem do alerta (os valores avaliados sao incluidos)'} />
              </div>
            )}
          </div>

          <label className="flex items-center justify-between text-sm"><span>Ativa</span><input type="checkbox" className="w-5 h-5 accent-emerald-500" checked={form.enabled} onChange={(e) => setF('enabled', e.target.checked)} /></label>
        </div>
      </Modal>
    </div>
  );
}
