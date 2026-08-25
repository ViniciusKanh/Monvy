import { useState, useEffect } from 'react';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Spinner, Input, Button, Badge, EmptyState } from '../components/ui';
import { Reveal } from '../components/Animated.jsx';
import { formatCurrency } from '../lib/utils.js';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { LineChart as LineIcon, TrendingUp, TrendingDown, Search, AlertTriangle, Key } from 'lucide-react';

const POPULARES = ['PETR4', 'VALE3', 'ITUB4', 'BBAS3', 'MGLU3', 'WEGE3', 'HGLG11', 'MXRF11', 'BOVA11', 'KNRI11'];

export default function Stocks() {
  const [ticker, setTicker] = useState('');
  const [token, setToken] = useState(() => { try { return localStorage.getItem('brapi_token') || ''; } catch { return ''; } });
  const [showToken, setShowToken] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { try { localStorage.setItem('brapi_token', token); } catch { /* ignore */ } }, [token]);

  const buscar = async (tk) => {
    const t = (tk || ticker).trim().toUpperCase();
    if (!t) return;
    setLoading(true); setError(''); setData(null);
    try {
      const url = `https://brapi.dev/api/quote/${encodeURIComponent(t)}?range=3mo&interval=1d${token ? `&token=${token}` : ''}`;
      const r = await fetch(url);
      const j = await r.json();
      if (!r.ok || j.error || !j.results?.length) throw new Error(j.message || 'Ativo não encontrado ou limite da API atingido.');
      setData(j.results[0]);
    } catch (e) { setError(e.message || 'Falha ao consultar. Tente novamente.'); }
    finally { setLoading(false); }
  };

  const hist = (data?.historicalDataPrice || []).filter((h) => h.close).map((h) => ({ d: new Date(h.date * 1000).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), close: h.close }));
  const up = (data?.regularMarketChangePercent || 0) >= 0;

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageHeader title={<span className="flex items-center gap-2"><LineIcon className="w-6 h-6 text-emerald-500" /> Ações & FIIs</span>}
        subtitle="Cotação por ticker da B3 (fonte: brapi)" />

      <Card>
        <div className="flex gap-2">
          <Input value={ticker} onChange={(e) => setTicker(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && buscar()} placeholder="Ex: PETR4, HGLG11, VALE3" className="flex-1 uppercase" />
          <Button onClick={() => buscar()} disabled={loading}><Search className="w-4 h-4" /> Buscar</Button>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {POPULARES.map((t) => <button key={t} onClick={() => { setTicker(t); buscar(t); }} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-black/5 dark:bg-white/10 hover:bg-emerald-500/15 hover:text-emerald-600 transition">{t}</button>)}
        </div>
        <button onClick={() => setShowToken((s) => !s)} className="text-xs text-muted mt-3 flex items-center gap-1 hover:text-emerald-500"><Key className="w-3 h-3" /> {token ? 'Token brapi configurado' : 'Adicionar token brapi (opcional, aumenta o limite)'}</button>
        {showToken && <div className="mt-2"><Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Cole seu token gratuito de brapi.dev" className="max-w-md" /><p className="text-[11px] text-muted mt-1">Crie um token grátis em brapi.dev. Fica salvo só no seu navegador.</p></div>}
      </Card>

      {loading && <div className="flex justify-center py-16"><Spinner className="w-8 h-8 text-emerald-500" /></div>}
      {error && <Card className="py-6 text-center text-sm text-muted"><AlertTriangle className="w-7 h-7 mx-auto mb-2 text-amber-500" />{error}</Card>}

      {data && !loading && <>
        <Reveal><div className="rounded-2xl p-5 text-white shadow-lg" style={{ background: up ? 'linear-gradient(135deg,#059669,#0d9488)' : 'linear-gradient(135deg,#e11d48,#be123c)' }}>
          <div className="flex items-center gap-3">
            {data.logourl && <img src={data.logourl} alt="" className="w-11 h-11 rounded-lg bg-white/90 p-1 object-contain" />}
            <div className="min-w-0"><p className="font-bold text-lg">{data.symbol}</p><p className="text-sm opacity-90 truncate">{data.longName || data.shortName}</p></div>
          </div>
          <p className="font-display text-4xl font-extrabold mt-3">{formatCurrency(data.regularMarketPrice)}</p>
          <p className="text-sm opacity-95 mt-1 flex items-center gap-1">{up ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {formatCurrency(data.regularMarketChange)} ({(data.regularMarketChangePercent || 0).toFixed(2)}%) hoje</p>
        </div></Reveal>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[['Abertura', data.regularMarketOpen], ['Máxima', data.regularMarketDayHigh], ['Mínima', data.regularMarketDayLow], ['Fech. anterior', data.regularMarketPreviousClose]].map(([k, v], i) => (
            <Reveal key={k} i={i}><Card className="py-4 hover-lift"><p className="text-xs text-muted">{k}</p><p className="font-display text-lg font-bold">{v != null ? formatCurrency(v) : '—'}</p></Card></Reveal>
          ))}
        </div>

        {hist.length > 1 ? <Card>
          <h3 className="font-semibold mb-2">Últimos 3 meses</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={hist}><defs><linearGradient id="gStock" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={up ? '#10b981' : '#ef4444'} stopOpacity={0.35} /><stop offset="100%" stopColor={up ? '#10b981' : '#ef4444'} stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" /><XAxis dataKey="d" tick={{ fontSize: 9, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} minTickGap={30} /><YAxis width={52} domain={['auto', 'auto']} tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v)} /><Tooltip formatter={(v) => formatCurrency(v)} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} /><Area dataKey="close" stroke={up ? '#10b981' : '#ef4444'} strokeWidth={2.5} fill="url(#gStock)" /></AreaChart>
          </ResponsiveContainer>
        </Card> : <p className="text-xs text-muted text-center">Histórico indisponível no plano gratuito da API. Adicione um token brapi para ver o gráfico.</p>}
      </>}

      {!data && !loading && !error && <Card><EmptyState icon={LineIcon} title="Busque um ativo" subtitle="Digite um ticker da B3 (ação ou FII) ou toque em um dos populares acima." /></Card>}
      <p className="text-xs text-muted text-center">Fonte: brapi.dev · valores de referência com atraso. Não é recomendação de investimento.</p>
    </div>
  );
}
