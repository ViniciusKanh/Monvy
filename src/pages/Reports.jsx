import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Transaction, Account, Category } from '../api/entities.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Card, Button, Select, Badge, Spinner } from '../components/ui';
import { formatCurrency, monthKey, monthLabel, monthRange, MONTHS_PT } from '../lib/utils.js';
import { BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { FileText, Download, Printer, TrendingUp } from 'lucide-react';
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
  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);

  const months = useMemo(() => { const [y, m] = endMk.split('-').map(Number); const arr = []; for (let i = period - 1; i >= 0; i--) arr.push(monthKey(new Date(y, m - 1 - i, 1))); return arr; }, [period, endMk]);
  const inPeriod = (d) => months.includes(String(d).slice(0, 7));
  const periodTx = useMemo(() => transactions.filter((t) => inPeriod(t.date)), [transactions, months]);

  const totals = useMemo(() => {
    let inc = 0, exp = 0;
    for (const t of periodTx) { if (t.type === 'income') inc += +t.amount; if (t.type === 'expense') exp += +t.amount; }
    return { inc, exp, bal: inc - exp, rate: inc > 0 ? ((inc - exp) / inc * 100) : 0 };
  }, [periodTx]);

  const totalBalance = accounts.reduce((s, a) => s + Number(a.current_balance || 0), 0);

  const monthly = useMemo(() => months.map((k) => {
    let inc = 0, exp = 0;
    for (const t of transactions) { if (String(t.date).slice(0, 7) !== k) continue; if (t.type === 'income') inc += +t.amount; if (t.type === 'expense') exp += +t.amount; }
    const [y, m] = k.split('-').map(Number);
    return { name: `${MONTHS_PT[m - 1].slice(0, 3)}/${String(y).slice(2)}`, Receita: inc, Despesa: exp, net: inc - exp };
  }), [transactions, months]);

  const evolution = useMemo(() => { let acc = 0; return monthly.map((r) => { acc += r.net; return { name: r.name, Saldo: acc }; }); }, [monthly]);

  const byCategory = useMemo(() => {
    const map = {};
    for (const t of periodTx) if (t.type === 'expense') { const c = catMap[t.category_id]; const n = c?.name || 'Sem categoria'; map[n] = map[n] || { name: n, value: 0, color: c?.color }; map[n].value += +t.amount; }
    return Object.values(map).sort((a, b) => b.value - a.value);
  }, [periodTx, catMap]);
  const maxCat = byCategory[0]?.value || 1;

  const exportCsv = () => {
    const rows = [['Data', 'Tipo', 'Descricao', 'Categoria', 'Valor', 'Status']];
    periodTx.forEach((t) => rows.push([t.date, t.type, (t.description || '').replace(/;/g, ','), catMap[t.category_id]?.name || '', String(t.amount).replace('.', ','), t.status || 'pending']));
    const csv = rows.map((r) => r.join(';')).join('\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `monvy-relatorio-${period}m.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const [emailing, setEmailing] = useState(false);
  const sendByEmail = async () => {
    setEmailing(true);
    try {
      await ReportsApi.email({ summary: {
        name: user?.full_name, periodLabel: period === 1 ? monthLabel(endMk) : `${period} meses ate ${monthLabel(endMk)}`,
        inc: totals.inc, exp: totals.exp, bal: totals.bal, rate: totals.rate, totalBalance,
        categories: byCategory.map((c) => ({ name: c.name, value: c.value })),
      } });
      toast.success('Relatorio enviado para o seu e-mail!');
    } catch (e) { toast.error(e.message || 'Falha ao enviar. Verifique a config de e-mail.'); }
    finally { setEmailing(false); }
  };

  return (
    <div className="space-y-4 animate-fadeIn print:space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div><h1 className="font-display text-2xl font-bold gradient-text">Relatorio Financeiro</h1><p className="text-muted text-sm">Analise completa das suas financas</p></div>
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
            <p className="font-display text-2xl font-bold">{user?.full_name || 'Usuario'}</p>
            <p className="text-sm text-white/80">{user?.email}{user?.profession ? ` · ${user.profession}` : ''}</p>
            <Badge className="mt-1 bg-white/20 text-white border-0">{period === 1 ? monthLabel(endMk) : `${period} meses ate ${monthLabel(endMk)}`}</Badge>
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
        <Reveal i={0}><Card className="py-3 hover-lift h-full"><p className="text-xs text-muted">Receita do periodo</p><p className="font-display text-xl font-bold text-emerald-500"><AnimatedValue value={totals.inc} format={formatCurrency} /></p></Card></Reveal>
        <Reveal i={1}><Card className="py-3 hover-lift h-full"><p className="text-xs text-muted">Despesa do periodo</p><p className="font-display text-xl font-bold text-rose-500"><AnimatedValue value={totals.exp} format={formatCurrency} /></p></Card></Reveal>
        <Reveal i={2}><Card className="py-3 hover-lift h-full"><p className="text-xs text-muted">Saldo do periodo</p><p className={`font-display text-xl font-bold ${totals.bal < 0 ? 'text-rose-500' : ''}`}><AnimatedValue value={totals.bal} format={formatCurrency} /></p></Card></Reveal>
        <Reveal i={3}><Card className="py-3 hover-lift h-full"><p className="text-xs text-muted">Taxa de poupanca</p><p className="font-display text-xl font-bold text-violet-500"><AnimatedValue value={totals.rate} format={(v) => `${v.toFixed(1)}%`} /></p></Card></Reveal>
      </div>

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
        {byCategory.length === 0 ? <p className="text-sm text-muted py-6 text-center">Sem despesas no periodo.</p>
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
    </div>
  );
}
