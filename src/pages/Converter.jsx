import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Spinner, Badge } from '../components/ui';
import { Reveal } from '../components/Animated.jsx';
import { formatCurrency } from '../lib/utils.js';
import { ArrowRightLeft, RefreshCw, AlertTriangle, Globe, TrendingUp, TrendingDown } from 'lucide-react';

const CURRENCIES = [
  { code: 'USD', name: 'Dolar americano', flag: '🇺🇸' },
  { code: 'EUR', name: 'Euro', flag: '🇪🇺' },
  { code: 'GBP', name: 'Libra esterlina', flag: '🇬🇧' },
  { code: 'ARS', name: 'Peso argentino', flag: '🇦🇷' },
  { code: 'JPY', name: 'Iene japones', flag: '🇯🇵' },
  { code: 'CAD', name: 'Dolar canadense', flag: '🇨🇦' },
];
const PAIRS = CURRENCIES.map((c) => `${c.code}-BRL`).join(',');
const QUICK = [100, 500, 1000, 5000];

async function fetchRates() {
  const r = await fetch(`https://economia.awesomeapi.com.br/last/${PAIRS}`);
  if (!r.ok) throw new Error('Falha ao buscar cotacoes');
  return r.json();
}
const fmtBRL = (v) => formatCurrency(v);
const fmtCur = (v, code) => `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: code === 'JPY' ? 0 : 2 }).format(v)} ${code}`;

