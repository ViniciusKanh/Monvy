import { useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Input, Field, Select } from '../components/ui';
import { AnimatedValue, Reveal } from '../components/Animated.jsx';
import { formatCurrency } from '../lib/utils.js';
import { Target, CalendarClock, Coins, Wallet } from 'lucide-react';

const n = (v) => { const x = Number(v); return isNaN(x) ? 0 : x; };

export default function GoalPlanner() {
  const [modo, setModo] = useState('aporte'); // aporte = calcula quanto/mes; tempo = calcula em quanto tempo
  const [alvo, setAlvo] = useState('20000');
  const [inicial, setInicial] = useState('2000');
  const [prazo, setPrazo] = useState('24');
  const [aporte, setAporte] = useState('500');
  const [taxa, setTaxa] = useState('0.8');

  const r = useMemo(() => {
    const A = n(alvo), P0 = n(inicial), i = n(taxa) / 100;
    const falta = Math.max(0, A - P0);
    if (modo === 'aporte') {
      const meses = Math.max(1, Math.round(n(prazo)));
      // PMT para atingir A: A = P0*(1+i)^n + PMT*[((1+i)^n -1)/i]
      const fv0 = P0 * Math.pow(1 + i, meses);
      const fator = i === 0 ? meses : (Math.pow(1 + i, meses) - 1) / i;
      const pmt = fator > 0 ? Math.max(0, (A - fv0) / fator) : falta / meses;
      const totalAportado = P0 + pmt * meses;
      return { tipo: 'aporte', meses, pmt, totalAportado, juros: Math.max(0, A - totalAportado) };
    }
    // modo tempo: quantos meses com aporte fixo
    const pmt = n(aporte); let saldo = P0, meses = 0;
    if (saldo < A) {
      while (saldo < A && meses < 1200) { saldo = saldo * (1 + i) + pmt; meses++; }
    }
    const totalAportado = P0 + pmt * meses;
    return { tipo: 'tempo', meses: saldo >= A ? meses : null, pmt, totalAportado, juros: Math.max(0, A - totalAportado), saldoFinal: saldo };
  }, [modo, alvo, inicial, prazo, aporte, taxa]);

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageHeader title={<span className="flex items-center gap-2"><Target className="w-6 h-6 text-emerald-500" /> Planejador de Objetivo</span>}
        subtitle="Planeje uma compra ou sonho: quanto guardar por mês ou em quanto tempo você chega lá" />

      <Card>
        <div className="inline-flex p-1 rounded-xl bg-black/5 dark:bg-white/5 mb-3">
          {[['aporte', 'Quanto guardar/mês'], ['tempo', 'Em quanto tempo']].map(([v, l]) => (
            <button key={v} onClick={() => setModo(v)} className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${modo === v ? 'bg-[hsl(var(--card))] shadow text-emerald-600' : 'text-muted'}`}>{l}</button>
          ))}
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Valor do objetivo (R$)"><Input type="number" value={alvo} onChange={(e) => setAlvo(e.target.value)} /></Field>
          <Field label="Já tenho guardado (R$)"><Input type="number" value={inicial} onChange={(e) => setInicial(e.target.value)} /></Field>
          {modo === 'aporte'
            ? <Field label="Prazo (meses)"><Input type="number" value={prazo} onChange={(e) => setPrazo(e.target.value)} /></Field>
            : <Field label="Aporte mensal (R$)"><Input type="number" value={aporte} onChange={(e) => setAporte(e.target.value)} /></Field>}
          <Field label="Rendimento (% a.m.)"><Input type="number" step="0.01" value={taxa} onChange={(e) => setTaxa(e.target.value)} placeholder="0 = sem render." /></Field>
        </div>
        <p className="text-xs text-muted mt-2">Dica: ~0,8% a.m. é uma estimativa conservadora para renda fixa. Deixe 0 para uma poupança simples sem rendimento.</p>
      </Card>

      <div className="rounded-2xl p-5 text-white shadow-lg" style={{ background: 'linear-gradient(135deg,#059669,#4338ca)' }}>
        {r.tipo === 'aporte' ? (<>
          <p className="text-sm opacity-90">Para juntar {formatCurrency(n(alvo))} em {r.meses} meses, guarde por mês</p>
          <p className="font-display text-4xl font-extrabold mt-1"><AnimatedValue value={r.pmt} format={formatCurrency} /></p>
        </>) : (<>
          <p className="text-sm opacity-90">Guardando {formatCurrency(n(aporte))}/mês, você atinge {formatCurrency(n(alvo))} em</p>
          <p className="font-display text-4xl font-extrabold mt-1">{r.meses != null ? `${r.meses} meses` : 'mais de 100 anos'}</p>
          {r.meses != null && <p className="text-sm opacity-90 mt-1">≈ {(r.meses / 12).toFixed(1)} anos</p>}
        </>)}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Reveal i={0}><Card className="py-4 hover-lift"><p className="text-xs text-muted flex items-center gap-1"><Wallet className="w-3 h-3" /> Total que você aporta</p><p className="font-display text-xl font-bold"><AnimatedValue value={r.totalAportado} format={formatCurrency} /></p></Card></Reveal>
        <Reveal i={1}><Card className="py-4 hover-lift"><p className="text-xs text-muted flex items-center gap-1"><Coins className="w-3 h-3 text-emerald-500" /> Juros que ajudam</p><p className="font-display text-xl font-bold text-emerald-500"><AnimatedValue value={r.juros} format={formatCurrency} /></p></Card></Reveal>
        <Reveal i={2}><Card className="py-4 hover-lift"><p className="text-xs text-muted flex items-center gap-1"><CalendarClock className="w-3 h-3" /> {r.tipo === 'aporte' ? 'Prazo' : 'Tempo estimado'}</p><p className="font-display text-xl font-bold">{r.meses != null ? `${r.meses} meses` : '—'}</p></Card></Reveal>
      </div>
    </div>
  );
}
