import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Transaction, Category, CreditCardTransaction } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Input, Field, Button, Select, Spinner, EmptyState } from '../components/ui';
import { Reveal, AnimatedValue } from '../components/Animated.jsx';
import { formatCurrency, monthLabel } from '../lib/utils.js';
import { combineExpenses } from '../lib/analytics.js';
import { Mail, Plus, Trash2, Wallet, Download, Info } from 'lucide-react';

const n = (v) => { const x = Number(String(v).replace(',', '.')); return isNaN(x) ? 0 : x; };
const KEY = 'monvy_envelopes';
const uid = () => Math.random().toString(36).slice(2, 9);
const nowMk = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

// visual de envelope de papel (manila), com aba, lacre e "recheio" que enche
function Envelope({ e, onRemove, onManual }) {
  const status = e.estourou ? '#ef4444' : e.pct > 80 ? '#f59e0b' : '#10b981';
  return (
    <div className="relative rounded-2xl overflow-hidden shadow-card hover-lift" style={{ background: 'linear-gradient(165deg,#f7edd6,#eadbb2)', color: '#4a3f29' }}>
      {/* aba do envelope */}
      <div className="absolute inset-x-0 top-0 h-16 pointer-events-none" style={{ background: 'linear-gradient(180deg,#efe0bb,#e3d0a2)', clipPath: 'polygon(0 0,100% 0,50% 96%)' }} />
      <div className="absolute inset-x-0 top-0 h-16 pointer-events-none opacity-40" style={{ borderBottom: '1px solid rgba(120,90,40,.35)', clipPath: 'polygon(0 0,100% 0,50% 96%)' }} />
      {/* lacre */}
      <div className="absolute left-1/2 -translate-x-1/2 top-[52px] z-10 w-11 h-11 rounded-full flex items-center justify-center text-white text-[11px] font-bold shadow-md" style={{ background: status }}>
        {Math.round(e.pct)}%
      </div>

      <button onClick={() => onRemove(e.id)} className="absolute top-2 right-2 z-10 p-1.5 rounded-lg text-[#7a6a45] hover:bg-black/10"><Trash2 className="w-4 h-4" /></button>

      <div className="relative px-4 pt-20 pb-4">
        <div className="text-center mb-3">
          <p className="font-display font-bold text-lg leading-tight truncate">{e.nome}</p>
          <p className="text-[11px] opacity-70">{e.source === 'budget' ? 'do Orçamento' : e.catId ? 'automático pela categoria' : 'controle manual'}</p>
        </div>

        {/* recheio: quanto do envelope já foi usado */}
        <div className="relative h-3 rounded-full overflow-hidden" style={{ background: 'rgba(74,63,41,.15)' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${e.pct}%`, background: status }} />
        </div>
        <div className="flex justify-between items-baseline mt-2">
          <span className="text-sm font-semibold">{formatCurrency(e.gasto)}</span>
          <span className="text-xs opacity-70">de {formatCurrency(e.lim)}</span>
        </div>
        <p className={`text-center text-sm font-bold mt-2 ${e.restante >= 0 ? '' : 'text-rose-600'}`} style={e.restante >= 0 ? { color: '#2f7d4f' } : {}}>
          {e.restante >= 0 ? `${formatCurrency(e.restante)} ainda no envelope` : `${formatCurrency(-e.restante)} acima do limite`}
        </p>

        {!e.catId && e.source !== 'budget' && (
          <div className="mt-3">
            <input type="number" value={e.gastoManual || ''} onChange={(ev) => onManual(e.id, ev.target.value)} placeholder="Lançar gasto manual (R$)"
              className="w-full rounded-lg px-3 py-2 text-sm bg-white/60 border border-[#d8c79c] outline-none focus:ring-2 focus:ring-[#c9b47f] text-[#4a3f29] placeholder-[#8a7a55]" />
          </div>
        )}
      </div>
    </div>
  );
}

export default function Envelopes() {
  const navigate = useNavigate();
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

  const catName = (id) => categories.find((c) => c.id === id)?.name || 'Categoria';

  const lista = useMemo(() => envs.map((e) => {
    const gasto = e.catId ? (gastoPorCat[e.catId] || 0) : n(e.gastoManual);
    const lim = n(e.limite);
    return { ...e, nome: e.source === 'budget' ? catName(e.catId) : e.nome, gasto, lim, restante: lim - gasto, pct: lim > 0 ? Math.min(100, (gasto / lim) * 100) : 0, estourou: gasto > lim };
  }), [envs, gastoPorCat, categories]);

  const totalLim = lista.reduce((s, e) => s + e.lim, 0);
  const totalGasto = lista.reduce((s, e) => s + e.gasto, 0);

  const orcamentoCats = categories.filter((c) => c.type === 'expense' && n(c.budget_limit) > 0);
  const jaTem = new Set(envs.filter((e) => e.catId).map((e) => e.catId));
  const importaveis = orcamentoCats.filter((c) => !jaTem.has(c.id));

  const importarDoOrcamento = () => {
    setEnvs((x) => [...x, ...importaveis.map((c) => ({ id: uid(), source: 'budget', catId: c.id, limite: n(c.budget_limit) }))]);
  };

  const addEnv = () => {
    if (!nome.trim() || !n(limite)) return;
    setEnvs((x) => [...x, { id: uid(), nome: nome.trim(), limite, catId: catId || null }]);
    setNome(''); setLimite(''); setCatId('');
  };
  const onManual = (id, v) => setEnvs((x) => x.map((y) => y.id === id ? { ...y, gastoManual: v } : y));

  if (isLoading) return <div className="flex justify-center py-24"><Spinner className="w-8 h-8 text-emerald-500" /></div>;

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageHeader title={<span className="flex items-center gap-2"><Mail className="w-6 h-6 text-emerald-500" /> Envelopes de Orçamento</span>}
        subtitle={`Aloque seu dinheiro em "potes" e veja o quanto sobra em cada um — ${monthLabel(mk)}`}
        actions={importaveis.length > 0 ? <Button variant="outline" onClick={importarDoOrcamento}><Download className="w-4 h-4" /> Importar do Orçamento ({importaveis.length})</Button> : null} />

      <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 text-sm">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <span>Diferente do <button onClick={() => navigate('/orcamento')} className="underline font-medium">Orçamento</button> (limites oficiais por categoria), os envelopes são um método visual de dividir a renda em potes mentais. Você pode <b>importar os limites do seu Orçamento</b> ou criar envelopes livres (inclusive sem categoria, controlados na mão).</span>
      </div>

      <Card>
        <h3 className="font-semibold mb-3">Novo envelope</h3>
        <div className="grid sm:grid-cols-[1fr_130px_1fr_auto] gap-2 items-end">
          <Field label="Nome"><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Lazer" /></Field>
          <Field label="Limite/mês (R$)"><Input type="number" value={limite} onChange={(e) => setLimite(e.target.value)} /></Field>
          <Field label="Categoria (auto-conta os gastos)"><Select value={catId} onChange={(e) => setCatId(e.target.value)}>
            <option value="">Sem vínculo (manual)</option>
            {categories.filter((c) => c.type === 'expense').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select></Field>
          <Button onClick={addEnv}><Plus className="w-4 h-4" /> Criar</Button>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Reveal i={0}><Card className="py-4 hover-lift"><p className="text-xs text-muted flex items-center gap-1"><Wallet className="w-3 h-3" /> Alocado nos envelopes</p><p className="font-display text-2xl font-bold"><AnimatedValue value={totalLim} format={formatCurrency} /></p></Card></Reveal>
        <Reveal i={1}><Card className="py-4 hover-lift"><p className="text-xs text-muted">Gasto no mês</p><p className="font-display text-2xl font-bold text-rose-500"><AnimatedValue value={totalGasto} format={formatCurrency} /></p></Card></Reveal>
        <Reveal i={2}><Card className="py-4 hover-lift"><p className="text-xs text-muted">Ainda disponível</p><p className={`font-display text-2xl font-bold ${totalLim - totalGasto >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}><AnimatedValue value={totalLim - totalGasto} format={formatCurrency} /></p></Card></Reveal>
      </div>

      {lista.length === 0 ? <Card><EmptyState icon={Mail} title="Nenhum envelope ainda" subtitle="Crie envelopes por categoria para controlar seus gastos do mês." action={importaveis.length > 0 ? <Button onClick={importarDoOrcamento}><Download className="w-4 h-4" /> Importar do Orçamento</Button> : null} /></Card>
        : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {lista.map((e, i) => (
            <Reveal key={e.id} i={Math.min(i, 8)}><Envelope e={e} onRemove={(id) => setEnvs((x) => x.filter((y) => y.id !== id))} onManual={onManual} /></Reveal>
          ))}
        </div>}
      <p className="text-xs text-muted text-center">Envelopes vinculados a uma categoria somam automaticamente seus lançamentos e faturas do mês atual. Dados salvos no seu navegador.</p>
    </div>
  );
}
