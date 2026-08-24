import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Category, Transaction } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { Button, Card, Input, Modal, Field, Spinner, EmptyState, Badge } from '../components/ui';
import { Reveal, AnimatedValue } from '../components/Animated.jsx';
import { formatCurrency, monthKey, monthLabel, monthRange, inMonth } from '../lib/utils.js';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { PiggyBank, AlertTriangle, Pencil, Lightbulb, CheckCircle2, TrendingDown, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Budget() {
  const qc = useQueryClient();
  const [mk, setMk] = useState(monthKey(new Date()));
  const months = monthRange(11, 4);
  const isCurrent = mk === monthKey(new Date());
  const shiftMonth = (d) => { const [y, m] = mk.split('-').map(Number); setMk(monthKey(new Date(y, m - 1 + d, 1))); };
  const { data: categories = [], isLoading } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });
  const { data: transactions = [] } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const [editing, setEditing] = useState(null);
  const [limit, setLimit] = useState('');

  const save = useMutation({
    mutationFn: ({ id, budget_limit }) => Category.update(id, { budget_limit }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); setEditing(null); },
  });

  const spentByCat = useMemo(() => {
    const map = {};
    for (const t of transactions) if (t.type === 'expense' && inMonth(t.date, mk) && t.category_id) map[t.category_id] = (map[t.category_id] || 0) + Number(t.amount);
    return map;
  }, [transactions, mk]);

  const expenseCats = categories.filter((c) => c.type === 'expense');
  const withBudget = expenseCats.filter((c) => c.budget_limit);
  const totalBudget = withBudget.reduce((s, c) => s + Number(c.budget_limit), 0);
  const totalSpent = withBudget.reduce((s, c) => s + (spentByCat[c.id] || 0), 0);
  const over = withBudget.filter((c) => (spentByCat[c.id] || 0) >= Number(c.budget_limit)).length;
  const attention = withBudget.filter((c) => { const p = (spentByCat[c.id] || 0) / Number(c.budget_limit); return p >= 0.8 && p < 1; }).length;

  const donut = expenseCats.map((c) => ({ name: c.name, value: spentByCat[c.id] || 0, color: c.color })).filter((d) => d.value > 0).sort((a, b) => b.value - a.value);

  // dica inteligente: % gasto vs % do mês decorrido
  const now = new Date();
  const dayPct = isCurrent ? Math.round((now.getDate() / new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()) * 100) : 100;
  const spentPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
  const projected = isCurrent && dayPct > 0 ? Math.round(totalSpent / (dayPct / 100)) : totalSpent;
  const tip = totalBudget === 0 ? { t: 'info', m: 'Defina limites nas suas categorias de despesa para acompanhar o orçamento.' }
    : spentPct > dayPct + 10 ? { t: 'warn', m: `Você já usou ${spentPct}% do orçamento, mas o mes esta em ${dayPct}%. Ritmo acima do ideal — segure os gastos.` }
    : spentPct < dayPct - 10 ? { t: 'ok', m: `Ótimo ritmo! ${spentPct}% do orçamento usado com o mes em ${dayPct}%. Você esta economizando.` }
    : { t: 'ok', m: `No ritmo: ${spentPct}% do orçamento usado, mes em ${dayPct}%.` };

  // Metodo 50/30/20 (necessidades / desejos / poupança) sobre a renda do mês
  const ESSENTIAL = ['aluguel', 'moradia', 'casa', 'agua', 'água', 'luz', 'energia', 'internet', 'mercado', 'aliment', 'saude', 'saúde', 'transporte', 'educa', 'conta', 'financ', 'condominio', 'condomínio', 'gas', 'gás', 'farmac', 'plano'];
  const catName = (id) => (categories.find((c) => c.id === id)?.name || '').toLowerCase();
  const method = useMemo(() => {
    let income = 0, needs = 0, wants = 0;
    for (const t of transactions) {
      if (!inMonth(t.date, mk)) continue;
      if (t.type === 'income') income += Number(t.amount);
      else if (t.type === 'expense') { const isEss = ESSENTIAL.some((k) => catName(t.category_id).includes(k)); if (isEss) needs += Number(t.amount); else wants += Number(t.amount); }
    }
    const savings = Math.max(0, income - needs - wants);
    const pct = (v) => income > 0 ? Math.round((v / income) * 100) : 0;
    return { income, needs, wants, savings, needsPct: pct(needs), wantsPct: pct(wants), savingsPct: pct(savings) };
  }, [transactions, mk, categories]);

  return (
    <div className="animate-fadeIn">
      <PageHeader title="Orçamento" subtitle="Limites de gasto por categoria"
        actions={
          <div className="flex items-center gap-1 card px-1 py-1">
            <button onClick={() => shiftMonth(-1)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><ChevronLeft className="w-4 h-4" /></button>
            <select value={mk} onChange={(e) => setMk(e.target.value)} className="bg-transparent text-sm font-semibold outline-none cursor-pointer px-1 capitalize">{months.map((k) => <option key={k} value={k}>{monthLabel(k)}</option>)}</select>
            <button onClick={() => shiftMonth(1)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><ChevronRight className="w-4 h-4" /></button>
          </div>
        } />

      {/* Metodo 50/30/20 */}
      <Card className="mb-4 hover-lift">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="font-semibold flex items-center gap-2"><PiggyBank className="w-4 h-4 text-emerald-500" /> Metodo 50/30/20</h3>
          <span className="text-xs text-muted">sobre a renda de {monthLabel(mk)}: {formatCurrency(method.income)}</span>
        </div>
        {method.income === 0 ? <p className="text-sm text-muted">Registre receitas no mês para ver a divisao ideal do seu dinheiro.</p>
          : (
            <div className="grid sm:grid-cols-3 gap-3">
              {[
                { label: 'Necessidades', sub: 'essenciais', got: method.needsPct, gotV: method.needs, target: 50, color: '#0ea5e9' },
                { label: 'Desejos', sub: 'variaveis/lazer', got: method.wantsPct, gotV: method.wants, target: 30, color: '#8b5cf6' },
                { label: 'Poupança/Investir', sub: 'o que sobra', got: method.savingsPct, gotV: method.savings, target: 20, color: '#10b981' },
              ].map((x) => {
                const ok = x.label === 'Poupança/Investir' ? x.got >= x.target : x.got <= x.target;
                return (
                  <div key={x.label} className="rounded-xl border border-[hsl(var(--border))] p-3">
                    <div className="flex items-center justify-between"><p className="font-medium text-sm">{x.label}</p><span className={`text-xs font-bold ${ok ? 'text-emerald-500' : 'text-amber-500'}`}>{x.got}% <span className="text-muted font-normal">/ {x.target}%</span></span></div>
                    <p className="text-[11px] text-muted">{x.sub} · {formatCurrency(x.gotV)}</p>
                    <div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden mt-2 relative">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, x.got)}%`, background: x.color }} />
                      <span className="absolute top-0 bottom-0" style={{ left: `${x.target}%`, borderLeft: '2px dashed rgba(120,130,150,.6)' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        <p className="text-xs text-muted mt-3">Guia: até <b>50%</b> em necessidades, até <b>30%</b> em desejos e ao menos <b>20%</b> para poupar/investir. A linha tracejada marca a meta.</p>
      </Card>

      {/* Hero: medidor geral do orçamento */}
      <div className="relative overflow-hidden rounded-3xl p-6 text-white shadow-soft ring-1 ring-white/10 mb-5" style={{ background: 'linear-gradient(135deg,#080d1f,#0d1433 55%,#111b3f)' }}>
        <div className="absolute -top-16 -right-12 w-64 h-64 rounded-full glow-pulse pointer-events-none" style={{ background: `radial-gradient(circle, ${spentPct >= 100 ? 'rgba(244,63,94,.3)' : spentPct >= 80 ? 'rgba(245,158,11,.3)' : 'rgba(16,185,129,.28)'}, transparent 68%)` }} />
        <div className="absolute inset-0 grid-bg opacity-25" />
        <div className="relative flex flex-col sm:flex-row items-center gap-6">
          <BudgetRing pct={spentPct} />
          <div className="flex-1 w-full">
            <p className="text-[11px] tracking-[0.25em] text-slate-400">ORCAMENTO DO MES</p>
            <p className="font-display text-3xl font-extrabold mt-1"><AnimatedValue value={totalSpent} format={formatCurrency} /> <span className="text-lg text-slate-400 font-semibold">/ {formatCurrency(totalBudget)}</span></p>
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="rounded-xl bg-white/5 border border-white/10 p-2.5"><p className="text-[11px] text-slate-400">Restante</p><p className="font-bold">{formatCurrency(Math.max(0, totalBudget - totalSpent))}</p></div>
              <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-2.5"><p className="text-[11px] text-rose-300">Estourados</p><p className="font-bold">{over}</p></div>
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-2.5"><p className="text-[11px] text-amber-300">Em atencao</p><p className="font-bold">{attention}</p></div>
            </div>
            {totalBudget > 0 && isCurrent && (
              <p className="text-xs text-slate-400 mt-3">Projeção para o fim do mês: <b className={projected > totalBudget ? 'text-rose-300' : 'text-emerald-300'}>{formatCurrency(projected)}</b> {projected > totalBudget ? `(${formatCurrency(projected - totalBudget)} acima)` : '(dentro do orçamento)'}</p>
            )}
          </div>
        </div>
      </div>

      <div className={`flex items-start gap-2 p-3.5 rounded-xl text-sm mb-5 ${tip.t === 'warn' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300' : tip.t === 'ok' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'}`}>
        {tip.t === 'warn' ? <AlertTriangle className="w-4 h-4 mt-0.5" /> : tip.t === 'ok' ? <CheckCircle2 className="w-4 h-4 mt-0.5" /> : <Lightbulb className="w-4 h-4 mt-0.5" />}
        <span>{tip.m}</span>
      </div>

      {isLoading ? <div className="flex justify-center py-10"><Spinner className="w-6 h-6 text-emerald-500" /></div>
        : expenseCats.length === 0 ? <Card><EmptyState icon={PiggyBank} title="Sem categorias de despesa" subtitle="Crie categorias de despesa e defina limites aqui." /></Card>
        : (
          <div className="grid lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 space-y-3">
              {expenseCats.map((c, i) => {
                const sp = spentByCat[c.id] || 0;
                const budget = Number(c.budget_limit || 0);
                const pct = budget ? Math.round((sp / budget) * 100) : 0;
                const color = pct >= 100 ? '#f43f5e' : pct >= 80 ? '#f59e0b' : '#10b981';
                return (
                  <Reveal key={c.id} i={Math.min(i, 6)}>
                    <Card className="py-4 hover-lift">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${c.color}22` }}><span className="w-3 h-3 rounded-full" style={{ background: c.color }} /></span>
                          <span className="font-semibold">{c.name}</span>
                          {pct >= 100 && <Badge color="rose"><AlertTriangle className="w-3 h-3" /> Excedido</Badge>}
                          {pct >= 80 && pct < 100 && <Badge color="amber">Atenção</Badge>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted">{budget ? `${formatCurrency(sp)} / ${formatCurrency(budget)}` : formatCurrency(sp)}</span>
                          <button onClick={() => { setEditing(c); setLimit(c.budget_limit ?? ''); }} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><Pencil className="w-4 h-4" /></button>
                        </div>
                      </div>
                      {budget > 0 ? (<>
                        <div className="h-2.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%`, background: color }} /></div>
                        <p className="text-xs text-muted mt-1">{pct}% usado · resta {formatCurrency(Math.max(0, budget - sp))}</p>
                      </>) : <button onClick={() => { setEditing(c); setLimit(''); }} className="text-xs text-emerald-600 font-semibold">+ Definir limite</button>}
                    </Card>
                  </Reveal>
                );
              })}
            </div>

            <Card className="hover-lift h-fit">
              <h3 className="font-semibold mb-1">Distribuicao dos gastos</h3>
              <p className="text-xs text-muted mb-2 capitalize">{monthLabel(mk)}</p>
              {donut.length === 0 ? <div className="flex items-center justify-center h-[220px] text-muted text-sm">Sem gastos no mês</div>
                : (<>
                  <div className="relative">
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart><Pie data={donut} dataKey="value" nameKey="name" innerRadius={58} outerRadius={82} paddingAngle={3} stroke="none">{donut.map((e, i) => <Cell key={i} fill={e.color} />)}</Pie><Tooltip formatter={(v) => formatCurrency(v)} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} /></PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"><span className="text-xs text-muted">total</span><span className="font-display font-bold">{formatCurrency(donut.reduce((s, d) => s + d.value, 0))}</span></div>
                  </div>
                  <div className="space-y-1.5 mt-2">{donut.slice(0, 5).map((d, i) => <div key={i} className="flex items-center gap-2 text-sm"><span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} /><span className="flex-1 truncate">{d.name}</span><span className="font-semibold">{formatCurrency(d.value)}</span></div>)}</div>
                </>)}
            </Card>
          </div>
        )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Limite: ${editing?.name || ''}`} maxWidth="max-w-md"
        footer={<><Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button><Button onClick={() => save.mutate({ id: editing.id, budget_limit: limit === '' ? null : Number(limit) })} disabled={save.isPending}>{save.isPending ? <Spinner className="w-4 h-4" /> : 'Salvar'}</Button></>}>
        <Field label="Limite mensal (deixe vazio para remover)"><Input type="number" step="0.01" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="0,00" autoFocus /></Field>
      </Modal>
    </div>
  );
}

function BudgetRing({ pct }) {
  const p = Math.min(100, Math.max(0, pct));
  const r = 46, c = 2 * Math.PI * r, off = c - (p / 100) * c;
  const color = p >= 100 ? '#f43f5e' : p >= 80 ? '#f59e0b' : '#34d399';
  return (
    <div className="relative w-32 h-32 shrink-0">
      <svg width="128" height="128" viewBox="0 0 128 128" className="-rotate-90"><circle cx="64" cy="64" r={r} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="11" /><circle cx="64" cy="64" r={r} fill="none" stroke={color} strokeWidth="11" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} style={{ transition: 'stroke-dashoffset .8s ease' }} /></svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="font-display text-3xl font-extrabold" style={{ color }}>{p}%</span><span className="text-[11px] text-slate-400">usado</span></div>
    </div>
  );
}