export default function Converter() {
  const { data, isLoading, isError, isFetching, refetch } = useQuery({ queryKey: ['fx-rates'], queryFn: fetchRates, retry: 1, staleTime: 60_000, refetchInterval: 120_000 });
  const [amount, setAmount] = useState('1000');
  const [code, setCode] = useState('USD');
  const [dir, setDir] = useState('fromBRL'); // fromBRL: BRL -> moeda | toBRL: moeda -> BRL

  const rates = data || {};
  const rateOf = (c) => Number((rates[`${c}BRL`] || {}).bid) || 0; // 1 [c] = x BRL
  const pctOf = (c) => Number((rates[`${c}BRL`] || {}).pctChange) || 0;
  const rate = rateOf(code);
  const cur = CURRENCIES.find((c) => c.code === code);
  const amt = Number(String(amount).replace(',', '.')) || 0;

  const result = useMemo(() => {
    if (!rate) return 0;
    return dir === 'fromBRL' ? amt / rate : amt * rate;
  }, [amt, rate, dir]);

  const fromLabel = dir === 'fromBRL' ? 'BRL' : code;
  const toLabel = dir === 'fromBRL' ? code : 'BRL';
  const fromText = dir === 'fromBRL' ? fmtBRL(amt) : fmtCur(amt, code);
  const toText = dir === 'fromBRL' ? fmtCur(result, code) : fmtBRL(result);

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageHeader
        title={<span className="flex items-center gap-2"><ArrowRightLeft className="w-6 h-6 text-indigo-500" /> Conversor de Moedas</span>}
        subtitle="Cotação do dia para compras internacionais e viagens"
        actions={<button onClick={() => refetch()} className="p-2.5 rounded-xl card hover:bg-black/5 dark:hover:bg-white/10" title="Atualizar"><RefreshCw className={`w-5 h-5 ${isFetching ? 'animate-spin' : ''}`} /></button>}
      />

      {isError ? (
        <Card className="py-8 text-center text-sm text-muted"><AlertTriangle className="w-7 h-7 mx-auto mb-2 text-amber-500" />Nao foi possível carregar as cotacoes. Verifique a conexao e tente atualizar.</Card>
      ) : (
        <div className="grid lg:grid-cols-5 gap-5">
          {/* Conversor */}
          <div className="lg:col-span-3">
            <div className="relative overflow-hidden rounded-3xl p-6 text-white shadow-soft" style={{ background: 'linear-gradient(140deg,#0b1330 0%,#1e1b4b 60%,#312e81 100%)' }}>
              <div className="absolute -top-20 -right-16 w-72 h-72 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(99,102,241,.35), transparent 70%)' }} />
              <div className="relative">
                <div className="flex items-center gap-2 text-[11px] tracking-[0.28em] text-indigo-200 font-medium"><Globe className="w-3.5 h-3.5" /> CONVERSAO</div>

                {/* De */}
                <div className="mt-4">
                  <label className="text-xs text-indigo-200">{dir === 'fromBRL' ? 'Tenho em Reais' : `Tenho em ${cur?.name}`}</label>
                  <div className="flex items-center gap-3 mt-1">
                    <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="flex-1 bg-transparent text-3xl font-bold outline-none placeholder-white/30 min-w-0" placeholder="0,00" />
                    <span className="shrink-0 px-3 py-1.5 rounded-xl bg-white/10 font-semibold">{dir === 'fromBRL' ? '🇧🇷 BRL' : `${cur?.flag} ${code}`}</span>
                  </div>
                </div>

                <div className="flex justify-center my-3">
                  <button onClick={() => setDir((d) => (d === 'fromBRL' ? 'toBRL' : 'fromBRL'))} className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 transition flex items-center justify-center" title="Inverter"><ArrowRightLeft className="w-4 h-4 rotate-90" /></button>
                </div>

                {/* Para */}
                <div className="rounded-2xl bg-white/[0.08] border border-white/10 p-4">
                  <label className="text-xs text-indigo-200">{dir === 'fromBRL' ? `Recebo em ${cur?.name}` : 'Recebo em Reais'}</label>
                  <div className="flex items-center justify-between gap-3 mt-1">
                    <span className="text-3xl font-extrabold">{isLoading ? <Spinner className="w-5 h-5" /> : toText.split(' ')[0]}</span>
                    <span className="shrink-0 px-3 py-1.5 rounded-xl bg-white/10 font-semibold">{dir === 'fromBRL' ? `${cur?.flag} ${code}` : '🇧🇷 BRL'}</span>
                  </div>
                </div>

                <p className="text-xs text-indigo-200 mt-3">{rate > 0 ? `1 ${code} = ${fmtBRL(rate)} · ${fromText} = ${toText}` : 'Carregando cotacao...'}</p>

                <div className="flex flex-wrap gap-2 mt-3">
                  {QUICK.map((q) => (<button key={q} onClick={() => setAmount(String(q))} className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-medium transition">{dir === 'fromBRL' ? fmtBRL(q) : `${q} ${code}`}</button>))}
                </div>
              </div>
            </div>

            {/* Seletor de moeda */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
              {CURRENCIES.map((c) => (
                <button key={c.code} onClick={() => setCode(c.code)} className={`p-3 rounded-xl border-2 text-left transition hover-lift ${code === c.code ? 'border-indigo-500 bg-indigo-500/10' : 'border-[hsl(var(--border))] hover:bg-black/5 dark:hover:bg-white/5'}`}>
                  <div className="flex items-center gap-2"><span className="text-xl">{c.flag}</span><div className="min-w-0"><p className="font-semibold text-sm">{c.code}</p><p className="text-[11px] text-muted truncate">{c.name}</p></div></div>
                </button>
              ))}
            </div>
          </div>

          {/* Cotações do dia */}
          <Card className="lg:col-span-2 hover-lift">
            <h3 className="font-semibold mb-3">Cotações de hoje</h3>
            <div className="space-y-1.5">
              {CURRENCIES.map((c, i) => { const r = rateOf(c.code); const p = pctOf(c.code); return (
                <Reveal key={c.code} i={i}>
                  <button onClick={() => setCode(c.code)} className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition text-left">
                    <span className="text-xl">{c.flag}</span>
                    <div className="flex-1 min-w-0"><p className="font-semibold text-sm">{c.code}</p><p className="text-[11px] text-muted truncate">{c.name}</p></div>
                    <div className="text-right">
                      <p className="font-semibold">{isLoading ? '—' : fmtBRL(r)}</p>
                      {isFinite(p) && <p className={`text-[11px] flex items-center justify-end gap-0.5 ${p >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{p >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}{Math.abs(p).toFixed(2)}%</p>}
                    </div>
                  </button>
                </Reveal>
              ); })}
            </div>
            <p className="text-xs text-muted mt-3 text-center">Fonte: AwesomeAPI · valores de referência</p>
          </Card>
        </div>
      )}
    </div>
  );
}
