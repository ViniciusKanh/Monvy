import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Landmark, CreditCard, FileText, PiggyBank, ChevronRight, Store } from 'lucide-react';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Button, Select, Badge, Spinner, EmptyState } from '../components/ui';
import { AnimatedValue, Reveal } from '../components/Animated.jsx';
import { formatCurrency, MONTHS_PT } from '../lib/utils.js';
import { TaxLedger, FiscalNote } from '../api/entities.js';
import { BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const NF_TAX = { icms: 'ICMS', ipi: 'IPI', pis: 'PIS', cofins: 'COFINS', ii: 'II', issqn: 'ISSQN', fcp: 'FCP' };
const SOURCE_COLORS = { Fatura: '#6d28d9', 'Nota fiscal': '#059669', Informe: '#2563eb' };
const PIE = ['#059669', '#0d9488', '#f59e0b', '#8b5cf6', '#3b82f6', '#ef4444', '#ec4899', '#64748b'];

export default function Impostos() {
  const nav = useNavigate();
  const nowY = new Date().getFullYear();
  const [year, setYear] = useState(nowY);
  const years = [nowY, nowY - 1, nowY - 2];

  const { data: ledger = [], isLoading: l1 } = useQuery({ queryKey: ['tax-ledger-all'], queryFn: () => TaxLedger.list() });
  const { data: notes = [], isLoading: l2 } = useQuery({ queryKey: ['fiscal-notes'], queryFn: () => FiscalNote.list() });
  const loading = l1 || l2;

  const data = useMemo(() => {
    const ys = String(year);
    const iof = ledger.filter((r) => r.source === 'invoice' && r.kind === 'IOF' && String(r.reference_month || '').startsWith(ys));
    const informe = ledger.filter((r) => r.source === 'informe' && Number(r.year) === year);
    const nfe = notes.filter((r) => String(r.reference_month || '').startsWith(ys));

    const iofTotal = iof.reduce((s, r) => s + Number(r.amount || 0), 0);
    const informeTotal = informe.reduce((s, r) => s + Number(r.amount || 0), 0);
    const nfeTotal = nfe.reduce((s, r) => s + Number(r.total_tax || 0), 0);
    const total = iofTotal + informeTotal + nfeTotal;

    // por tipo de tributo
    const byType = { IOF: iofTotal, 'IR (aplicações)': informeTotal };
    for (const nt of nfe) for (const [k, v] of Object.entries(nt.taxes || {})) {
      if (k === 'aproximado') continue;
      if (Number(v) > 0) byType[NF_TAX[k] || k] = (byType[NF_TAX[k] || k] || 0) + Number(v);
    }
    // se as notas só têm o aproximado (varejo), representa como "Consumo (aprox.)"
    const somaExplicitaNfe = Object.entries(byType).filter(([k]) => Object.values(NF_TAX).includes(k)).reduce((s, [, v]) => s + v, 0);
    if (somaExplicitaNfe === 0 && nfeTotal > 0) byType['Consumo (NFe)'] = nfeTotal;
    const typeArr = Object.entries(byType).map(([name, value]) => ({ name, value })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value);

    // por fonte
    const sourceArr = [
      { name: 'Fatura', value: iofTotal, hint: 'IOF do cartão' },
      { name: 'Nota fiscal', value: nfeTotal, hint: 'tributos em compras' },
      { name: 'Informe', value: informeTotal, hint: 'IR em aplicações' },
    ].filter((x) => x.value > 0);

    // mês a mês (IOF + NFe; informe é anual)
    const monthly = Array.from({ length: 12 }, (_, m) => {
      const mk = `${ys}-${String(m + 1).padStart(2, '0')}`;
      const i = iof.filter((r) => r.reference_month === mk).reduce((s, r) => s + Number(r.amount || 0), 0);
      const nf = nfe.filter((r) => r.reference_month === mk).reduce((s, r) => s + Number(r.total_tax || 0), 0);
      return { name: MONTHS_PT[m].slice(0, 3), IOF: i, Notas: nf };
    });

    // top emitentes (lojas) e top cartões
    const byEmitter = {};
    for (const nt of nfe) byEmitter[nt.emitter || 'Emitente'] = (byEmitter[nt.emitter || 'Emitente'] || 0) + Number(nt.total_tax || 0);
    const topEmitters = Object.entries(byEmitter).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);

    // eventos referenciados (linha do tempo)
    const events = [
      ...iof.map((r) => ({ id: r.id, source: 'Fatura', kind: 'IOF', label: r.origin_label, when: r.reference_month, amount: Number(r.amount || 0) })),
      ...nfe.map((r) => ({ id: r.id, source: 'Nota fiscal', kind: 'Consumo', label: r.emitter, when: r.reference_month, amount: Number(r.total_tax || 0) })),
      ...informe.map((r) => ({ id: r.id, source: 'Informe', kind: 'IR', label: r.origin_label, when: String(r.year), amount: Number(r.amount || 0) })),
    ].sort((a, b) => String(b.when).localeCompare(String(a.when)));

    return { total, iofTotal, informeTotal, nfeTotal, typeArr, sourceArr, monthly, topEmitters, events, hasData: total > 0 };
  }, [ledger, notes, year]);

  if (loading) return <div className="flex items-center justify-center py-24"><Spinner className="w-8 h-8" /></div>;

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <PageHeader title={<span className="flex items-center gap-2"><Landmark className="w-6 h-6 text-emerald-500" /> Impostos</span>}
          subtitle="Tributos que o Monvy consegue medir: IOF das faturas, notas fiscais e IR das aplicações" />
        <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-auto">{years.map((y) => <option key={y} value={y}>{y}</option>)}</Select>
      </div>

      {/* Hero — total medido com selo */}
      <div className="relative overflow-hidden rounded-2xl p-6 text-white shadow-lg" style={{ background: 'linear-gradient(135deg,#064e3b,#0f766e)' }}>
        <Landmark className="absolute right-4 top-4 w-24 h-24 opacity-10" />
        <p className="text-sm opacity-90">Tributos medidos em {year}</p>
        <p className="font-display text-4xl font-extrabold mt-1"><AnimatedValue value={data.total} format={formatCurrency} /></p>
        <div className="flex flex-wrap gap-4 mt-3 text-sm">
          <span className="inline-flex items-center gap-1.5"><CreditCard className="w-4 h-4" /> IOF {formatCurrency(data.iofTotal)}</span>
          <span className="inline-flex items-center gap-1.5"><FileText className="w-4 h-4" /> Notas {formatCurrency(data.nfeTotal)}</span>
          <span className="inline-flex items-center gap-1.5"><PiggyBank className="w-4 h-4" /> IR {formatCurrency(data.informeTotal)}</span>
        </div>
        <p className="text-xs opacity-80 mt-3">Estes são valores <b>confirmados</b> por documento. A estimativa completa (INSS, IRRF do salário e consumo por IBPT) fica em Minha Carga Tributária.</p>
      </div>

      {!data.hasData ? (
        <EmptyState icon={FileText} title="Sem tributos medidos ainda"
          subtitle="Importe uma fatura em Cartões (captura o IOF), guarde notas fiscais em Notas Fiscais, ou lance o informe de rendimentos na Carga Tributária."
          action={<div className="flex gap-2"><Button variant="outline" onClick={() => nav('/notas-fiscais')}><FileText className="w-4 h-4" /> Notas Fiscais</Button><Button variant="outline" onClick={() => nav('/cartoes')}><CreditCard className="w-4 h-4" /> Cartões</Button></div>} />
      ) : (
        <>
          <div className="grid lg:grid-cols-2 gap-3">
            <Card>
              <h3 className="font-semibold text-sm mb-3">Por tipo de tributo</h3>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={data.typeArr} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={52} paddingAngle={2}>
                    {data.typeArr.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                {data.typeArr.map((t, i) => <span key={t.name} className="text-xs flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: PIE[i % PIE.length] }} />{t.name}: {formatCurrency(t.value)}</span>)}
              </div>
            </Card>
            <Card>
              <h3 className="font-semibold text-sm mb-3">Mês a mês (IOF + notas)</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.monthly}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="name" fontSize={11} /><YAxis fontSize={10} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                  <Bar dataKey="IOF" stackId="a" fill="#6d28d9" />
                  <Bar dataKey="Notas" stackId="a" fill="#059669" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-3">
            {/* Por fonte */}
            <Card>
              <h3 className="font-semibold text-sm mb-3">Por fonte</h3>
              <div className="space-y-2">
                {data.sourceArr.map((s) => {
                  const pct = data.total > 0 ? (s.value / data.total) * 100 : 0;
                  return (
                    <div key={s.name}>
                      <div className="flex justify-between text-sm"><span>{s.name} <span className="text-xs text-muted">· {s.hint}</span></span><b>{formatCurrency(s.value)}</b></div>
                      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className="h-2 rounded-full" style={{ width: `${pct}%`, background: SOURCE_COLORS[s.name] || '#059669' }} /></div>
                    </div>
                  );
                })}
              </div>
            </Card>
            {/* Top lojas */}
            <Card>
              <h3 className="font-semibold text-sm mb-3">Onde mais paguei imposto (notas)</h3>
              {data.topEmitters.length === 0 ? <p className="text-sm text-muted">Sem notas fiscais neste ano.</p>
                : <div className="space-y-1.5">{data.topEmitters.map((e) => (
                    <div key={e.name} className="flex items-center justify-between text-sm"><span className="flex items-center gap-2 truncate"><Store className="w-3.5 h-3.5 text-slate-400 shrink-0" />{e.name}</span><b>{formatCurrency(e.value)}</b></div>
                  ))}</div>}
            </Card>
          </div>

          {/* Linha do tempo referenciada */}
          <Card>
            <h3 className="font-semibold text-sm mb-3">Lançamentos de imposto ({data.events.length})</h3>
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {data.events.map((ev) => (
                <div key={ev.id} className="flex items-center justify-between py-1.5 border-b border-[hsl(var(--border))] last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm truncate">{ev.kind} · <span className="text-muted">{ev.label}</span></p>
                    <p className="text-xs text-muted">{ev.source} · {ev.when}</p>
                  </div>
                  <span className="flex items-center gap-2 shrink-0"><Badge color={ev.source === 'Fatura' ? 'violet' : ev.source === 'Informe' ? 'blue' : 'emerald'}>{ev.source}</Badge><b className="text-sm">{formatCurrency(ev.amount)}</b></span>
                </div>
              ))}
            </div>
          </Card>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => nav('/notas-fiscais')}><FileText className="w-4 h-4" /> Gerenciar notas fiscais</Button>
            <Button variant="outline" onClick={() => nav('/carga-tributaria')}><Landmark className="w-4 h-4" /> Ver Carga Tributária <ChevronRight className="w-4 h-4" /></Button>
          </div>
        </>
      )}
    </div>
  );
}
