import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Category, Transaction } from '../api/entities.js';
import { Button, Input, Modal, Field, Spinner, EmptyState } from '../components/ui';
import { AnimatedValue, Reveal } from '../components/Animated.jsx';
import { Panel, Donut, Ring, Bar, KebabMenu, InsightRow, GlowButton, DeltaChip, pct1 } from '../components/kit.jsx';
import { formatCurrency, monthKey, monthLabel, inMonth } from '../lib/utils.js';
import { categoryIcon } from '../lib/categoryIcons.js';
import { toast } from '../lib/toast.js';
import {
  PiggyBank, AlertTriangle, Pencil, CheckCircle2, TrendingUp, ChevronLeft, ChevronRight, SlidersHorizontal, Plus, Wallet, Coins, ShieldCheck,
  Home, Gamepad2, Layers, Sparkles, Info, Wand2, BarChart3, Gauge, X, ListFilter,
} from 'lucide-react';

const ESSENTIAL = ['aluguel', 'moradia', 'casa', 'agua', 'água', 'luz', 'energia', 'internet', 'mercado', 'aliment', 'saude', 'saúde', 'transporte', 'educa', 'conta', 'financ', 'condominio', 'condomínio', 'gas', 'gás', 'farmac', 'plano'];
const isEssential = (name) => ESSENTIAL.some((k) => String(name || '').toLowerCase().includes(k));
const round10 = (v) => Math.ceil(v / 10) * 10;

