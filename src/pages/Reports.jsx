import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Transaction, Account, Category, CreditCardTransaction } from '../api/entities.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Card, Button, Select, Badge, Spinner } from '../components/ui';
import { formatCurrency, monthKey, monthLabel, monthRange, MONTHS_PT } from '../lib/utils.js';
import { combineExpenses, categoryTrends } from '../lib/analytics.js';
import { BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { FileText, Download, Printer, TrendingUp, TrendingDown, Lightbulb, Sparkles } from 'lucide-react';
import { AnimatedValue, Reveal } from '../components/Animated.jsx';
import { Reports as ReportsApi } from '../api/entities.js';
import { toast } from '../lib/toast.js';
import { Mail } from 'lucide-react';

const COLORS = ['#ef4444', '#3b82f6', '#14b8a6', '#f59e0b', '#8b5cf6', '#ec4899', '#10b981', '#64748b'];

export default function Reports() {
  const { user } = useAuth();
  const [period, setPeriod] = useState(3);
  const [endMk, setEndMk] = useState(monthKey(new Date()));
  const monthOptions = monthRange(11, 3);
  const { data: transactions = [] } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => Account.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });
  const { data: cardTxs = [] } = useQuery({ queryKey: ['cardtx'], queryFn: () => CreditCardTransaction.list() });
  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);

  const tx = useMemo(() => combineExpenses(transactions, cardTxs), [transactions, cardTxs]);
  const months = useMemo(() => { const [y, m] = endMk.split('-').map(Number); const arr = []; for (let i = period - 1; i >= 0; i--) arr.push(monthKey(new Date(y, m - 1 - i, 1))); return arr; }, [period, endMk]);
  const inPeriod = (d) => months.includes(String(d).slice(0, 7));
  const periodTx = useMemo(() => tx.filter((t) => inPeriod(t.date)), [tx, months]);

  const totals = useMemo(() => {
    let inc = 0, exp = 0;
    for (const t of periodTx) { if (t.type === 'income') inc += +t.amount; if (t.type === 'expense') exp += +t.amount; }
    return { inc, exp, bal: inc - exp, rate: inc > 0 ? ((inc - exp) / inc * 100) : 0 };
  }, [periodTx]);

  const totalBalance = accounts.reduce((s, a) => s + Number(a.current_balance || 0), 0);

  const monthly = useMemo(() => months.map((k) => {
    let inc = 0, exp = 0;
    for (const t of tx) { if (String(t.date).slice(0, 7) !== k) continue; if (t.type === 'income') inc += +t.amount; if (t.type === 'expense') exp += +t.amount; }
    const [y, m] = k.split('-').map(Number);
    return { name: `${MONTHS_PT[m - 1].slice(0, 3)}/${String(y).slice(2)}`, Receita: inc, Despesa: exp, net: inc - exp };
  }), [tx, months]);

  const evolution = useMemo(() => { let acc = 0; return monthly.map((r) => { acc += r.net; return { name: r.name, Saldo: acc }; }); }, [monthly]);

  const byCategory = useMemo(() => {
    const map = {};
    for (const t of periodTx) if (t.type === 'expense') { const c = catMap[t.category_id]; const n = c?.name || 'Sem categoria'; map[n] = map[n] || { name: n, value: 0, color: c?.color }; map[n].value += +t.amount; }
    return Object.values(map).sort((a, b) => b.value - a.value);
  }, [periodTx, catMap]);
  const maxCat = byCategory[0]?.value || 1;
  const totalExp = byCategory.reduce((s, c) => s + c.value, 0) || 1;
  const topExpenses = useMemo(() => periodTx.filter((t) => t.type === 'expense').sort((a, b) => b.amount - a.amount).slice(0, 5), [periodTx]);
  const statement = useMemo(() => [...periodTx].sort((a, b) => (a.date < b.date ? 1 : -1)), [periodTx]);
  const trends = useMemo(() => categoryTrends(periodTx, months, catMap), [periodTx, months, catMap]);
  const rising = trends.find((x) => x.change > 25 && x.total > 0);

  const insights = useMemo(() => {
    const arr = [];
    if (monthly.length >= 2) {
      const last = monthly[monthly.length - 1], prev = monthly[monthly.length - 2];
      if (prev.Despesa > 0) { const d = ((last.Despesa - prev.Despesa) / prev.Despesa) * 100; if (Math.abs(d) >= 8) arr.push({ t: d > 0 ? 'warn' : 'ok', m: `Despesas ${d > 0 ? 'subiram' : 'cairam'} ${Math.abs(d).toFixed(0)}% em ${last.name} vs ${prev.name}.` }); }
    }
    if (totals.rate >= 20) arr.push({ t: 'ok', m: `Ótima taxa de poupança no período: ${totals.rate.toFixed(0)}% da renda.` });
    else if (totals.bal < 0) arr.push({ t: 'warn', m: `No período você gastou ${formatCurrency(-totals.bal)} a mais do que ganhou.` });
    else if (totals.inc > 0) arr.push({ t: 'info', m: `Taxa de poupança do período: ${totals.rate.toFixed(0)}%.` });
    if (byCategory[0]) arr.push({ t: 'info', m: `Maior gasto: ${byCategory[0].name} — ${formatCurrency(byCategory[0].value)} (${Math.round((byCategory[0].value / totalExp) * 100)}% das despesas).` });
    if (rising) arr.push({ t: 'warn', m: `${rising.name} vem crescendo (+${rising.change.toFixed(0)}% no período). Vale acompanhar.` });
    if (topExpenses[0]) arr.push({ t: 'info', m: `Maior lançamento único: ${topExpenses[0].description || catMap[topExpenses[0].category_id]?.name || 'Despesa'} (${formatCurrency(topExpenses[0].amount)}).` });
    if (!arr.length) arr.push({ t: 'ok', m: 'Período equilibrado, sem destaques negativos.' });
    return arr;
  }, [monthly, totals, byCategory, totalExp, rising, topExpenses, catMap]);

  const exportCsv = () => {
    const rows = [['Data', 'Tipo', 'Descrição', 'Categoria', 'Valor', 'Status']];
    periodTx.forEach((t) => rows.push([t.date, t.type, (t.description || '').replace(/;/g, ','), catMap[t.category_id]?.name || '', String(t.amount).replace('.', ','), t.status || 'pending']));
    const csv = rows.map((r) => r.join(';')).join('\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `monvy-relatório-${period}m.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const [emailing, setEmailing] = useState(false);
  const sendByEmail = async () => {
    setEmailing(true);
    try {
      await ReportsApi.email({ summary: {
        name: user?.full_name, periodLabel: period === 1 ? monthLabel(endMk) : `${period} meses até ${monthLabel(endMk)}`,
        inc: totals.inc, exp: totals.exp, bal: totals.bal, rate: totals.rate, totalBalance,
        categories: byCategory.map((c) => ({ name: c.name, value: c.value })),
        topExpenses: topExpenses.map((t) => ({ name: t.description || catMap[t.category_id]?.name || 'Despesa', value: Number(t.amount) })),
        insight: rising ? `${rising.name} cresceu ${rising.change.toFixed(0)}% no período — vale acompanhar.` : (totals.rate >= 20 ? `Ótima taxa de poupança: ${totals.rate.toFixed(0)}%.` : null),
      } });
      toast.success('Relatório enviado para o seu e-mail!');
    } catch (e) { toast.error(e.message || 'Falha ao enviar. Verifique a config de e-mail.'); }
    finally { setEmailing(false); }
  };

  return (
    <div className="space-y-4 animate-fadeIn print:space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div><h1 className="font-display text-2xl font-bold gradient-text">Relatório Financeiro</h1><p className="text-muted text-sm">Análise completa das suas financas</p></div>
        <div className="flex items-center gap-2 print:hidden flex-wrap">
          <Select value={endMk} onChange={(e) => setEndMk(e.target.value)} className="w-auto">{monthOptions.map((k) => <option key={k} value={k}>{monthLabel(k)}</option>)}</Select>
          <Select value={period} onChange={(e) => setPeriod(Number(e.target.value))} className="w-auto"><option value={1}>Somente o mes</option><option value={3}>3 meses</option><option value={6}>6 meses</option><option value={12}>12 meses</option></Select>
          <Button variant="outline" onClick={exportCsv}><Download className="w-4 h-4" /> CSV</Button>
          <Button variant="outline" onClick={sendByEmail} disabled={emailing}>{emailing ? <Spinner className="w-4 h-4" /> : <><Mail className="w-4 h-4" /> Enviar por e-mail</>}</Button>
          <Button onClick={() => window.print()}><Printer className="w-4 h-4" /> Exportar PDF</Button>
        </div>
      </div>

      {/* header perfil */}
      <div className="relative overflow-hidden rounded-2xl p-6 text-white shadow-soft flex flex-wrap items-center justify-between gap-4 animate-gradient" style={{ background: 'linear-gradient(120deg,#4f46e5,#7c3aed 40%,#ec4899 80%,#4f46e5)' }}>
        <div className="sheen" />
        <div className="flex items-center gap-4">
          {user?.photo_url ? <img src={user.photo_url} alt="" className="w-16 h-16 rounded-2xl object-cover border-2 border-white/30" />
            : <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center font-display font-bold text-2xl">{(user?.full_name || '?').slice(0, 1)}</div>}
          <div>
            <p className="font-display text-2xl font-bold">{user?.full_name || 'Usuário'}</p>
            <p className="text-sm text-white/80">{user?.email}{user?.profession ? ` · ${user.profession}` : ''}</p>
            <Badge className="mt-1 bg-white/20 text-white border-0">{period === 1 ? monthLabel(endMk) : `${period} meses até ${monthLabel(endMk)}`}</Badge>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-white/70">Saldo Total</p>
          <p className="font-display text-3xl font-extrabold">{formatCurrency(totalBalance)}</p>
          <p className="text-xs text-white/70">{new Date().toLocaleDateString('pt-BR')}</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Reveal i={0}><Card className="py-3 hover-lift h-full"><p className="text-xs text-muted">Receita do período</p><p className="font-display text-xl font-bold text-emerald-500"><AnimatedValue value={totals.inc} format={formatCurrency} /></p></Card></Reveal>
        <Reveal i={1}><Card className="py-3 hover-lift h-full"><p className="text-xs text-muted">Despesa do período</p><p className="font-display text-xl font-bold text-rose-500"><AnimatedValue value={totals.exp} format={formatCurrency} /></p></Card></Reveal>
        <Reveal i={2}><Card className="py-3 hover-lift h-full"><p className="text-xs text-muted">Saldo do período</p><p className={`font-display text-xl font-bold ${totals.bal < 0 ? 'text-rose-500' : ''}`}><AnimatedValue value={totals.bal} format={formatCurrency} /></p></Card></Reveal>
        <Reveal i={3}><Card className="py-3 hover-lift h-full"><p className="text-xs text-muted">Taxa de poupança</p><p className="font-display text-xl font-bold text-violet-500"><AnimatedValue value={totals.rate} format={(v) => `${v.toFixed(1)}%`} /></p></Card></Reveal>
      </div>

      {/* Resumo inteligente */}
      <Card>
        <h3 className="font-semibold flex items-center gap-2 mb-3"><Sparkles className="w-4 h-4 text-indigo-500" /> Resumo inteligente do período</h3>
        <div className="grid sm:grid-cols-2 gap-2">
          {insights.map((i, k) => (
            <div key={k} className={`flex items-start gap-2 p-3 rounded-xl text-sm ${i.t === 'warn' ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300' : i.t === 'ok' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'}`}>
              {i.t === 'warn' ? <TrendingUp className="w-4 h-4 mt-0.5 shrink-0" /> : i.t === 'ok' ? <TrendingDown className="w-4 h-4 mt-0.5 shrink-0" /> : <Lightbulb className="w-4 h-4 mt-0.5 shrink-0" />}
              <span>{i.m}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card><h3 className="font-semibold mb-3">Receitas vs Despesas</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthly}><CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} /><YAxis width={40} tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} /><Tooltip formatter={(v) => formatCurrency(v)} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} /><Bar dataKey="Receita" fill="#10b981" radius={[6,6,0,0]} maxBarSize={30} /><Bar dataKey="Despesa" fill="#ef4444" radius={[6,6,0,0]} maxBarSize={30} /></BarChart>
          </ResponsiveContainer>
        </Card>
        <Card><h3 className="font-semibold mb-3 flex items-center gap-1"><TrendingUp className="w-4 h-4 text-violet-500" /> Evolucao do Saldo (acumulado)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={evolution}><defs><linearGradient id="gArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} /><stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} /><YAxis width={44} tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 || v <= -1000 ? `${(v/1000).toFixed(0)}k` : v} /><Tooltip formatter={(v) => formatCurrency(v)} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} /><Area dataKey="Saldo" stroke="#8b5cf6" strokeWidth={2} fill="url(#gArea)" /></AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card>
        <h3 className="font-semibold mb-3">Despesas por Categoria</h3>
        {byCategory.length === 0 ? <p className="text-sm text-muted py-6 text-center">Sem despesas no período.</p>
          : (
            <div className="grid md:grid-cols-2 gap-6 items-center">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart><Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2} stroke="none">{byCategory.map((e, i) => <Cell key={i} fill={e.color || COLORS[i % COLORS.length]} />)}</Pie><Tooltip formatter={(v) => formatCurrency(v)} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} /></PieChart>
              </ResponsiveContainer>
              <div className="space-y-3">
                {byCategory.slice(0, 6).map((c, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1"><span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: c.color || COLORS[i % COLORS.length] }} />{c.name}</span><span className="font-semibold">{formatCurrency(c.value)}</span></div>
                    <div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(c.value / maxCat) * 100}%`, background: c.color || COLORS[i % COLORS.length] }} /></div>
                  </div>
                ))}
              </div>
            </div>
          )}
      </Card>

      {/* Maiores despesas + resumo por categoria */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="font-semibold mb-3">Maiores despesas do período</h3>
          {topExpenses.length === 0 ? <p className="text-sm text-muted py-4 text-center">Sem despesas no período.</p>
            : <div className="space-y-2">{topExpenses.map((t, i) => { const c = catMap[t.category_id]; return (
              <div key={t.id} className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-lg bg-rose-500/10 text-rose-500 text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                <div className="min-w-0 flex-1"><p className="text-sm font-medium truncate">{t.description || c?.name || 'Despesa'}</p><p className="text-[11px] text-muted">{new Date(t.date + 'T00:00').toLocaleDateString('pt-BR')} · {c?.name || 'Sem categoria'}</p></div>
                <span className="font-semibold text-rose-500 shrink-0">{formatCurrency(t.amount)}</span>
              </div>
            ); })}</div>}
        </Card>
        <Card>
          <h3 className="font-semibold mb-3">Resumo por categoria</h3>
          {byCategory.length === 0 ? <p className="text-sm text-muted py-4 text-center">Sem dados.</p>
            : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-muted border-b border-[hsl(var(--border))]"><th className="py-1.5 font-medium">Categoria</th><th className="py-1.5 font-medium text-right">Valor</th><th className="py-1.5 font-medium text-right">%</th></tr></thead>
              <tbody>{byCategory.map((c, i) => (<tr key={i} className="border-b border-[hsl(var(--border))] last:border-0"><td className="py-1.5 flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: c.color || COLORS[i % COLORS.length] }} />{c.name}</td><td className="py-1.5 text-right font-medium">{formatCurrency(c.value)}</td><td className="py-1.5 text-right text-muted">{((c.value / totalExp) * 100).toFixed(1)}%</td></tr>))}</tbody>
              <tfoot><tr className="font-bold"><td className="py-1.5">Total</td><td className="py-1.5 text-right">{formatCurrency(totalExp)}</td><td className="py-1.5 text-right">100%</td></tr></tfoot>
            </table></div>}
        </Card>
      </div>

      {/* Extrato detalhado (para PDF) */}
      <Card>
        <div className="flex items-center justify-between mb-3"><h3 className="font-semibold">Extrato detalhado</h3><span className="text-xs text-muted">{statement.length} lançamento(s)</span></div>
        {statement.length === 0 ? <p className="text-sm text-muted py-4 text-center">Sem lançamentos no período.</p>
          : <div className="overflow-x-auto max-h-96 overflow-y-auto print:max-h-none print:overflow-visible">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[hsl(var(--card))]"><tr className="text-left text-muted border-b border-[hsl(var(--border))]"><th className="py-1.5 font-medium">Data</th><th className="py-1.5 font-medium">Descrição</th><th className="py-1.5 font-medium">Categoria</th><th className="py-1.5 font-medium text-right">Valor</th></tr></thead>
              <tbody>{statement.map((t) => { const c = catMap[t.category_id]; const isInc = t.type === 'income'; return (
                <tr key={t.id} className="border-b border-[hsl(var(--border))] last:border-0">
                  <td className="py-1.5 whitespace-nowrap text-muted">{new Date(t.date + 'T00:00').toLocaleDateString('pt-BR')}</td>
                  <td className="py-1.5">{t.description || c?.name || (isInc ? 'Receita' : t.type === 'transfer' ? 'Transferencia' : 'Despesa')}</td>
                  <td className="py-1.5 text-muted">{t.type === 'transfer' ? 'Transferencia' : (c?.name || '—')}</td>
                  <td className={`py-1.5 text-right font-medium whitespace-nowrap ${isInc ? 'text-emerald-500' : t.type === 'transfer' ? 'text-indigo-500' : 'text-rose-500'}`}>{isInc ? '+' : t.type === 'transfer' ? '' : '-'}{formatCurrency(t.amount)}</td>
                </tr>
              ); })}</tbody>
            </table>
          </div>}
      </Card>
    </div>
  );
}
