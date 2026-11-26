import { useEffect, useMemo, useRef, useState } from 'react';
import { Select, Spinner } from '../components/ui';
import { HeroTitle, Panel, DeltaChip, TIP } from '../components/kit.jsx';
import { CarArt } from '../components/art/PageArt.jsx';
import { toast } from '../lib/toast.js';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Car, Bike, Truck, Database, Zap, BarChart3, Star, Fuel, Settings2, Gauge, DoorOpen, Info, CalendarDays, RefreshCw, Tag, Layers, Bookmark, Share2, LineChart as LineIcon, Trash2, Search } from 'lucide-react';

const API = 'https://fipe.parallelum.com.br/api/v2';
const TIPOS = [{ v: 'cars', label: 'Carros', icon: Car, cat: 'Automóvel' }, { v: 'motorcycles', label: 'Motos', icon: Bike, cat: 'Motocicleta' }, { v: 'trucks', label: 'Caminhões', icon: Truck, cat: 'Caminhão / utilitário' }];
const LS_SAVED = 'monvy_fipe_saved_v1';
const lsGet = () => { try { return JSON.parse(localStorage.getItem(LS_SAVED) || '[]'); } catch { return []; } };
const lsSet = (v) => { try { localStorage.setItem(LS_SAVED, JSON.stringify(v)); } catch { /* */ } };
const priceNum = (s) => Number(String(s || '').replace(/[^\d,]/g, '').replace(',', '.')) || 0;
const MES = { janeiro: 'Jan', fevereiro: 'Fev', 'março': 'Mar', marco: 'Mar', abril: 'Abr', maio: 'Mai', junho: 'Jun', julho: 'Jul', agosto: 'Ago', setembro: 'Set', outubro: 'Out', novembro: 'Nov', dezembro: 'Dez' };
const shortRef = (m) => { const [mes, ano] = String(m || '').trim().split(/\s+de\s+|\//); return mes ? `${MES[mes.toLowerCase()] || mes.slice(0, 3)}/${String(ano || '').slice(-4)}` : ''; };

async function getJson(url) { const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 10000); try { const r = await fetch(url, { signal: ctrl.signal }); if (!r.ok) throw new Error('http ' + r.status); return await r.json(); } finally { clearTimeout(to); } }

// detalhes que dá para tirar do nome da versão na FIPE (só quando aparecem nele)
function specsOf(name = '', fuel = '') {
  const s = String(name);
  return {
    fuel: /flex/i.test(s) ? 'Flex' : fuel || ( /diesel/i.test(s) ? 'Diesel' : /el[eé]tr/i.test(s) ? 'Elétrico' : /h[ií]brid/i.test(s) ? 'Híbrido' : '—'),
    cambio: /\b(aut|autom|at|cvt|dsg|tiptronic|i-?motion|steptronic)\b/i.test(s) ? 'Automático' : /\b(mec|manual|mt)\b/i.test(s) ? 'Manual' : '—',
    motor: (s.match(/\b(\d\.\d)\b/) || [])[1] || '—',
    portas: (s.match(/\b(\d)\s?p(?:ortas)?\b/i) || [])[1] || '—',
  };
}

export default function Fipe() {
  const [tipo, setTipo] = useState('cars');
  const [brands, setBrands] = useState([]); const [brand, setBrand] = useState('');
  const [models, setModels] = useState([]); const [model, setModel] = useState('');
  const [years, setYears] = useState([]); const [year, setYear] = useState('');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState({ status: 'idle', points: [] });
  const [siblings, setSiblings] = useState([]);
  const [refs, setRefs] = useState([]);
  const [loading, setLoading] = useState({}); const [err, setErr] = useState('');
  const [saved, setSaved] = useState(lsGet);
  const busy = (k, v) => setLoading((l) => ({ ...l, [k]: v }));
  const pending = useRef(null);

  useEffect(() => { getJson(`${API}/references`).then((r) => setRefs(Array.isArray(r) ? r : [])).catch(() => setRefs([])); }, []);
  const loadBrands = async (t) => { setErr(''); setBrands([]); busy('b', true); try { const b = await getJson(`${API}/${t}/brands`); if (!Array.isArray(b)) throw new Error('fmt'); setBrands(b); return b; } catch { setErr('Não consegui carregar as marcas da FIPE agora.'); return []; } finally { busy('b', false); } };
  useEffect(() => {
    setBrand(''); setModels([]); setModel(''); setYears([]); setYear(''); setResult(null);
    loadBrands(tipo).then(() => { const s = pending.current; if (s && s.tipo === tipo) { pending.current = null; applySaved(s); } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo]);

  const pickBrand = async (id, t = tipo) => { setBrand(id); setModels([]); setModel(''); setYears([]); setYear(''); setResult(null); if (!id) return []; busy('m', true); try { const m = await getJson(`${API}/${t}/brands/${id}/models`); const ml = Array.isArray(m) ? m : (m?.modelos || []); setModels(ml); return ml; } catch { setErr('Falha ao carregar os modelos.'); return []; } finally { busy('m', false); } };
  const pickModel = async (id, b = brand, t = tipo) => { setModel(id); setYears([]); setYear(''); setResult(null); if (!id) return []; busy('y', true); try { const y = await getJson(`${API}/${t}/brands/${b}/models/${id}/years`); const yl = Array.isArray(y) ? y : []; setYears(yl); return yl; } catch { setErr('Falha ao carregar os anos.'); return []; } finally { busy('y', false); } };
  const pickYear = async (id, m = model, b = brand, t = tipo, modelList = models) => {
    setYear(id); setResult(null); setHistory({ status: 'idle', points: [] }); setSiblings([]); if (!id) return;
    busy('r', true); setErr('');
    try {
      const res = await getJson(`${API}/${t}/brands/${b}/models/${m}/years/${id}`);
      setResult(res);
      loadHistory(t, b, m, id);
      loadSiblings(t, b, m, id, res.model, modelList);
    } catch { setErr('Falha ao consultar o valor na FIPE.'); } finally { busy('r', false); }
  };

  // série histórica: o mesmo veículo consultado em tabelas de referência anteriores
  const loadHistory = async (t, b, m, y) => {
    let list = refs; if (!list.length) { try { list = await getJson(`${API}/references`); setRefs(list); } catch { list = []; } }
    if (!list.length) { setHistory({ status: 'fail', points: [] }); return; }
    const sorted = [...list].sort((a, c) => Number(c.code) - Number(a.code));
    const picks = [0, 1, 2, 3, 5, 8, 11].map((i) => sorted[i]).filter(Boolean);
    setHistory({ status: 'loading', points: [] });
    const out = await Promise.allSettled(picks.map((r) => getJson(`${API}/${t}/brands/${b}/models/${m}/years/${y}?reference=${r.code}`).then((x) => ({ ref: r.month, v: priceNum(x.price) }))));
    const points = out.filter((o) => o.status === 'fulfilled' && o.value.v > 0).map((o) => ({ name: shortRef(o.value.ref), v: o.value.v })).reverse();
    setHistory({ status: points.length > 1 ? 'ok' : 'fail', points });
  };
  // outras versões do mesmo modelo (mesmo nome-base), no mesmo ano
  const loadSiblings = async (t, b, m, y, name, modelList) => {
    const base = String(name || '').split(/\s+/)[0].toLowerCase();
    const sib = (modelList || []).filter((x) => String(x.code) !== String(m) && String(x.name).split(/\s+/)[0].toLowerCase() === base).slice(0, 5);
    setSiblings(sib.map((x) => ({ ...x, status: 'loading' })));
    const out = await Promise.allSettled(sib.map((x) => getJson(`${API}/${t}/brands/${b}/models/${x.code}/years/${y}`)));
    setSiblings(sib.map((x, i) => (out[i].status === 'fulfilled' ? { ...x, status: 'ok', price: out[i].value.price, fuel: out[i].value.fuel } : { ...x, status: 'na' })));
  };

  const saveQuery = () => {
    if (!result) return;
    const item = { tipo, brand, model, year, label: `${result.brand} ${result.model} ${result.modelYear}`, price: result.price, ref: result.referenceMonth, at: Date.now() };
    const next = [item, ...saved.filter((s) => !(s.brand === brand && s.model === model && s.year === year && s.tipo === tipo))].slice(0, 12);
    setSaved(next); lsSet(next); toast.success('Consulta salva neste navegador.');
  };
  const applySaved = async (s) => { const ml = await pickBrand(s.brand, s.tipo); await pickModel(s.model, s.brand, s.tipo); await pickYear(s.year, s.model, s.brand, s.tipo, ml); };
  const loadSaved = (s) => { if (s.tipo !== tipo) { pending.current = s; setTipo(s.tipo); } else applySaved(s); };
  const share = async () => {
    if (!result) return;
    const text = `${result.brand} ${result.model} (${result.modelYear}) — FIPE ${result.price} · ref. ${result.referenceMonth} · código ${result.codeFipe}`;
    try { if (navigator.share) await navigator.share({ title: 'Tabela FIPE', text }); else { await navigator.clipboard.writeText(text); toast.success('Resumo copiado.'); } } catch { /* cancelado */ }
  };

  const T = TIPOS.find((x) => x.v === tipo);
  const sp = specsOf(result?.model, result?.fuel);
  const pts = history.points;
  const delta = pts.length >= 2 && pts[pts.length - 2].v ? ((pts[pts.length - 1].v - pts[pts.length - 2].v) / pts[pts.length - 2].v) * 100 : null;
  const yearLabel = useMemo(() => years.find((y) => String(y.code) === String(year))?.name || result?.modelYear, [years, year, result]);
  const refMonth = refs.length ? [...refs].sort((a, b) => Number(b.code) - Number(a.code))[0].month : result?.referenceMonth;

  return (
    <div className="space-y-5 animate-fadeIn">
      <HeroTitle icon={Car} lead="Tabela" accent="FIPE" iconClass="text-sky-400" subtitle="Consulte o valor de mercado de carros, motos e caminhões (fonte: FIPE)." art={<CarArt className="w-[26rem] h-40 opacity-90" />} />
      <div className="flex flex-wrap gap-2 -mt-1">
        {[[Database, 'Consulta oficial', 'Fonte: FIPE', '#34d399'], [Zap, 'Atualização mensal', refMonth ? `Referência: ${shortRef(refMonth)}` : 'Tabela do mês', '#22d3ee'], [BarChart3, 'Série histórica', 'Últimos 12 meses', '#38bdf8'], [Star, 'Detalhes da versão', 'Combustível, câmbio e mais', '#c084fc']].map(([Ic, l, d, c]) => (
          <span key={l} className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl ring-1 ring-[hsl(var(--border))] bg-[hsl(var(--card))]"><Ic className="w-5 h-5" style={{ color: c }} /><span className="leading-tight"><b className="text-xs block">{l}</b><span className="text-[11px] text-muted">{d}</span></span></span>
        ))}
      </div>

      <section className="rounded-3xl bg-[hsl(var(--card))] ring-1 ring-sky-400/30 shadow-soft p-4 sm:p-5">
        <div className="flex flex-wrap gap-2 mb-4">
          {TIPOS.map((t) => { const Ic = t.icon; const on = tipo === t.v; return <button key={t.v} onClick={() => setTipo(t.v)} className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-sm font-semibold ring-1 transition ${on ? 'bg-sky-500 text-white ring-sky-400 shadow-[0_0_16px_rgba(56,189,248,.45)]' : 'ring-[hsl(var(--border))] text-muted hover:text-[hsl(var(--text))]'}`}><Ic className="w-4 h-4" />{t.label}</button>; })}
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div><label className="text-sm font-semibold">Marca</label><Select value={brand} onChange={(e) => pickBrand(e.target.value)} disabled={loading.b} className="mt-1"><option value="">{loading.b ? 'Carregando…' : 'Selecione a marca'}</option>{brands.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}</Select></div>
          <div><label className="text-sm font-semibold">Modelo</label><Select value={model} onChange={(e) => pickModel(e.target.value)} disabled={!brand || loading.m} className="mt-1"><option value="">{loading.m ? 'Carregando…' : 'Selecione o modelo'}</option>{models.map((m) => <option key={m.code} value={m.code}>{m.name}</option>)}</Select></div>
          <div><label className="text-sm font-semibold">Ano</label><Select value={year} onChange={(e) => pickYear(e.target.value)} disabled={!model || loading.y} className="mt-1"><option value="">{loading.y ? 'Carregando…' : 'Selecione o ano'}</option>{years.map((y) => <option key={y.code} value={y.code}>{y.name}</option>)}</Select></div>
        </div>
        {err && <p className="text-sm text-rose-500 mt-3 flex items-center gap-2">{err}<button onClick={() => loadBrands(tipo)} className="inline-flex items-center gap-1 text-xs underline"><RefreshCw className="w-3 h-3" />tentar de novo</button></p>}
        {saved.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted flex items-center gap-1"><Bookmark className="w-3.5 h-3.5" />Salvas:</span>
            {saved.map((s) => <span key={s.at} className="inline-flex items-center gap-1 rounded-lg ring-1 ring-[hsl(var(--border))] pl-2.5 pr-1 py-1"><button onClick={() => loadSaved(s)} className="hover:underline">{s.label} · <b>{s.price}</b></button><button onClick={() => { const n = saved.filter((x) => x.at !== s.at); setSaved(n); lsSet(n); }} className="p-0.5 text-muted hover:text-rose-500" aria-label="Remover"><Trash2 className="w-3 h-3" /></button></span>)}
          </div>
        )}
      </section>

      {loading.r && <div className="flex justify-center py-10"><Spinner className="w-7 h-7 text-sky-500" /></div>}

      {!result && !loading.r && (
        <section className="rounded-3xl ring-1 ring-dashed ring-[hsl(var(--border))] p-10 text-center"><Search className="w-10 h-10 mx-auto text-sky-400" /><p className="font-semibold mt-2">Consulte um veículo</p><p className="text-sm text-muted">Escolha tipo, marca, modelo e ano para ver o valor FIPE, a evolução dos últimos meses e outras versões.</p></section>
      )}

      {result && !loading.r && (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <section className="xl:col-span-7 relative overflow-hidden rounded-3xl ring-1 ring-violet-400/50 shadow-[0_0_40px_-14px_rgba(139,92,246,.6)] bg-[hsl(var(--card))] p-5 grid sm:grid-cols-[1fr_1.2fr] gap-4" style={{ backgroundImage: 'radial-gradient(70% 120% at 0% 100%,rgba(14,165,233,.22),transparent),radial-gradient(70% 120% at 100% 0%,rgba(168,85,247,.28),transparent)' }}>
              <div className="flex flex-col items-center justify-center"><T.icon className="w-10 h-10 text-sky-300 self-start" /><CarArt className="w-full h-36" /></div>
              <div className="min-w-0 sm:pl-5 sm:border-l border-[hsl(var(--border))]">
                <p className="text-[11px] tracking-[0.3em] font-bold text-muted uppercase">{result.brand}</p>
                <div className="flex items-start justify-between gap-2"><h2 className="font-display text-2xl font-extrabold leading-tight">{result.model}</h2><span className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full bg-black/10 dark:bg-white/10">Ano {yearLabel}</span></div>
                <div className="mt-4 flex items-end justify-between gap-3 flex-wrap">
                  <div><p className="text-sm font-semibold flex items-center gap-1">Valor FIPE <Info className="w-3.5 h-3.5 text-muted" title="Preço médio de mercado pesquisado pela FIPE" /></p><p className="font-display text-4xl font-black">{result.price}</p></div>
                  {delta != null && <div className="rounded-xl ring-1 ring-emerald-400/40 bg-emerald-500/10 px-3 py-1.5 text-center"><DeltaChip v={delta} /><p className="text-[10px] text-muted mt-0.5">vs. {pts[pts.length - 2].name}</p></div>}
                </div>
                <div className="mt-4 pt-3 border-t border-[hsl(var(--border))] grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
                  {[[Fuel, 'Combustível', sp.fuel], [Settings2, 'Câmbio', sp.cambio], [Gauge, 'Motor', sp.motor], [DoorOpen, 'Portas', sp.portas]].map(([Ic, k, v]) => <div key={k} className="flex items-start gap-1.5"><Ic className="w-4 h-4 text-sky-400 shrink-0" /><div><p className="text-muted">{k}</p><b className="text-sm">{v}</b></div></div>)}
                </div>
              </div>
            </section>
            <Panel className="xl:col-span-5" tone="emerald" title="Evolução do valor FIPE" icon={LineIcon} iconClass="text-emerald-400" subtitle="Mesmo veículo nas tabelas de referência anteriores">
              {history.status === 'loading' ? <div className="h-[220px] grid place-items-center"><Spinner className="w-6 h-6 text-emerald-500" /></div>
                : history.status !== 'ok' ? <p className="h-[220px] grid place-items-center text-sm text-muted text-center px-6">Não consegui montar o histórico deste veículo agora (a API pública limita as consultas).</p>
                : (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={pts} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs><linearGradient id="fipeG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399" stopOpacity={0.4} /><stop offset="100%" stopColor="#34d399" stopOpacity={0.02} /></linearGradient></defs>
                      <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} />
                      <YAxis width={58} domain={['auto', 'auto']} tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v) => [v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 'FIPE']} contentStyle={TIP} />
                      <Area dataKey="v" stroke="#34d399" strokeWidth={2.5} fill="url(#fipeG)" dot={{ r: 3, fill: '#34d399' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
            </Panel>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <Panel className="xl:col-span-7" tone="sky" title={`Outras versões do ${String(result.model).split(/\s+/)[0]} (${yearLabel})`} icon={T.icon} iconClass="text-sky-400">
              <div className="overflow-x-auto"><table className="w-full text-sm min-w-[520px]">
                <thead><tr className="text-left text-xs text-muted border-b border-[hsl(var(--border))]"><th className="py-2 w-8" /><th className="py-2 font-medium">Versão</th><th className="py-2 font-medium">Combustível</th><th className="py-2 font-medium">Câmbio</th><th className="py-2 font-medium text-right">Valor FIPE</th></tr></thead>
                <tbody>
                  <tr className="ring-1 ring-sky-400 rounded-xl bg-sky-500/10"><td className="py-2.5 pl-2"><span className="block w-4 h-4 rounded-full ring-4 ring-sky-400/40 bg-sky-400" /></td><td className="py-2.5 font-semibold">{result.model}</td><td>{sp.fuel}</td><td>{sp.cambio}</td><td className="text-right font-bold pr-2">{result.price}</td></tr>
                  {siblings.map((s) => { const ss = specsOf(s.name, s.fuel); return (
                    <tr key={s.code} className="border-b border-[hsl(var(--border))] last:border-0 hover:bg-black/[.03] dark:hover:bg-white/[.03] cursor-pointer" onClick={() => pickModel(s.code).then((ys) => { if (ys.some((y) => String(y.code) === String(year))) pickYear(year, s.code); })}>
                      <td className="py-2.5 pl-2"><span className="block w-4 h-4 rounded-full ring-1 ring-[hsl(var(--border))]" /></td><td className="py-2.5">{s.name}</td><td>{ss.fuel}</td><td>{ss.cambio}</td>
                      <td className="text-right font-semibold pr-2">{s.status === 'loading' ? <Spinner className="w-3.5 h-3.5 inline" /> : s.status === 'ok' ? s.price : <span className="text-xs text-muted">sem este ano</span>}</td>
                    </tr>); })}
                  {siblings.length === 0 && <tr><td colSpan={5} className="py-3 text-sm text-muted">Não há outras versões com o mesmo nome nesta marca.</td></tr>}
                </tbody>
              </table></div>
            </Panel>
            <Panel className="xl:col-span-5" tone="violet" title="Informações da consulta" icon={Info} iconClass="text-sky-400">
              <dl className="grid sm:grid-cols-2 gap-x-6 text-sm">
                {[[CalendarDays, 'Referência FIPE', result.referenceMonth], [Tag, 'Marca', result.brand], [RefreshCw, 'Código FIPE', result.codeFipe], [Layers, 'Modelo', String(result.model).split(/\s+/)[0]], [T.icon, 'Categoria', T.cat], [CalendarDays, 'Ano modelo', result.modelYear]].map(([Ic, k, v]) => (
                  <div key={k} className="flex items-center gap-2 py-2.5 border-b border-[hsl(var(--border))]"><Ic className="w-4 h-4 text-muted shrink-0" /><dt className="text-muted flex-1">{k}</dt><dd className="font-semibold text-right">{v}</dd></div>
                ))}
              </dl>
            </Panel>
          </div>

          <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
            <p className="flex-1 rounded-xl ring-1 ring-sky-400/40 bg-sky-500/5 px-4 py-2.5 text-xs flex items-center gap-2"><Info className="w-4 h-4 text-sky-400 shrink-0" />Os valores da Tabela FIPE são referências de mercado e podem variar conforme região, estado de conservação, versão e itens opcionais do veículo.</p>
            <button onClick={saveQuery} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold ring-1 ring-[hsl(var(--border))] hover:bg-black/5 dark:hover:bg-white/10"><Bookmark className="w-4 h-4" />Salvar consulta</button>
            <button onClick={share} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold ring-1 ring-[hsl(var(--border))] hover:bg-black/5 dark:hover:bg-white/10"><Share2 className="w-4 h-4" />Compartilhar</button>
          </div>
        </>
      )}
    </div>
  );
}