export default function Budget() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [mk, setMk] = useState(monthKey(new Date()));
  const isCurrent = mk === monthKey(new Date());
  const shiftMonth = (d) => { const [y, m] = mk.split('-').map(Number); setMk(monthKey(new Date(y, m - 1 + d, 1))); };
  const prevMk = useMemo(() => { const [y, m] = mk.split('-').map(Number); return monthKey(new Date(y, m - 2, 1)); }, [mk]);
  const { data: categories = [], isLoading } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });
  const { data: transactions = [] } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const [editing, setEditing] = useState(null);
  const [limit, setLimit] = useState('');
  const [bulk, setBulk] = useState(null); // { mode, values: {id: string} }
  const [showAll, setShowAll] = useState(false);

  const save = useMutation({
    mutationFn: ({ id, budget_limit }) => Category.update(id, { budget_limit }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); setEditing(null); },
  });
  const saveBulk = useMutation({
    mutationFn: async (values) => { let n = 0; for (const c of categories.filter((x) => x.type === 'expense')) { const raw = values[c.id]; const next = raw === '' || raw == null ? null : Number(raw); const cur = c.budget_limit == null || c.budget_limit === '' ? null : Number(c.budget_limit); if (next !== cur) { await Category.update(c.id, { budget_limit: next }); n++; } } return n; },
    onSuccess: (n) => { qc.invalidateQueries({ queryKey: ['categories'] }); setBulk(null); toast.success(n ? `${n} limite(s) atualizado(s).` : 'Nenhuma alteração.'); },
  });

  const spentIn = (month) => { const map = {}; for (const t of transactions) if (t.type === 'expense' && inMonth(t.date, month) && t.category_id) map[t.category_id] = (map[t.category_id] || 0) + Number(t.amount); return map; };
  const spentByCat = useMemo(() => spentIn(mk), [transactions, mk]); // eslint-disable-line react-hooks/exhaustive-deps
  const prevByCat = useMemo(() => spentIn(prevMk), [transactions, prevMk]); // eslint-disable-line react-hooks/exhaustive-deps

  const expenseCats = categories.filter((c) => c.type === 'expense');
  const withBudget = expenseCats.filter((c) => Number(c.budget_limit) > 0);
  const totalBudget = withBudget.reduce((s, c) => s + Number(c.budget_limit), 0);
  const totalSpent = withBudget.reduce((s, c) => s + (spentByCat[c.id] || 0), 0);

  const now = new Date();
  const dim = (() => { const [y, m] = mk.split('-').map(Number); return new Date(y, m, 0).getDate(); })();
  const dayPct = isCurrent ? (now.getDate() / dim) * 100 : 100;
  const usedPct = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  const projected = isCurrent && dayPct > 0 ? totalSpent / (dayPct / 100) : totalSpent;
  const risk = !totalBudget ? null : projected <= totalBudget * 0.9 ? { l: 'Baixo', c: 'text-emerald-400', tone: 'emerald' } : projected <= totalBudget * 1.05 ? { l: 'Médio', c: 'text-amber-400', tone: 'amber' } : { l: 'Alto', c: 'text-rose-400', tone: 'rose' };

  // linhas por categoria
  const rows = useMemo(() => expenseCats.map((c) => {
    const lim = Number(c.budget_limit) || 0; const sp = spentByCat[c.id] || 0;
    return { ...c, lim, sp, pct: lim ? (sp / lim) * 100 : null };
  }).sort((a, b) => (b.lim > 0) - (a.lim > 0) || (b.pct ?? -1) - (a.pct ?? -1) || b.sp - a.sp), [expenseCats, spentByCat]);
  const budgetRows = rows.filter((r) => r.lim > 0);
  const visibleRows = showAll ? rows : budgetRows;

  // método 50/30/20 sobre a renda do mês
  const method = useMemo(() => {
    const calc = (month, spent) => {
      let income = 0; for (const t of transactions) if (t.type === 'income' && inMonth(t.date, month)) income += Number(t.amount);
      let needs = 0, wants = 0; for (const c of expenseCats) { const v = spent[c.id] || 0; if (isEssential(c.name)) needs += v; else wants += v; }
      return { income, needs, wants, savings: Math.max(0, income - needs - wants) };
    };
    const cur = calc(mk, spentByCat); const prev = calc(prevMk, prevByCat);
    const d = (a, b) => (b > 0 ? ((a - b) / b) * 100 : null);
    return {
      ...cur,
      groups: [
        { key: 'needs', label: 'Necessidades', share: 50, sub: 'Gastos essenciais do dia a dia', icon: Home, tone: 'teal', color: '#22d3ee', value: cur.needs, delta: d(cur.needs, prev.needs), invert: true },
        { key: 'wants', label: 'Desejos', share: 30, sub: 'Variáveis e lazer', icon: Gamepad2, tone: 'violet', color: '#a855f7', value: cur.wants, delta: d(cur.wants, prev.wants), invert: true },
        { key: 'save', label: 'Poupança/Investir', share: 20, sub: 'Economia e objetivos', icon: Coins, tone: 'emerald', color: '#34d399', value: cur.savings, delta: d(cur.savings, prev.savings), invert: false },
      ],
    };
  }, [transactions, mk, prevMk, spentByCat, prevByCat, expenseCats]);

  // distribuição do orçamento (limites) por grupo
  const dist = useMemo(() => {
    const needs = withBudget.filter((c) => isEssential(c.name)).reduce((s, c) => s + Number(c.budget_limit), 0);
    const wants = totalBudget - needs;
    const save = Math.max(0, method.income - totalBudget);
    return [{ name: 'Necessidades', value: needs, color: '#22d3ee' }, { name: 'Desejos', value: wants, color: '#a855f7' }, { name: 'Poupança/Investir', value: save, color: '#34d399' }];
  }, [withBudget, totalBudget, method.income]);
  const distTotal = dist.reduce((s, d) => s + d.value, 0);

  // insights
  const atRisk = budgetRows.filter((r) => r.pct >= 90).sort((a, b) => b.pct - a.pct);
  const okRows = budgetRows.filter((r) => r.pct < 80);
  const best = [...budgetRows].filter((r) => r.pct < 100).sort((a, b) => (a.pct) - (b.pct))[0];

  // sugestão: média dos últimos 3 meses (arredondada) ou proporção 50/30 da renda
  const suggestion = useMemo(() => {
    const months = [1, 2, 3].map((i) => { const [y, m] = mk.split('-').map(Number); return monthKey(new Date(y, m - 1 - i, 1)); });
    const out = {};
    for (const c of expenseCats) { const vals = months.map((m) => transactions.filter((t) => t.type === 'expense' && t.category_id === c.id && inMonth(t.date, m)).reduce((s, t) => s + Number(t.amount), 0)); const avg = vals.reduce((a, b) => a + b, 0) / 3; out[c.id] = avg > 0 ? round10(avg) : ''; }
    return out;
  }, [transactions, expenseCats, mk]);
  const openBulk = (mode) => setBulk({ mode, values: Object.fromEntries(expenseCats.map((c) => [c.id, mode === 'create' && !(Number(c.budget_limit) > 0) ? String(suggestion[c.id] ?? '') : (c.budget_limit ?? '') === null ? '' : String(c.budget_limit ?? '')])) });
  const bulkTotal = bulk ? Object.values(bulk.values).reduce((s, v) => s + (Number(v) || 0), 0) : 0;

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold leading-tight">Orçamento</h1>
          <p className="text-sm text-muted mt-1">Limites de gasto por categoria e planejamento mensal completo.</p>
          <div className="h-1 w-14 rounded-full mt-2.5 bg-gradient-to-r from-teal-400 to-sky-500" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl ring-1 ring-[hsl(var(--border))] bg-[hsl(var(--card))] px-1 py-1">
            <button onClick={() => shiftMonth(-1)} aria-label="Mês anterior" className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-sm font-semibold px-3 capitalize min-w-[130px] text-center">{monthLabel(mk)}</span>
            <button onClick={() => shiftMonth(1)} aria-label="Próximo mês" className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <Button variant="outline" onClick={() => openBulk('adjust')}><SlidersHorizontal className="w-4 h-4" /> Ajustar limites</Button>
          <GlowButton onClick={() => openBulk('create')}><Plus className="w-4 h-4" /> Criar orçamento</GlowButton>
        </div>
      </div>

      {isLoading ? <div className="flex justify-center py-10"><Spinner className="w-6 h-6 text-emerald-500" /></div> : (
      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-5 min-w-0">
          {/* Hero */}
          <div className="relative overflow-hidden rounded-3xl ring-1 ring-teal-400/35 shadow-[0_0_30px_rgba(45,212,191,.12)] bg-[hsl(var(--card))] p-5" style={{ backgroundImage: 'radial-gradient(120% 120% at 0% 0%, rgba(45,212,191,.14), transparent 55%), radial-gradient(90% 90% at 100% 100%, rgba(139,92,246,.12), transparent 60%)' }}>
            <div className="grid gap-6 md:grid-cols-[auto_minmax(0,1fr)] items-center">
              <Ring value={usedPct} size={180} stroke={16}>
                <span className="font-display text-4xl font-extrabold">{Math.round(usedPct)}%</span>
                <span className="text-xs text-muted leading-tight">do orçamento<br />utilizado</span>
              </Ring>
              <div className="min-w-0 md:pl-6 md:border-l border-[hsl(var(--border))]">
                <p className="text-xs text-muted">Visão geral do mês</p>
                <p className="mt-1 flex items-baseline gap-2 flex-wrap"><span className="font-display text-3xl sm:text-4xl font-extrabold"><AnimatedValue value={totalSpent} format={formatCurrency} /></span><span className="text-muted">de {formatCurrency(totalBudget)}</span></p>
                <div className="mt-3"><Bar pct={usedPct} className="h-3" color={usedPct >= 100 ? '#f43f5e' : 'linear-gradient(90deg,#22d3ee,#38bdf8)'} /></div>
                {isCurrent && totalBudget > 0 && <p className="text-[11px] text-muted mt-1">Mês {Math.round(dayPct)}% decorrido · orçamento {Math.round(usedPct)}% usado</p>}
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mt-4">
                  <Tile tone="sky" icon={Wallet} label="Orçamento total" value={formatCurrency(totalBudget)} />
                  <Tile tone="violet" icon={Coins} label="Restante" value={formatCurrency(Math.max(0, totalBudget - totalSpent))} />
                  <Tile tone="emerald" icon={TrendingUp} label="Projeção no fim do mês" value={formatCurrency(projected)} valueClass={projected > totalBudget && totalBudget ? 'text-rose-400' : 'text-emerald-400'} />
                  <Tile tone={risk?.tone || 'teal'} icon={ShieldCheck} label="Nível de risco" value={risk?.l || '—'} valueClass={risk?.c} />
                </div>
              </div>
            </div>
          </div>

          {/* 50/30/20 */}
          <div>
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <h3 className="font-semibold text-lg flex items-center gap-2"><Layers className="w-5 h-5 text-violet-400" /> Método 50/30/20 <span title="Até 50% da renda em necessidades, até 30% em desejos e ao menos 20% para poupar/investir."><Info className="w-4 h-4 text-muted" /></span></h3>
              <button onClick={() => openBulk('create')} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium text-sky-600 dark:text-sky-300 ring-1 ring-sky-400/40 bg-sky-500/10 hover:bg-sky-500/15"><Wand2 className="w-4 h-4" /> Planejamento inteligente do seu orçamento</button>
            </div>
            {method.income === 0 ? <Panel><p className="text-sm text-muted">Registre receitas em {monthLabel(mk)} para ver a divisão 50/30/20 do seu dinheiro.</p></Panel> : (
              <div className="grid gap-4 lg:grid-cols-3">
                {method.groups.map((g) => {
                  const target = method.income * (g.share / 100); const got = method.income ? (g.value / method.income) * 100 : 0;
                  const ok = g.key === 'save' ? got >= g.share : got <= g.share;
                  return (
                    <div key={g.key} className={`rounded-2xl ring-1 p-4 ${g.tone === 'teal' ? 'ring-cyan-400/40' : g.tone === 'violet' ? 'ring-violet-400/50' : 'ring-emerald-400/40'}`} style={{ backgroundImage: `linear-gradient(135deg, ${g.color}26, transparent 70%)` }}>
                      <div className="flex items-start gap-3">
                        <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${g.color}33`, color: g.color }}><g.icon className="w-6 h-6" /></span>
                        <div className="min-w-0 flex-1"><p className="font-semibold truncate">{g.label}</p><p className="text-[11px] text-muted">{g.sub}</p></div>
                        <p className="text-sm whitespace-nowrap"><b className={`text-base ${ok ? 'text-emerald-400' : 'text-amber-400'}`} style={ok ? undefined : undefined}>{Math.round(got)}%</b> <span className="text-muted">/ {g.share}%</span></p>
                      </div>
                      <div className="mt-3"><Bar pct={target ? (g.value / target) * 100 : 0} color={!ok && g.key !== 'save' ? (got > g.share * 1.25 ? '#f43f5e' : '#f59e0b') : g.color} glow /></div>
                      <div className="flex items-center justify-between gap-2 mt-2 text-sm"><span><b>{formatCurrency(g.value)}</b> <span className="text-muted">de {formatCurrency(target)}</span></span>{g.delta != null && <DeltaChip v={g.delta} invert={g.invert} />}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Por categoria */}
          <Panel tone="sky" icon={Layers} title="Orçamento por categoria" iconClass="text-sky-400"
            action={<div className="flex items-center gap-3 flex-wrap justify-end"><span className="text-sm text-muted">{budgetRows.length} categoria{budgetRows.length === 1 ? '' : 's'} ativa{budgetRows.length === 1 ? '' : 's'} • Total: <b className="text-[hsl(var(--text))]">{formatCurrency(totalBudget)}</b></span><Button size="sm" variant="outline" onClick={() => setShowAll((v) => !v)}><ListFilter className="w-4 h-4" /> {showAll ? 'Só com limite' : 'Ver todas'}</Button></div>}>
            {visibleRows.length === 0 ? <EmptyState icon={PiggyBank} title="Nenhum limite definido" subtitle="Use “Criar orçamento” para sugerir limites a partir da média dos últimos 3 meses." action={<Button onClick={() => openBulk('create')}><Wand2 className="w-4 h-4" /> Criar orçamento</Button>} /> : (
              <div className="space-y-2">
                {visibleRows.map((r, i) => {
                  const Icon = categoryIcon(r); const over = r.pct >= 100; const warn = r.pct >= 80 && !over;
                  const tone = over ? '#f43f5e' : warn ? '#f59e0b' : r.color || '#22d3ee';
                  return (
                    <Reveal key={r.id} i={Math.min(i, 8)}>
                      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] sm:grid-cols-[auto_minmax(0,170px)_minmax(0,1fr)_auto_auto_auto] items-center gap-3 rounded-xl px-3 py-2.5 ring-1" style={{ '--tw-ring-color': `${tone}55`, backgroundImage: `linear-gradient(90deg, ${tone}1f, transparent 60%)` }}>
                        <span className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ background: `linear-gradient(135deg, ${r.color || '#22d3ee'}, ${r.color || '#22d3ee'}aa)` }}><Icon className="w-5 h-5" /></span>
                        <div className="min-w-0"><p className="font-semibold truncate">{r.name}</p><p className="text-xs text-muted">{r.lim ? `Limite: ${formatCurrency(r.lim)}` : 'Sem limite'}</p></div>
                        <div className="hidden sm:block">{r.lim ? <Bar pct={r.pct} color={over ? 'linear-gradient(90deg,#fb7185,#f43f5e)' : warn ? 'linear-gradient(90deg,#fbbf24,#f59e0b)' : `linear-gradient(90deg, ${r.color || '#22d3ee'}, ${r.color || '#22d3ee'}cc)`} className="h-2.5" /> : <button onClick={() => { setEditing(r); setLimit(''); }} className="text-xs font-semibold text-sky-500 hover:underline">+ Definir limite</button>}</div>
                        <span className="hidden sm:block text-sm whitespace-nowrap"><b>{formatCurrency(r.sp)}</b>{r.lim ? <span className="text-muted"> / {formatCurrency(r.lim)}</span> : null}</span>
                        {r.lim ? <span className={`hidden sm:inline-flex justify-center min-w-[64px] px-2.5 py-1 rounded-lg text-sm font-bold ring-1 ${over ? 'bg-rose-500/15 text-rose-500 ring-rose-400/50' : warn ? 'bg-amber-500/15 text-amber-500 ring-amber-400/50' : 'bg-emerald-500/15 text-emerald-500 ring-emerald-400/50'}`}>{Math.round(r.pct)}%</span> : <span className="hidden sm:block" />}
                        <KebabMenu items={[
                          { icon: Pencil, label: r.lim ? 'Editar limite' : 'Definir limite', onClick: () => { setEditing(r); setLimit(r.lim || ''); } },
                          r.lim && { icon: X, label: 'Remover limite', danger: true, onClick: () => save.mutate({ id: r.id, budget_limit: null }) },
                          { icon: BarChart3, label: 'Ver lançamentos', onClick: () => nav('/lancamentos') },
                        ]} />
                      </div>
                    </Reveal>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>

        {/* Lateral */}
        <Panel tone="violet" glow title="Insights do Orçamento" icon={Sparkles} iconClass="text-teal-300" className="h-fit">
          <div className="space-y-3">
            {atRisk.length > 0
              ? <InsightRow tone="amber" icon={AlertTriangle} title="Em risco" text={atRisk[0].pct >= 100 ? `${atRisk[0].name} está ${Math.round(atRisk[0].pct - 100)}% acima do limite (${formatCurrency(atRisk[0].sp - atRisk[0].lim)}).` : `${atRisk[0].name} já usou ${Math.round(atRisk[0].pct)}% do limite.`} onClick={() => { setEditing(atRisk[0]); setLimit(atRisk[0].lim); }} />
              : <InsightRow tone="emerald" icon={Gauge} title="Ritmo do mês" text={totalBudget ? `${Math.round(usedPct)}% do orçamento usado com o mês em ${Math.round(dayPct)}%.` : 'Defina limites para acompanhar o ritmo.'} />}
            {okRows.length > 0 && <InsightRow tone="emerald" icon={CheckCircle2} title="Dentro do orçamento" text={`${okRows.slice(0, 3).map((r) => r.name).join(', ')}${okRows.length > 3 ? ` e mais ${okRows.length - 3}` : ''} ${okRows.length === 1 ? 'está' : 'estão'} no controle.`} />}
            {best && <InsightRow tone="violet" icon={TrendingUp} title="Melhor economia do mês" text={`${best.name} com ${Math.round(100 - best.pct)}% abaixo do limite (sobram ${formatCurrency(best.lim - best.sp)}).`} />}
            {method.income > 0 && method.groups[2].value / method.income * 100 < 20 && <InsightRow tone="rose" icon={PiggyBank} title="Poupança abaixo da meta" text={`Sobraram ${pct1(method.groups[2].value / method.income * 100)} da renda; a meta do método é 20%.`} />}
          </div>
          <div className="border-t border-[hsl(var(--border))] my-4" />
          <h4 className="font-semibold text-lg flex items-center gap-2 mb-3"><Gauge className="w-5 h-5 text-sky-400" /> Distribuição do orçamento</h4>
          {distTotal <= 0 ? <p className="text-sm text-muted py-4 text-center">Defina limites para ver a distribuição.</p> : (
            <div className="grid grid-cols-[170px_minmax(0,1fr)] gap-4 items-center">
              <Donut data={dist} size={170} center={<><span className="text-xs text-muted">Total</span><span className="font-display font-bold">{formatCurrency(distTotal)}</span></>} />
              <div className="space-y-2.5">{dist.map((d) => <div key={d.name} className="flex items-center gap-2 text-sm"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} /><span className="flex-1 truncate">{d.name}</span><span className="text-muted">{pct1((d.value / distTotal) * 100)}</span></div>)}</div>
            </div>
          )}
          {distTotal > 0 && <p className="text-[11px] text-muted mt-2">Necessidades e desejos somam os limites; poupança é o que sobra da renda ({formatCurrency(method.income)}) depois dos limites.</p>}
          <Button variant="outline" className="w-full mt-4" onClick={() => nav('/relatorios')}><BarChart3 className="w-4 h-4" /> Ver relatório detalhado</Button>
        </Panel>
      </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Limite: ${editing?.name || ''}`} maxWidth="max-w-md"
        footer={<><Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button><Button onClick={() => save.mutate({ id: editing.id, budget_limit: limit === '' ? null : Number(limit) })} disabled={save.isPending}>{save.isPending ? <Spinner className="w-4 h-4" /> : 'Salvar'}</Button></>}>
        <Field label="Limite mensal (deixe vazio para remover)" hint={editing && suggestion[editing.id] ? `Média dos últimos 3 meses: ${formatCurrency(suggestion[editing.id])}` : undefined}><Input type="number" step="0.01" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="0,00" autoFocus /></Field>
      </Modal>

      <Modal open={!!bulk} onClose={() => setBulk(null)} title={bulk?.mode === 'create' ? 'Criar orçamento do mês' : 'Ajustar limites'} maxWidth="max-w-2xl"
        footer={<><span className="text-sm text-muted mr-auto">Total: <b className="text-[hsl(var(--text))]">{formatCurrency(bulkTotal)}</b>{method.income > 0 && <> · {pct1((bulkTotal / method.income) * 100)} da renda</>}</span><Button variant="outline" onClick={() => setBulk(null)}>Cancelar</Button><Button onClick={() => saveBulk.mutate(bulk.values)} disabled={saveBulk.isPending}>{saveBulk.isPending ? <Spinner className="w-4 h-4" /> : 'Salvar limites'}</Button></>}>
        {bulk && (
          <div className="space-y-3">
            {bulk.mode === 'create' && <p className="text-sm text-muted">Sugerimos limites pela <b>média dos últimos 3 meses</b> de cada categoria (arredondada). Ajuste à vontade antes de salvar.{method.income > 0 && <> Pelo 50/30/20, necessidades até {formatCurrency(method.income * 0.5)} e desejos até {formatCurrency(method.income * 0.3)}.</>}</p>}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setBulk((b) => ({ ...b, values: Object.fromEntries(expenseCats.map((c) => [c.id, String(suggestion[c.id] ?? '')])) }))}><Wand2 className="w-4 h-4" /> Usar médias em tudo</Button>
              <Button size="sm" variant="ghost" onClick={() => setBulk((b) => ({ ...b, values: Object.fromEntries(expenseCats.map((c) => [c.id, ''])) }))}>Limpar</Button>
            </div>
            <div className="max-h-[52vh] overflow-y-auto divide-y divide-[hsl(var(--border))] rounded-xl ring-1 ring-[hsl(var(--border))]">
              {expenseCats.map((c) => { const Icon = categoryIcon(c); return (
                <div key={c.id} className="flex items-center gap-3 px-3 py-2">
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0" style={{ background: c.color }}><Icon className="w-4 h-4" /></span>
                  <div className="min-w-0 flex-1"><p className="text-sm font-medium truncate">{c.name}</p><p className="text-[11px] text-muted">{isEssential(c.name) ? 'Necessidade' : 'Desejo'} · média 3m {suggestion[c.id] ? formatCurrency(suggestion[c.id]) : '—'} · este mês {formatCurrency(spentByCat[c.id] || 0)}</p></div>
                  <Input type="number" step="0.01" className="!w-32" value={bulk.values[c.id] ?? ''} onChange={(e) => setBulk((b) => ({ ...b, values: { ...b.values, [c.id]: e.target.value } }))} placeholder="sem limite" />
                </div>
              ); })}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Tile({ tone, icon: Icon, label, value, valueClass = '' }) {
  const ring = { sky: 'ring-sky-400/35', violet: 'ring-violet-400/40', emerald: 'ring-emerald-400/35', amber: 'ring-amber-400/40', rose: 'ring-rose-400/40', teal: 'ring-teal-400/35' }[tone];
  const col = { sky: 'text-sky-400', violet: 'text-violet-300', emerald: 'text-emerald-400', amber: 'text-amber-400', rose: 'text-rose-400', teal: 'text-teal-300' }[tone];
  return (
    <div className={`rounded-2xl ring-1 ${ring} bg-black/[0.02] dark:bg-white/[0.03] p-3`}>
      <Icon className={`w-5 h-5 ${col}`} />
      <p className="text-xs text-muted mt-2">{label}</p>
      <p className={`font-display text-lg font-bold whitespace-nowrap ${valueClass}`}>{value}</p>
    </div>
  );
}
