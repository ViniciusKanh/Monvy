import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Category, Transaction } from '../api/entities.js';
import { Button, Input, Select, Field, Modal, Spinner, EmptyState, Badge } from '../components/ui';
import { Reveal, AnimatedValue } from '../components/Animated.jsx';
import { PageTitle, StatCard, Panel, Donut, DeltaChip, Bar, Segmented, InsightRow, GlowButton, pct1 } from '../components/kit.jsx';
import { formatCurrency, monthKey, inMonth } from '../lib/utils.js';
import { colorAt } from '../lib/analytics.js';
import { CATEGORY_ICONS, categoryIcon, categoryIconKey } from '../lib/categoryIcons.js';
import { Plus, Tags, Pencil, Trash2, TrendingUp, TrendingDown, SlidersHorizontal, Wallet, Target, AlertTriangle, Sparkles, Trophy, BarChart3, PieChart as PieIcon } from 'lucide-react';

const COLORS = ['#f59e0b', '#0ea5e9', '#8b5cf6', '#10b981', '#14b8a6', '#ec4899', '#f43f5e', '#6366f1', '#22c55e', '#eab308', '#64748b', '#06b6d4'];
const emptyForm = { name: '', type: 'expense', color: '#0ea5e9', budget_limit: '', ir_deductible: '', icon: 'tag' };
const IR_OPTS = [['', 'Não dedutível'], ['saude', 'Saúde'], ['educacao', 'Educação'], ['previdencia', 'Previdência'], ['outras', 'Outras deduções']];
const IR_LABEL = Object.fromEntries(IR_OPTS);
const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export default function Categories() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data: categories = [], isLoading } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });
  const { data: transactions = [] } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const [tab, setTab] = useState('expense');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [toDelete, setToDelete] = useState(null);

  const save = useMutation({
    mutationFn: (p) => editing ? Category.update(editing.id, p) : Category.create(p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); setModal(false); },
  });
  const del = useMutation({ mutationFn: (id) => Category.remove(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); setToDelete(null); } });

  const openNew = () => { setEditing(null); setForm({ ...emptyForm, type: tab }); setModal(true); };
  const openEdit = (c) => { setEditing(c); setForm({ name: c.name, type: c.type, color: c.color, budget_limit: c.budget_limit ?? '', ir_deductible: c.ir_deductible || '', icon: categoryIconKey(c) }); setModal(true); };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = (e) => { e?.preventDefault?.(); if (!form.name.trim()) return; save.mutate({ ...form, budget_limit: form.budget_limit === '' ? null : Number(form.budget_limit), ir_deductible: form.type === 'expense' ? form.ir_deductible : '' }); };

  const now = new Date();
  const mk = monthKey(now);
  const prevMk = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const prevLabel = `${MES[Number(prevMk.slice(5)) - 1]}/${prevMk.slice(0, 4)}`;

  const { spent, prevSpent } = useMemo(() => {
    const cur = {}, prev = {};
    for (const t of transactions) {
      if (!t.category_id || t.type === 'transfer') continue;
      if (inMonth(t.date, mk)) cur[t.category_id] = (cur[t.category_id] || 0) + Number(t.amount);
      else if (inMonth(t.date, prevMk)) prev[t.category_id] = (prev[t.category_id] || 0) + Number(t.amount);
    }
    return { spent: cur, prevSpent: prev };
  }, [transactions, mk, prevMk]);

  const list = useMemo(() => categories.filter((c) => c.type === tab).map((c, i) => {
    const sp = spent[c.id] || 0; const pv = prevSpent[c.id] || 0; const lim = Number(c.budget_limit) || 0;
    return { ...c, color: c.color || colorAt(i), sp, pv, lim, delta: pv > 0 ? ((sp - pv) / pv) * 100 : null, usage: lim > 0 ? (sp / lim) * 100 : null };
  }).sort((a, b) => b.sp - a.sp || a.name.localeCompare(b.name)), [categories, tab, spent, prevSpent]);

  const total = list.reduce((s, c) => s + c.sp, 0);
  const prevTotal = list.reduce((s, c) => s + c.pv, 0);
  const totalDelta = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null;
  const withMove = list.filter((c) => c.sp > 0).length;
  const withLimit = list.filter((c) => c.lim > 0);
  const attention = withLimit.filter((c) => c.usage >= 80);
  const isExp = tab === 'expense';

  const dist = useMemo(() => {
    const top = list.filter((c) => c.sp > 0).slice(0, 5).map((c) => ({ name: c.name, value: c.sp, color: c.color }));
    const rest = list.filter((c) => c.sp > 0).slice(5).reduce((s, c) => s + c.sp, 0);
    if (rest > 0) top.push({ name: 'Outros', value: rest, color: '#3b82f6' });
    return top;
  }, [list]);
  const biggest = list.find((c) => c.sp > 0);

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageTitle icon={Tags} title="Categorias" subtitle="Organize suas receitas e despesas por categoria e acompanhe seus limites."
        actions={<><Button variant="outline" onClick={() => nav('/regras')}><SlidersHorizontal className="w-4 h-4" /> Gerenciar regras</Button><GlowButton onClick={openNew}><Plus className="w-4 h-4" /> Nova categoria</GlowButton></>} />

      <Segmented value={tab} onChange={setTab} options={[['expense', 'Despesas', TrendingDown], ['income', 'Receitas', TrendingUp]]} />

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-5 min-w-0">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard tone="teal" icon={Tags} label="Total de categorias" value={list.length} sub={`${withMove} com movimentação`} />
            <StatCard tone="violet" icon={Wallet} label="Total do mês" value={<AnimatedValue value={total} format={formatCurrency} />} sub={totalDelta != null ? <span className="flex items-center gap-1.5"><DeltaChip v={totalDelta} invert={isExp} /> vs. {prevLabel}</span> : `sem base em ${prevLabel}`} />
            <StatCard tone="emerald" icon={Target} label="Com limite definido" value={withLimit.length} sub={list.length ? `${Math.round((withLimit.length / list.length) * 100)}% das categorias` : '—'} />
            <StatCard tone="amber" icon={AlertTriangle} label="Em atenção" value={attention.length} sub="acima de 80% do limite" onClick={attention.length ? () => nav('/orcamento') : undefined} />
          </div>

          {isLoading ? <div className="flex justify-center py-10"><Spinner className="w-6 h-6 text-emerald-500" /></div>
            : list.length === 0 ? <Panel><EmptyState icon={Tags} title="Nenhuma categoria" subtitle={`Crie categorias de ${isExp ? 'despesa' : 'receita'}.`} action={<Button onClick={openNew}><Plus className="w-4 h-4" /> Nova categoria</Button>} /></Panel>
            : (
              <div className="grid gap-4 lg:grid-cols-2">
                {list.map((c, i) => {
                  const Icon = categoryIcon(c);
                  const barColor = c.usage >= 100 ? '#f43f5e' : c.usage >= 80 ? '#f59e0b' : c.color;
                  return (
                    <Reveal key={c.id} i={Math.min(i, 10)}>
                      <div className="h-full rounded-2xl bg-[hsl(var(--card))] p-4 ring-1 hover-lift" style={{ '--tw-ring-color': `${c.color}66`, backgroundImage: `linear-gradient(120deg, ${c.color}24, transparent 55%)`, boxShadow: `0 0 22px ${c.color}1f` }}>
                        <div className="flex items-start gap-3">
                          <span className="w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg" style={{ background: `linear-gradient(135deg, ${c.color}, ${c.color}aa)` }}><Icon className="w-6 h-6" /></span>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-base truncate flex items-center gap-1.5">{c.name}{c.ir_deductible && <Badge color="indigo">IR: {IR_LABEL[c.ir_deductible]}</Badge>}</p>
                            <p className="text-sm text-muted flex items-center gap-2 flex-wrap"><span><b className="text-[hsl(var(--text))]">{formatCurrency(c.sp)}</b> este mês</span>{c.delta != null && <DeltaChip v={c.delta} invert={isExp} />}</p>
                          </div>
                          <div className="flex gap-0.5 shrink-0">
                            <button onClick={() => openEdit(c)} aria-label={`Editar ${c.name}`} className="p-1.5 rounded-lg text-muted hover:text-[hsl(var(--text))] hover:bg-black/5 dark:hover:bg-white/10"><Pencil className="w-4 h-4" /></button>
                            <button onClick={() => setToDelete(c)} aria-label={`Excluir ${c.name}`} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </div>
                        {isExp && (c.lim > 0 ? (
                          <div className="mt-3">
                            <Bar pct={c.usage} color={barColor} glow />
                            <div className="flex justify-between gap-2 text-xs text-muted mt-1.5"><span className={c.usage >= 100 ? 'text-rose-500 font-semibold' : c.usage >= 80 ? 'text-amber-500 font-semibold' : ''}>{Math.round(c.usage)}% do limite</span><span>{formatCurrency(c.sp)} de {formatCurrency(c.lim)}</span></div>
                          </div>
                        ) : <p className="text-xs text-muted mt-3">Sem limite definido · <button onClick={() => openEdit(c)} className="text-sky-500 font-semibold hover:underline">definir</button></p>)}
                        {!isExp && c.pv > 0 && <p className="text-xs text-muted mt-3">Mês anterior: {formatCurrency(c.pv)}</p>}
                      </div>
                    </Reveal>
                  );
                })}
              </div>
            )}
        </div>

        <Panel tone="violet" glow title="Insights de Categorias" icon={Sparkles} iconClass="text-teal-300" className="h-fit">
          <div className="space-y-3">
            {biggest && <InsightRow tone="amber" icon={Trophy} kicker={isExp ? 'Maior gasto do mês' : 'Maior receita do mês'} title={biggest.name} text={`${formatCurrency(biggest.sp)} (${pct1(total ? (biggest.sp / total) * 100 : 0)} do total)`} onClick={() => nav('/lancamentos')} />}
            {isExp && (attention.length
              ? <InsightRow tone="rose" icon={AlertTriangle} title="Pressão no orçamento" text={`${attention.length} categoria${attention.length === 1 ? '' : 's'} acima de 80% do limite: ${attention.slice(0, 3).map((c) => c.name).join(', ')}.`} onClick={() => nav('/orcamento')} />
              : <InsightRow tone="emerald" icon={Target} title="Limites sob controle" text={withLimit.length ? 'Nenhuma categoria passou de 80% do limite.' : 'Defina limites para acompanhar a pressão no orçamento.'} onClick={() => nav('/orcamento')} />)}
            {totalDelta != null && (isExp
              ? <InsightRow tone={totalDelta <= 0 ? 'emerald' : 'amber'} icon={totalDelta <= 0 ? TrendingDown : TrendingUp} title={totalDelta <= 0 ? 'Ótima economia' : 'Despesas em alta'} text={`Você ${totalDelta <= 0 ? 'reduziu' : 'aumentou'} ${pct1(Math.abs(totalDelta))} em despesas — ${formatCurrency(total)} vs. ${formatCurrency(prevTotal)} no mês anterior.`} onClick={() => nav('/comparador')} />
              : <InsightRow tone={totalDelta >= 0 ? 'emerald' : 'amber'} icon={totalDelta >= 0 ? TrendingUp : TrendingDown} title={totalDelta >= 0 ? 'Receitas em alta' : 'Receitas em queda'} text={`${pct1(Math.abs(totalDelta))} ${totalDelta >= 0 ? 'acima' : 'abaixo'} do mês anterior (${formatCurrency(prevTotal)}).`} onClick={() => nav('/comparador')} />)}
          </div>

          <div className="border-t border-[hsl(var(--border))] my-4" />
          <h4 className="font-semibold text-lg flex items-center gap-2 mb-3"><PieIcon className="w-5 h-5 text-sky-400" /> Distribuição {isExp ? 'das despesas' : 'das receitas'}</h4>
          {dist.length === 0 ? <p className="text-sm text-muted py-6 text-center">Sem movimentação neste mês.</p> : (
            <div className="grid grid-cols-[170px_minmax(0,1fr)] gap-4 items-center">
              <Donut data={dist} size={170} center={<><span className="text-xs text-muted">Total</span><span className="font-display font-bold">{formatCurrency(total)}</span></>} />
              <div className="space-y-2">
                {dist.map((d) => <div key={d.name} className="flex items-center gap-2 text-sm"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} /><span className="flex-1 truncate">{d.name}</span><span className="text-muted">{pct1((d.value / total) * 100)}</span></div>)}
              </div>
            </div>
          )}
          <Button variant="outline" className="w-full mt-4" onClick={() => nav('/relatorios')}><BarChart3 className="w-4 h-4" /> Ver relatório detalhado</Button>
        </Panel>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar categoria' : 'Nova categoria'} maxWidth="max-w-xl"
        footer={<><Button variant="outline" onClick={() => setModal(false)}>Cancelar</Button><Button onClick={submit} disabled={save.isPending || !form.name.trim()}>{save.isPending ? <Spinner className="w-4 h-4" /> : 'Salvar'}</Button></>}>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Nome"><Input required value={form.name} onChange={set('name')} placeholder="Ex: Alimentação" /></Field>
            <Field label="Tipo"><Select value={form.type} onChange={set('type')}><option value="expense">Despesa</option><option value="income">Receita</option></Select></Field>
          </div>
          {form.type === 'expense' && (
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Limite mensal (opcional)"><Input type="number" step="0.01" value={form.budget_limit} onChange={set('budget_limit')} placeholder="0,00" /></Field>
              <Field label="Dedutível no Imposto de Renda"><Select value={form.ir_deductible} onChange={set('ir_deductible')}>{IR_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
            </div>
          )}
          <Field label="Ícone">
            <div className="grid grid-cols-8 sm:grid-cols-10 gap-1.5">
              {Object.entries(CATEGORY_ICONS).map(([k, Ic]) => (
                <button key={k} type="button" onClick={() => setForm((f) => ({ ...f, icon: k }))} aria-label={`Ícone ${k}`} aria-pressed={form.icon === k}
                  className={`h-9 rounded-lg flex items-center justify-center transition ${form.icon === k ? 'text-white shadow' : 'bg-black/5 dark:bg-white/5 text-muted hover:text-[hsl(var(--text))]'}`} style={form.icon === k ? { background: form.color } : undefined}><Ic className="w-4 h-4" /></button>
              ))}
            </div>
          </Field>
          <Field label="Cor">
            <div className="flex gap-2 flex-wrap">{COLORS.map((c) => <button key={c} type="button" onClick={() => setForm((f) => ({ ...f, color: c }))} aria-label={`Cor ${c}`} className={`w-8 h-8 rounded-full border-2 transition ${form.color === c ? 'border-slate-900 dark:border-white scale-110' : 'border-transparent'}`} style={{ background: c }} />)}</div>
          </Field>
        </form>
      </Modal>

      <Modal open={!!toDelete} onClose={() => setToDelete(null)} title="Excluir categoria" maxWidth="max-w-md"
        footer={<><Button variant="outline" onClick={() => setToDelete(null)}>Cancelar</Button><Button variant="danger" onClick={() => del.mutate(toDelete.id)} disabled={del.isPending}>{del.isPending ? <Spinner className="w-4 h-4" /> : 'Excluir'}</Button></>}>
        <p className="text-sm text-muted">Excluir <b className="text-[hsl(var(--text))]">{toDelete?.name}</b>? Os lançamentos dessa categoria ficam sem categoria (você pode recategorizá-los pelas Regras).</p>
      </Modal>
    </div>
  );
}
