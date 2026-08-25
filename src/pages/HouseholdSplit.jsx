import { useMemo, useState, useEffect } from 'react';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Input, Field, Button, EmptyState } from '../components/ui';
import { Reveal, AnimatedValue } from '../components/Animated.jsx';
import { formatCurrency } from '../lib/utils.js';
import { Users, Plus, Trash2, ArrowRight, Scale } from 'lucide-react';

const n = (v) => { const x = Number(String(v).replace(',', '.')); return isNaN(x) ? 0 : x; };
const KEY = 'monvy_household';
const uid = () => Math.random().toString(36).slice(2, 9);

export default function HouseholdSplit() {
  const saved = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } })();
  const [modo, setModo] = useState(saved.modo || 'igual'); // igual | renda
  const [pessoas, setPessoas] = useState(saved.pessoas?.length ? saved.pessoas
    : [{ id: uid(), nome: 'Pessoa 1', renda: '3000', pago: '' }, { id: uid(), nome: 'Pessoa 2', renda: '2000', pago: '' }]);

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify({ modo, pessoas })); } catch { /* ignore */ } }, [modo, pessoas]);

  const lista = pessoas || [];
  const upd = (id, campo, val) => setPessoas((p) => p.map((x) => x.id === id ? { ...x, [campo]: val } : x));

  const r = useMemo(() => {
    const totalGasto = lista.reduce((s, p) => s + n(p.pago), 0);
    const totalRenda = lista.reduce((s, p) => s + n(p.renda), 0);
    const nP = lista.length || 1;
    const comBal = lista.map((p) => {
      const peso = modo === 'renda' ? (totalRenda > 0 ? n(p.renda) / totalRenda : 1 / nP) : 1 / nP;
      const justo = totalGasto * peso;
      return { ...p, justo, saldo: n(p.pago) - justo };
    });
    // acertos: quem deve paga quem tem a receber
    const devedores = comBal.filter((p) => p.saldo < -0.01).map((p) => ({ nome: p.nome, v: -p.saldo })).sort((a, b) => b.v - a.v);
    const credores = comBal.filter((p) => p.saldo > 0.01).map((p) => ({ nome: p.nome, v: p.saldo })).sort((a, b) => b.v - a.v);
    const acertos = []; let i = 0, j = 0;
    const dv = devedores.map((x) => ({ ...x })), cr = credores.map((x) => ({ ...x }));
    while (i < dv.length && j < cr.length) {
      const m = Math.min(dv[i].v, cr[j].v);
      if (m > 0.01) acertos.push({ de: dv[i].nome, para: cr[j].nome, valor: m });
      dv[i].v -= m; cr[j].v -= m;
      if (dv[i].v < 0.01) i++; if (cr[j].v < 0.01) j++;
    }
    return { totalGasto, comBal, acertos };
  }, [lista, modo]);

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageHeader title={<span className="flex items-center gap-2"><Users className="w-6 h-6 text-emerald-500" /> Rateio da Casa</span>}
        subtitle="Divida as despesas da casa/família de forma justa e veja quem acerta com quem" />

      <Card>
        <div className="inline-flex p-1 rounded-xl bg-black/5 dark:bg-white/5 mb-3">
          {[['igual', 'Dividir por igual'], ['renda', 'Proporcional à renda']].map(([v, l]) => (
            <button key={v} onClick={() => setModo(v)} className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${modo === v ? 'bg-[hsl(var(--card))] shadow text-emerald-600' : 'text-muted'}`}>{l}</button>
          ))}
        </div>
        <div className="space-y-2">
          <div className="hidden sm:grid grid-cols-[1fr_120px_120px_40px] gap-2 text-xs text-muted px-1"><span>Pessoa</span><span>Renda (R$)</span><span>Já pagou (R$)</span><span /></div>
          {lista.map((p) => (
            <div key={p.id} className="grid grid-cols-2 sm:grid-cols-[1fr_120px_120px_40px] gap-2">
              <Input value={p.nome} onChange={(e) => upd(p.id, 'nome', e.target.value)} placeholder="Nome" />
              <Input type="number" value={p.renda} onChange={(e) => upd(p.id, 'renda', e.target.value)} placeholder="Renda" disabled={modo === 'igual'} />
              <Input type="number" value={p.pago} onChange={(e) => upd(p.id, 'pago', e.target.value)} placeholder="Pagou" />
              <button onClick={() => setPessoas((x) => x.filter((y) => y.id !== p.id))} className="p-2 text-rose-500 justify-self-center"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => setPessoas((x) => [...x, { id: uid(), nome: `Pessoa ${x.length + 1}`, renda: '', pago: '' }])}><Plus className="w-4 h-4" /> Pessoa</Button>
      </Card>

      <div className="rounded-2xl p-5 text-white shadow-lg" style={{ background: 'linear-gradient(135deg,#059669,#0d9488)' }}>
        <p className="text-sm opacity-90 flex items-center gap-1"><Scale className="w-4 h-4" /> Total de despesas compartilhadas</p>
        <p className="font-display text-4xl font-extrabold mt-1"><AnimatedValue value={r.totalGasto} format={formatCurrency} /></p>
      </div>

      <Card>
        <h3 className="font-semibold mb-3">Quanto cabe a cada um</h3>
        <div className="divide-y divide-[hsl(var(--border))]">
          {r.comBal.map((p, i) => (
            <Reveal key={p.id} i={i}><div className="flex items-center gap-3 py-2.5">
              <span className="w-9 h-9 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold shrink-0">{(p.nome || '?')[0].toUpperCase()}</span>
              <div className="flex-1 min-w-0"><p className="font-medium truncate">{p.nome}</p><p className="text-xs text-muted">parte justa {formatCurrency(p.justo)} · pagou {formatCurrency(n(p.pago))}</p></div>
              <span className={`font-semibold ${p.saldo >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{p.saldo >= 0 ? 'recebe ' : 'deve '}{formatCurrency(Math.abs(p.saldo))}</span>
            </div></Reveal>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold mb-3">Acerto de contas</h3>
        {r.acertos.length === 0 ? <EmptyState icon={Scale} title="Tudo quitado" subtitle="Ninguém deve nada — as contas estão equilibradas." />
          : <div className="space-y-2">{r.acertos.map((a, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-black/5 dark:bg-white/5">
              <span className="font-semibold text-rose-500">{a.de}</span><ArrowRight className="w-4 h-4 text-muted" /><span className="font-semibold text-emerald-500">{a.para}</span>
              <span className="ml-auto font-bold">{formatCurrency(a.valor)}</span>
            </div>
          ))}</div>}
      </Card>
    </div>
  );
}
