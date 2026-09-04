import { useMemo, useState, useEffect } from 'react';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Input, Field, Button, Select, EmptyState } from '../components/ui';
import { Reveal, AnimatedValue } from '../components/Animated.jsx';
import { formatCurrency } from '../lib/utils.js';
import { Users, Plus, Trash2, ArrowRight, Scale, Receipt, HelpCircle } from 'lucide-react';

const n = (v) => { const x = Number(String(v).replace(',', '.')); return isNaN(x) ? 0 : x; };
const KEY = 'monvy_household_v2';
const uid = () => Math.random().toString(36).slice(2, 9);

export default function HouseholdSplit() {
  const saved = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } })();
  const [modo, setModo] = useState(saved.modo || 'igual'); // igual | renda
  const [pessoas, setPessoas] = useState(saved.pessoas?.length ? saved.pessoas
    : [{ id: uid(), nome: 'Você', renda: '3000' }, { id: uid(), nome: 'Parceiro(a)', renda: '2000' }]);
  const [despesas, setDespesas] = useState(saved.despesas?.length ? saved.despesas
    : [{ id: uid(), desc: 'Aluguel', valor: '1500', quem: '' }, { id: uid(), desc: 'Mercado', valor: '900', quem: '' }]);

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify({ modo, pessoas, despesas })); } catch { /* ignore */ } }, [modo, pessoas, despesas]);

  const updP = (id, campo, val) => setPessoas((p) => p.map((x) => x.id === id ? { ...x, [campo]: val } : x));
  const updD = (id, campo, val) => setDespesas((d) => d.map((x) => x.id === id ? { ...x, [campo]: val } : x));

  const r = useMemo(() => {
    const nomeDe = (id) => pessoas.find((p) => p.id === id)?.nome || '—';
    const total = despesas.reduce((s, d) => s + n(d.valor), 0);
    const totalRenda = pessoas.reduce((s, p) => s + n(p.renda), 0);
    const nP = pessoas.length || 1;
    const linhas = pessoas.map((p) => {
      const peso = modo === 'renda' ? (totalRenda > 0 ? n(p.renda) / totalRenda : 1 / nP) : 1 / nP;
      const justo = total * peso;
      const pagou = despesas.filter((d) => d.quem === p.id).reduce((s, d) => s + n(d.valor), 0);
      return { id: p.id, nome: p.nome, peso, justo, pagou, saldo: pagou - justo };
    });
    // acerto de contas (quem deve paga quem tem a receber)
    const dv = linhas.filter((l) => l.saldo < -0.01).map((l) => ({ nome: l.nome, v: -l.saldo })).sort((a, b) => b.v - a.v);
    const cr = linhas.filter((l) => l.saldo > 0.01).map((l) => ({ nome: l.nome, v: l.saldo })).sort((a, b) => b.v - a.v);
    const acertos = []; let i = 0, j = 0;
    while (i < dv.length && j < cr.length) {
      const m = Math.min(dv[i].v, cr[j].v);
      if (m > 0.01) acertos.push({ de: dv[i].nome, para: cr[j].nome, valor: m });
      dv[i].v -= m; cr[j].v -= m; if (dv[i].v < 0.01) i++; if (cr[j].v < 0.01) j++;
    }
    const semDono = despesas.filter((d) => n(d.valor) > 0 && !d.quem).length;
    return { total, linhas, acertos, nomeDe, semDono };
  }, [pessoas, despesas, modo]);

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageHeader title={<span className="flex items-center gap-2"><Users className="w-6 h-6 text-emerald-500" /> Rateio da Casa</span>}
        subtitle="Cadastre as despesas da casa e quem pagou cada uma. O app calcula a parte justa de cada pessoa e quem acerta com quem." />

      <div className="flex items-start gap-2 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 text-sm">
        <HelpCircle className="w-4 h-4 mt-0.5 shrink-0" />
        <span>Como funciona: some todas as despesas da casa, defina a parte justa de cada um (igual ou proporcional à renda) e compare com o que cada pessoa realmente pagou. Quem pagou menos que a parte justa deve; quem pagou mais, recebe.</span>
      </div>

      {/* Passo 1: pessoas */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2"><Users className="w-4 h-4 text-emerald-500" /> 1. Pessoas da casa</h3>
          <div className="inline-flex p-1 rounded-xl bg-black/5 dark:bg-white/5">
            {[['igual', 'Dividir igual'], ['renda', 'Proporcional à renda']].map(([v, l]) => (
              <button key={v} onClick={() => setModo(v)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${modo === v ? 'bg-[hsl(var(--card))] shadow text-emerald-600' : 'text-muted'}`}>{l}</button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          {pessoas.map((p) => (
            <div key={p.id} className="grid grid-cols-[1fr_140px_40px] gap-2 items-center">
              <Input value={p.nome} onChange={(e) => updP(p.id, 'nome', e.target.value)} placeholder="Nome" />
              <Input type="number" value={p.renda} onChange={(e) => updP(p.id, 'renda', e.target.value)} placeholder="Renda (R$)" disabled={modo === 'igual'} title={modo === 'igual' ? 'Usado só no modo proporcional' : ''} />
              <button onClick={() => setPessoas((x) => x.filter((y) => y.id !== p.id))} className="p-2 text-rose-500 justify-self-center" disabled={pessoas.length <= 2}><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => setPessoas((x) => [...x, { id: uid(), nome: `Pessoa ${x.length + 1}`, renda: '' }])}><Plus className="w-4 h-4" /> Pessoa</Button>
      </Card>

      {/* Passo 2: despesas */}
      <Card>
        <h3 className="font-semibold flex items-center gap-2 mb-3"><Receipt className="w-4 h-4 text-indigo-500" /> 2. Despesas da casa</h3>
        <div className="hidden sm:grid grid-cols-[1fr_120px_1fr_40px] gap-2 text-xs text-muted px-1 mb-1"><span>Descrição</span><span>Valor (R$)</span><span>Quem pagou</span><span /></div>
        <div className="space-y-2">
          {despesas.map((d) => (
            <div key={d.id} className="grid grid-cols-2 sm:grid-cols-[1fr_120px_1fr_40px] gap-2 items-center">
              <Input value={d.desc} onChange={(e) => updD(d.id, 'desc', e.target.value)} placeholder="Ex: Luz" />
              <Input type="number" value={d.valor} onChange={(e) => updD(d.id, 'valor', e.target.value)} placeholder="0,00" />
              <Select value={d.quem} onChange={(e) => updD(d.id, 'quem', e.target.value)}>
                <option value="">Quem pagou?</option>
                {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </Select>
              <button onClick={() => setDespesas((x) => x.filter((y) => y.id !== d.id))} className="p-2 text-rose-500 justify-self-center"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => setDespesas((x) => [...x, { id: uid(), desc: '', valor: '', quem: '' }])}><Plus className="w-4 h-4" /> Despesa</Button>
        {r.semDono > 0 && <p className="text-xs text-amber-600 mt-2">⚠ {r.semDono} despesa(s) sem "quem pagou". Selecione o pagador para o acerto ficar correto.</p>}
      </Card>

      {/* Resultado */}
      <div className="rounded-2xl p-5 text-white shadow-lg" style={{ background: 'linear-gradient(135deg,#059669,#0d9488)' }}>
        <p className="text-sm opacity-90 flex items-center gap-1"><Scale className="w-4 h-4" /> Total de despesas da casa</p>
        <p className="font-display text-4xl font-extrabold mt-1"><AnimatedValue value={r.total} format={formatCurrency} /></p>
        <p className="text-sm opacity-90 mt-1">{modo === 'renda' ? 'Dividido proporcionalmente à renda de cada um' : `Dividido igualmente entre ${pessoas.length} pessoas`}</p>
      </div>

      <Card>
        <h3 className="font-semibold mb-3">Parte justa × o que cada um pagou</h3>
        <div className="divide-y divide-[hsl(var(--border))]">
          {r.linhas.map((l, i) => (
            <Reveal key={l.id} i={i}><div className="flex items-center gap-3 py-2.5">
              <span className="w-9 h-9 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold shrink-0">{(l.nome || '?')[0].toUpperCase()}</span>
              <div className="flex-1 min-w-0"><p className="font-medium truncate">{l.nome} <span className="text-xs text-muted">({Math.round(l.peso * 100)}%)</span></p>
                <p className="text-xs text-muted">parte justa {formatCurrency(l.justo)} · pagou {formatCurrency(l.pagou)}</p></div>
              <span className={`font-semibold text-right ${l.saldo >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{l.saldo >= -0.01 ? 'a receber ' : 'a pagar '}<br className="sm:hidden" />{formatCurrency(Math.abs(l.saldo))}</span>
            </div></Reveal>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold mb-3">Acerto de contas</h3>
        {r.acertos.length === 0 ? <EmptyState icon={Scale} title="Tudo quitado" subtitle="Ninguém deve nada — cada um já pagou a sua parte justa." />
          : <div className="space-y-2">{r.acertos.map((a, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-black/5 dark:bg-white/5">
              <span className="font-semibold text-rose-500">{a.de}</span><ArrowRight className="w-4 h-4 text-muted" /><span className="font-semibold text-emerald-500">{a.para}</span>
              <span className="ml-auto font-bold">{formatCurrency(a.valor)}</span>
            </div>
          ))}</div>}
        <p className="text-[11px] text-muted mt-3">Menor número de transferências para todo mundo ficar quite. Dados salvos só no seu navegador.</p>
      </Card>
    </div>
  );
}
