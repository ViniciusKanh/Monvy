import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Spinner, Badge } from '../components/ui';
import { Reveal } from '../components/Animated.jsx';
import { formatCurrency } from '../lib/utils.js';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Landmark, Percent, TrendingUp, Wallet, PiggyBank, RefreshCw, AlertTriangle } from 'lucide-react';

const SGS = (code, n = 1) => `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados/ultimos/${n}?formato=json`;
const last = (a) => (a && a.length ? Number(a[a.length - 1].valor) : 0);

async function fetchIndicators() {
  const [selic, cdi, ipca12, minimo] = await Promise.all([
    fetch(SGS(432, 1)).then((r) => r.json()),
    fetch(SGS(4389, 1)).then((r) => r.json()),
    fetch(SGS(433, 12)).then((r) => r.json()),
    fetch(SGS(1619, 1)).then((r) => r.json()),
  ]);
  const selicAA = last(selic), cdiAA = last(cdi), salarioMin = last(minimo);
  const ipcaMes = last(ipca12);
  const ipcaAcum = (ipca12 || []).reduce((acc, x) => acc * (1 + Number(x.valor) / 100), 1);
  const ipca12m = (ipcaAcum - 1) * 100;
  const ipcaSerie = (ipca12 || []).map((x) => ({ mes: x.data.slice(3), valor: Number(x.valor) }));
  // Poupança: Selic > 8.5% => 0,5% a.m. + TR (~6,17% a.a.); senão 70% da Selic
  const poupAA = selicAA > 8.5 ? 6.17 : selicAA * 0.7;
  return { selicAA, cdiAA, ipcaMes, ipca12m, salarioMin, poupAA, ipcaSerie };
}

const pct = (v) => `${v.toFixed(2).replace('.', ',')}%`;

export default function EconIndicators() {
  const { data, isLoading, isError, isFetching, refetch } = useQuery({ queryKey: ['econ-indicators'], queryFn: fetchIndicators, retry: 1, staleTime: 3600_000 });

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageHeader title={<span className="flex items-center gap-2"><Landmark className="w-6 h-6 text-emerald-500" /> Indicadores Econômicos</span>}
        subtitle="Selic, CDI, IPCA, poupança e salário mínimo — direto do Banco Central"
        actions={<button onClick={() => refetch()} className="p-2.5 rounded-xl card hover:bg-black/5 dark:hover:bg-white/10" title="Atualizar"><RefreshCw className={`w-5 h-5 ${isFetching ? 'animate-spin' : ''}`} /></button>} />

      {isLoading ? <div className="flex justify-center py-24"><Spinner className="w-8 h-8 text-emerald-500" /></div>
        : isError ? <Card className="py-8 text-center text-sm text-muted"><AlertTriangle className="w-7 h-7 mx-auto mb-2 text-amber-500" />Não foi possível carregar os indicadores. Tente atualizar.</Card>
        : <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { k: 'Taxa Selic (meta)', v: pct(data.selicAA), sub: 'ao ano', icon: Percent, color: '#6366f1' },
              { k: 'CDI', v: pct(data.cdiAA), sub: 'ao ano', icon: TrendingUp, color: '#10b981' },
              { k: 'IPCA (12 meses)', v: pct(data.ipca12m), sub: `mês: ${pct(data.ipcaMes)}`, icon: TrendingUp, color: '#f59e0b' },
              { k: 'Poupança', v: pct(data.poupAA), sub: 'estimada ao ano', icon: PiggyBank, color: '#06b6d4' },
              { k: 'Salário mínimo', v: formatCurrency(data.salarioMin), sub: 'vigente', icon: Wallet, color: '#8b5cf6' },
              { k: 'CDI ao mês', v: pct((Math.pow(1 + data.cdiAA / 100, 1 / 12) - 1) * 100), sub: 'equivalente', icon: Percent, color: '#ec4899' },
            ].map((it, i) => (
              <Reveal key={it.k} i={i}><Card className="hover-lift">
                <div className="flex items-center gap-2"><span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: it.color + '22', color: it.color }}><it.icon className="w-4 h-4" /></span>
                  <p className="text-xs text-muted">{it.k}</p></div>
                <p className="font-display text-2xl font-bold mt-2" style={{ color: it.color }}>{it.v}</p>
                <p className="text-xs text-muted">{it.sub}</p>
              </Card></Reveal>
            ))}
          </div>

          <Card>
            <h3 className="font-semibold mb-2 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-amber-500" /> IPCA mês a mês (12 meses)</h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data.ipcaSerie}><CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" /><XAxis dataKey="mes" tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} /><YAxis width={40} tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} /><Tooltip formatter={(v) => pct(Number(v))} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} /><Line dataKey="valor" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 2 }} /></LineChart>
            </ResponsiveContainer>
          </Card>

          <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-sm">
            <PiggyBank className="w-4 h-4 mt-0.5 shrink-0" /> Com a Selic em {pct(data.selicAA)}, um CDB a 100% do CDI rende ~{pct(data.cdiAA)} a.a. (antes do IR), enquanto a poupança rende ~{pct(data.poupAA)} a.a. Veja a comparação na tela <b>Poupança × CDB</b>.
          </div>
          <p className="text-xs text-muted text-center">Fonte: Banco Central do Brasil (SGS). Valores de referência, sujeitos a atualização.</p>
        </>}
    </div>
  );
}
