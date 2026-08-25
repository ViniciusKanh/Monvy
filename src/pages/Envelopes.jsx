import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Transaction, Category, CreditCardTransaction } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Input, Field, Button, Select, Spinner, EmptyState } from '../components/ui';
import { Reveal, AnimatedValue } from '../components/Animated.jsx';
import { formatCurrency, monthLabel } from '../lib/utils.js';
import { combineExpenses } from '../lib/analytics.js';
import { Mail, Plus, Trash2, Wallet, CheckCircle2, AlertTriangle } from 'lucide-react';

const n = (v) => { const x = Number(String(v).replace(',', '.')); return isNaN(x) ? 0 : x; };
const KEY = 'monvy_envelopes';
const uid = () => Math.random().toString(36).slice(2, 9);
const nowMk = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

export default function Envelopes() {
  const saved = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } })();
  const [envs, setEnvs] = useState(saved);
  const [nome, setNome] = useState('');
  const [limite, setLimite] = useState('');
  const [catId, setCatId] = useState('');

  const { data: transactions = [], isLoading } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });
  const { data: cardTxs = [] } = useQuery({ queryKey: ['cardtx'], queryFn: () => CreditCardTransaction.list() });

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(envs)); } catch { /* ignore */ } }, [envs]);

  const mk = nowMk();
  const gastoPorCat = useMemo(() => {
    const map = {};
    for (const t of combineExpenses(transactions, cardTxs)) {
      if (t.type !== 'expense' || String(t.date).slice(0, 7) !== mk) continue;
      if (t.category_id) map[t.category_id] = (map[t.category_id] || 0) + n(t.amount);
    }
    return map;
  }, [transactions, cardTxs, mk]);

  const lista = useMemo(() => envs.map((e) => {
    const gasto = e.catId ? (gastoPorCat[e.catId] || 0) : n(e.gastoManual);
    const lim = n(e.limite);
    return { ...e, gasto, lim, restante: lim - gasto, pct: lim > 0 ? Math.min(100, (gasto / lim) * 100) : 0, estourou: gasto > lim };
  }), [envs, gastoPorCat]);

  const totalLim = lista.reduce((s, e) => s + e.lim, 0);
  const totalGasto = lista.reduce((s, e) => s + e.gasto, 0);

  const addEnv = () => {
    if (!nome.trim() || !n(limite)) return;
    setEnvs((x) => [...x, { id: uid(), nome: nome.trim(), limite, catId: catId || null }]);
    setNome(''); setLimite(''); setCatId('');
  };

  if (isLoading) return <div className="flex justify-center py-24"><Spinner className="w-8 h-8 text-emerald-500" /></div>;

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageHeader title={<span className="flex items-center gap-2"><Mail className="w-6 h-6 text-emerald-500" /> Envelopes de Orçamento</span>}
        subtitle={`Método dos envelopes: um limite por categoria e o quanto já foi usado em ${monthLabel(mk)}`} />

      <Card>
        <h3 className="font-semibold mb-3">Novo envelope</h3>
        <div className="grid sm:grid-cols-[1fr_130px_1fr_auto] gap-2 items-end">
          <Field label="Nome"><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Mercado" /></Field>
          <Field label="Limite/mês (R$)"><Input type="number" value={limite} onChange={(e) => setLimite(e.target.value)} /></Field>
          <Field label="Categoria (auto-conta os gastos)"><Select value={catId} onChange={(e) => setCatId(e.target.value)}>
            <option value="">Sem vínculo (manual)</option>
            {categories.filter((c) => c.type === 'expense').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select></Field>
          <Button onClick={addEnv}><Plus className="w-4 h-4" /> Criar</Button>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Reveal i={0}><Card className="py-4 hover-lift"><p className="text-xs text-muted flex items-center gap-1"><Wallet className="w-3 h-3" /> Orçado (envelopes)</p><p className="font-display text-2xl font-bold"><AnimatedValue value={totalLim} format={formatCurrency} /></p></Card></Reveal>
        <Reveal i={1}><Card className="py-4 hover-lift"><p className="text-xs text-muted">Gasto no mês</p><p className="font-display text-2xl font-bold text-rose-500"><AnimatedValue value={totalGasto} format={formatCurrency} /></p></Card></Reveal>
        <Reveal i={2}><Card className="py-4 hover-lift"><p className="text-xs text-muted">Disponível</p><p className={`font-display text-2xl font-bold ${totalLim - totalGasto >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}><AnimatedValue value={totalLim - totalGasto} format={formatCurrency} /></p></Card></Reveal>
      </div>

      {lista.length === 0 ? <Card><EmptyState icon={Mail} title="Nenhum envelope ainda" subtitle="Crie envelopes por categoria para controlar seus gastos do mês." /></Card>
        : <div className="grid sm:grid-cols-2 gap-3">
          {lista.map((e, i) => (
            <Reveal key={e.id} i={i}><Card className="hover-lift">
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${e.estourou ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-600'}`}>{e.estourou ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}</span>
                <div className="flex-1 min-w-0"><p className="font-semibold truncate">{e.nome}</p><p className="text-xs text-muted">{e.catId ? 'automático pela categoria' : 'controle manual'}</p></div>
                <button onClick={() => setEnvs((x) => x.filter((y) => y.id !== e.id))} className="p-1.5 text-muted hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>
              </div>
              <div className="h-2.5 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${e.pct}%`, background: e.estourou ? '#ef4444' : e.pct > 80 ? '#f59e0b' : '#10b981' }} /></div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-muted">{formatCurrency(e.gasto)} de {formatCurrency(e.lim)}</span>
                <span className={`font-semibold ${e.restante >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{e.restante >= 0 ? `${formatCurrency(e.restante)} livre` : `${formatCurrency(-e.restante)} acima`}</span>
              </div>
              {!e.catId && <div className="mt-2"><Input type="number" value={e.gastoManual || ''} onChange={(ev) => setEnvs((x) => x.map((y) => y.id === e.id ? { ...y, gastoManual: ev.target.value } : y))} placeholder="Lançar gasto manual (R$)" /></div>}
            </Card></Reveal>
          ))}
        </div>}
      <p className="text-xs text-muted text-center">Envelopes vinculados a uma categoria somam automaticamente seus lançamentos e faturas do mês atual. Dados salvos no seu navegador.</p>
    </div>
  );
}
