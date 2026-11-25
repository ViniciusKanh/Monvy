import { useMemo, useState, useEffect, useRef } from 'react';
import { Input, Select } from '../components/ui';
import { HeroTitle, Panel, Donut, Bar, GlowButton, InsightsPanel, pct1 } from '../components/kit.jsx';
import { HouseArt, CoinHouseArt } from '../components/art/PageArt.jsx';
import { formatCurrency, monthLabel, monthKey } from '../lib/utils.js';
import {
  Users, Plus, Trash2, Scale, Layers, Calculator, ChevronRight, LineChart as LineIcon, Coins, Wallet, ArrowRightLeft, Info, Home, ShoppingCart, Wifi, Zap, Droplet, Flame,
  Building2, Receipt, Car, Tv, BarChart3, TrendingUp, CalendarDays, Lightbulb, CheckCircle2, AlertTriangle, ArrowRight, User,
} from 'lucide-react';

const n = (v) => { const x = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(x) ? x : 0; };
const KEY = 'monvy_household_v2';
const uid = () => Math.random().toString(36).slice(2, 9);
const COLORS = ['#22d3ee', '#a855f7', '#ec4899', '#f59e0b', '#34d399', '#38bdf8'];
const AVA = ['from-cyan-400 to-sky-600', 'from-violet-500 to-fuchsia-600', 'from-pink-500 to-rose-600', 'from-amber-400 to-orange-600', 'from-emerald-400 to-teal-600', 'from-sky-400 to-indigo-600'];
const ICONS = [[/alug|moradia|aluguel|prestac/i, Home], [/mercad|super|feira|compra/i, ShoppingCart], [/internet|wi-?fi|fibra/i, Wifi], [/luz|energia|eletric/i, Zap], [/agua|água|sabesp|saneam/i, Droplet], [/gás|gas\b|botij/i, Flame], [/condom/i, Building2], [/carro|combust|uber|transp/i, Car], [/stream|netflix|tv|assin/i, Tv]];
const iconFor = (d) => (ICONS.find(([re]) => re.test(d || '')) || [null, Receipt])[1];

export default function HouseholdSplit() {
  const saved = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } })();
  const [modo, setModo] = useState(saved.modo || 'igual');
  const [pessoas, setPessoas] = useState(saved.pessoas?.length ? saved.pessoas : [{ id: uid(), nome: 'Você', renda: '3000' }, { id: uid(), nome: 'Parceiro(a)', renda: '2000' }]);
  const [despesas, setDespesas] = useState(saved.despesas?.length ? saved.despesas : [{ id: uid(), desc: 'Aluguel', valor: '1500', quem: '' }, { id: uid(), desc: 'Mercado', valor: '900', quem: '' }]);
  const refs = [useRef(null), useRef(null), useRef(null)];

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify({ modo, pessoas, despesas })); } catch { /* ignore */ } }, [modo, pessoas, despesas]);
  const updP = (id, campo, val) => setPessoas((p) => p.map((x) => (x.id === id ? { ...x, [campo]: val } : x)));
  const updD = (id, campo, val) => setDespesas((d) => d.map((x) => (x.id === id ? { ...x, [campo]: val } : x)));

  const r = useMemo(() => {
    const total = despesas.reduce((s, d) => s + n(d.valor), 0);
    const totalRenda = pessoas.reduce((s, p) => s + n(p.renda), 0);
    const nP = pessoas.length || 1;
    const linhas = pessoas.map((p, k) => {
      const peso = modo === 'renda' ? (totalRenda > 0 ? n(p.renda) / totalRenda : 1 / nP) : 1 / nP;
      const justo = total * peso;
      const pagou = despesas.filter((d) => d.quem === p.id).reduce((s, d) => s + n(d.valor), 0);
      return { id: p.id, nome: p.nome || `Pessoa ${k + 1}`, renda: n(p.renda), peso, justo, pagou, saldo: pagou - justo, color: COLORS[k % COLORS.length], ava: AVA[k % AVA.length] };
    });
    const dv = linhas.filter((l) => l.saldo < -0.01).map((l) => ({ nome: l.nome, v: -l.saldo })).sort((a, b) => b.v - a.v);
    const cr = linhas.filter((l) => l.saldo > 0.01).map((l) => ({ nome: l.nome, v: l.saldo })).sort((a, b) => b.v - a.v);
    const acertos = []; let i = 0, j = 0;
    while (i < dv.length && j < cr.length) { const m = Math.min(dv[i].v, cr[j].v); if (m > 0.01) acertos.push({ de: dv[i].nome, para: cr[j].nome, valor: m }); dv[i].v -= m; cr[j].v -= m; if (dv[i].v < 0.01) i++; if (cr[j].v < 0.01) j++; }
    const semDono = despesas.filter((d) => n(d.valor) > 0 && !d.quem).length;
    const maior = [...despesas].sort((a, b) => n(b.valor) - n(a.valor))[0];
    return { total, totalRenda, linhas, acertos, semDono, maior };
  }, [pessoas, despesas, modo]);

  const stepsDone = [pessoas.length >= 2 && pessoas.every((p) => String(p.nome).trim()), despesas.some((d) => n(d.valor) > 0), despesas.some((d) => n(d.valor) > 0) && r.semDono === 0];
  const curStep = stepsDone.findIndex((x) => !x);
  const go = (k) => refs[k].current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // dicas factuais
  const comprom = r.linhas.filter((l) => l.renda > 0).map((l) => ({ ...l, c: (l.justo / l.renda) * 100 }));
  const spread = comprom.length > 1 ? Math.max(...comprom.map((x) => x.c)) - Math.min(...comprom.map((x) => x.c)) : 0;
  const insights = [
    modo === 'renda'
      ? { tone: 'emerald', icon: BarChart3, title: 'Divisão equilibrada', text: r.totalRenda > 0 ? `Cada pessoa compromete ${pct1((r.total / r.totalRenda) * 100)} da própria renda com a casa.` : 'Informe as rendas para dividir proporcionalmente.' }
      : { tone: spread > 10 ? 'amber' : 'emerald', icon: Scale, title: spread > 10 ? 'Peso diferente na renda de cada um' : 'Divisão igual', text: comprom.length > 1 ? `Dividindo igual, o peso varia de ${pct1(Math.min(...comprom.map((x) => x.c)))} a ${pct1(Math.max(...comprom.map((x) => x.c)))} da renda. A opção proporcional iguala esse peso.` : 'Todos pagam a mesma parte das despesas.', onClick: spread > 10 ? () => setModo('renda') : undefined },
    r.maior && n(r.maior.valor) > 0 && { tone: 'violet', icon: Zap, title: 'Maior despesa', text: `${r.maior.desc || 'Sem descrição'} representa ${pct1(r.total > 0 ? (n(r.maior.valor) / r.total) * 100 : 0)} do total da casa (${formatCurrency(n(r.maior.valor))}).` },
    r.semDono > 0 && { tone: 'amber', icon: AlertTriangle, title: `${r.semDono} despesa(s) sem pagador`, text: 'Selecione quem pagou para o acerto ficar correto.', onClick: () => go(1) },
    { tone: 'sky', icon: CalendarDays, title: 'Mantenha o controle', text: `Atualize as despesas da casa todo mês. Dados salvos neste navegador (${monthLabel(monthKey(new Date()))}).` },
  ];

  const STEPS = [['Pessoas da casa', 'Quem participa e como dividir', Users], ['Despesas da casa', 'Cadastre os gastos do mês', Layers], ['Cálculo final do rateio', 'Veja o resultado e quem deve para quem', Calculator]];

  return (
    <div className="space-y-5 animate-fadeIn">
      <HeroTitle icon={Users} lead="Rateio da" accent="Casa" iconClass="text-fuchsia-400" subtitle="Cadastre as despesas da casa e descubra quem deve para quem de forma justa." art={<HouseArt className="w-80 h-44 xl:mr-16" />} />

      {/* Stepper */}
      <div className="flex flex-wrap items-center gap-2 max-w-5xl">
        {STEPS.map(([t, s, Ic], k) => { const on = k === (curStep === -1 ? 2 : curStep); const done = stepsDone[k]; return (
          <div key={t} className="contents">
            <button onClick={() => go(k)} className={`flex-1 min-w-[220px] flex items-center gap-3 rounded-2xl px-4 py-3 ring-1 text-left transition ${on ? 'ring-teal-400/70 bg-gradient-to-r from-teal-500/25 to-fuchsia-500/15 shadow-[0_0_22px_rgba(45,212,191,.25)]' : 'ring-[hsl(var(--border))] bg-[hsl(var(--card))] hover:ring-violet-400/50'}`}>
              <span className={`w-9 h-9 rounded-full grid place-items-center font-bold ring-2 shrink-0 ${done ? 'ring-emerald-400 text-emerald-400' : on ? 'ring-teal-300 text-teal-200 bg-teal-500/30' : 'ring-violet-400/60 text-violet-300'}`}>{done ? <CheckCircle2 className="w-5 h-5" /> : k + 1}</span>
              <Ic className="w-6 h-6 text-fuchsia-300 shrink-0" />
              <span className="min-w-0"><b className="block text-sm">{t}</b><span className="block text-xs text-muted truncate">{s}</span></span>
            </button>
            {k < 2 && <ChevronRight className="hidden lg:block w-5 h-5 text-cyan-400" />}
          </div>); })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Coluna 1: pessoas + despesas */}
        <div className="xl:col-span-5 space-y-5 min-w-0">
          <div ref={refs[0]} className="scroll-mt-24">
            <Panel title="1. Pessoas da casa" icon={Users} iconClass="text-fuchsia-400" tone="violet" action={
              <div className="inline-flex p-1 rounded-xl ring-1 ring-[hsl(var(--border))]">
                {[['igual', 'Dividir igual', null], ['renda', 'Proporcional à renda', Scale]].map(([v, l, Ic]) => <button key={v} onClick={() => setModo(v)} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${modo === v ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white' : 'text-muted'}`}>{Ic && <Ic className="w-3.5 h-3.5" />}{l}</button>)}
              </div>}>
              <div className="space-y-2">
                {pessoas.map((p, k) => { const l = r.linhas[k]; return (
                  <div key={p.id} className="flex items-center gap-3 rounded-2xl ring-1 ring-[hsl(var(--border))] bg-black/[.02] dark:bg-white/[.03] px-3 py-2.5">
                    <span className={`w-11 h-11 rounded-full grid place-items-center text-white font-bold text-lg bg-gradient-to-br ${l.ava} shrink-0 ring-2 ring-white/10`}>{(p.nome || '?').trim()[0]?.toUpperCase() || <User className="w-5 h-5" />}</span>
                    <div className="min-w-0 w-36 shrink-0">
                      <div className="flex items-center gap-1.5"><input value={p.nome} onChange={(e) => updP(p.id, 'nome', e.target.value)} aria-label="Nome" className="min-w-0 w-full bg-transparent font-semibold outline-none border-b border-transparent focus:border-cyan-400" />{k === 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 shrink-0">Anfitrião</span>}</div>
                      <label className="flex items-center gap-1 text-xs text-muted">Renda: R$<input type="number" value={p.renda} onChange={(e) => updP(p.id, 'renda', e.target.value)} aria-label="Renda" className="w-20 bg-transparent outline-none border-b border-transparent focus:border-cyan-400 text-[hsl(var(--text))]" /></label>
                    </div>
                    <div className="flex-1 min-w-0"><p className="text-sm font-bold" style={{ color: l.color }}>{pct1(l.peso * 100)}</p><Bar pct={l.peso * 100} color={`linear-gradient(90deg, ${l.color}, ${l.color}99)`} className="h-2 mt-1" glow /></div>
                    <button onClick={() => setPessoas((x) => x.filter((y) => y.id !== p.id))} disabled={pessoas.length <= 2} title={pessoas.length <= 2 ? 'Mínimo de 2 pessoas' : 'Remover'} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 disabled:opacity-30"><Trash2 className="w-4 h-4" /></button>
                  </div>); })}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
                <button onClick={() => setPessoas((x) => [...x, { id: uid(), nome: `Pessoa ${x.length + 1}`, renda: '' }])} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold ring-1 ring-[hsl(var(--border))] hover:ring-cyan-400/60"><Plus className="w-4 h-4" />Adicionar pessoa</button>
                <span className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl ring-1 ring-[hsl(var(--border))] text-sm"><LineIcon className="w-4 h-4 text-cyan-400" />Renda total: <b className="text-cyan-600 dark:text-cyan-300">{formatCurrency(r.totalRenda)}</b></span>
              </div>
            </Panel>
          </div>

          <div ref={refs[1]} className="scroll-mt-24">
            <Panel title="2. Despesas da casa" icon={Layers} iconClass="text-violet-400" tone="violet">
              <div className="hidden sm:grid grid-cols-[1.4fr_.9fr_1fr_32px] gap-2 text-xs text-muted px-1 mb-1.5"><span>Descrição</span><span>Valor (R$)</span><span>Quem pagou</span><span /></div>
              <div className="space-y-2">
                {despesas.map((d) => { const Ic = iconFor(d.desc); return (
                  <div key={d.id} className="grid grid-cols-2 sm:grid-cols-[1.4fr_.9fr_1fr_32px] gap-2 items-center">
                    <div className="relative col-span-2 sm:col-span-1"><Ic className="w-4 h-4 text-sky-400 absolute left-3 top-1/2 -translate-y-1/2" /><Input value={d.desc} onChange={(e) => updD(d.id, 'desc', e.target.value)} placeholder="Ex: Luz" className="!pl-9" /></div>
                    <Input type="number" value={d.valor} onChange={(e) => updD(d.id, 'valor', e.target.value)} placeholder="0,00" className="text-right" />
                    <Select value={d.quem} onChange={(e) => updD(d.id, 'quem', e.target.value)} className={d.quem ? '' : '!ring-amber-400/60'}><option value="">Quem pagou?</option>{pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</Select>
                    <button onClick={() => setDespesas((x) => x.filter((y) => y.id !== d.id))} className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg justify-self-center" aria-label="Remover despesa"><Trash2 className="w-4 h-4" /></button>
                  </div>); })}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
                <button onClick={() => setDespesas((x) => [...x, { id: uid(), desc: '', valor: '', quem: '' }])} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold ring-1 ring-[hsl(var(--border))] hover:ring-cyan-400/60"><Plus className="w-4 h-4" />Adicionar despesa</button>
                <span className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl ring-1 ring-[hsl(var(--border))] text-sm"><Layers className="w-4 h-4 text-cyan-400" />Total das despesas: <b className="text-cyan-600 dark:text-cyan-300">{formatCurrency(r.total)}</b></span>
              </div>
              {r.semDono > 0 && <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />{r.semDono} despesa(s) sem "quem pagou". Selecione o pagador para o acerto ficar correto.</p>}
            </Panel>
          </div>
        </div>

        {/* Coluna 2: cálculo */}
        <div ref={refs[2]} className="xl:col-span-4 scroll-mt-24 min-w-0">
          <Panel title="3. Cálculo final do rateio" icon={Calculator} iconClass="text-violet-400" tone="violet" action={<span className="inline-flex items-center gap-1.5 text-xs rounded-lg ring-1 ring-[hsl(var(--border))] px-2.5 py-1.5"><CalendarDays className="w-3.5 h-3.5" />{monthLabel(monthKey(new Date()))}</span>}>
            <div className="grid grid-cols-2 rounded-2xl ring-1 ring-violet-400/40 bg-violet-500/10 divide-x divide-[hsl(var(--border))]">
              <div className="p-3 flex items-center gap-2.5"><Coins className="w-8 h-8 text-amber-400 shrink-0" /><div className="min-w-0"><p className="text-xs text-muted">Total da casa</p><p className="font-display text-xl font-extrabold truncate">{formatCurrency(r.total)}</p></div></div>
              <div className="p-3 flex items-center gap-2.5"><Scale className="w-8 h-8 text-fuchsia-400 shrink-0" /><div className="min-w-0"><p className="text-xs text-muted">Método de divisão</p><p className="font-semibold leading-tight">{modo === 'renda' ? 'Proporcional à renda' : 'Dividir igual'}</p></div></div>
            </div>

            <div className="flex flex-col sm:flex-row xl:flex-col 2xl:flex-row items-center gap-4 mt-4">
              <Donut size={160} thickness={0.2} data={r.linhas.map((l) => ({ name: l.nome, value: l.justo, color: l.color }))} center={<><span className="font-display font-bold">{formatCurrency(r.total)}</span><span className="text-[10px] text-muted">Divisão da despesa</span></>} />
              <div className="flex-1 w-full">
                <p className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Layers className="w-4 h-4 text-cyan-400" />Quanto cada um deveria pagar</p>
                {r.linhas.map((l) => <div key={l.id} className="flex items-center gap-2 text-sm py-1.5 border-b border-[hsl(var(--border))] last:border-0"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: l.color }} /><span className="flex-1 truncate">{l.nome} <span style={{ color: l.color }}>({pct1(l.peso * 100)})</span></span><b className="tabular-nums">{formatCurrency(l.justo)}</b></div>)}
              </div>
            </div>

            <p className="text-sm font-semibold mt-4 mb-2 flex items-center gap-1.5"><Wallet className="w-4 h-4 text-cyan-400" />Quanto já foi pago</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {r.linhas.map((l) => <div key={l.id} className="rounded-xl ring-1 ring-[hsl(var(--border))] px-2.5 py-2 flex items-center gap-2 min-w-0"><span className={`w-8 h-8 rounded-full grid place-items-center text-white text-sm font-bold bg-gradient-to-br ${l.ava} shrink-0`}>{(l.nome || '?')[0].toUpperCase()}</span><div className="min-w-0"><p className="text-xs font-semibold truncate">{l.nome}</p><p className="text-sm font-bold truncate" style={{ color: l.color }}>{formatCurrency(l.pagou)}</p></div></div>)}
            </div>

            <div className="mt-4 rounded-2xl ring-1 ring-cyan-400/40 p-3">
              <p className="text-sm font-semibold mb-2 flex items-center gap-1.5"><ArrowRightLeft className="w-4 h-4 text-cyan-400" />Saldo do rateio (acerto entre vocês)</p>
              <div className="grid grid-cols-2 gap-2">
                {r.semDono > 0 ? <p className="col-span-2 text-sm text-amber-600 dark:text-amber-400 flex items-start gap-1.5"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />Informe quem pagou cada despesa para calcular o acerto ({r.semDono} sem pagador).</p> : r.linhas.filter((l) => Math.abs(l.saldo) > 0.01).map((l) => { const rec = l.saldo > 0; return (
                  <div key={l.id} className={`rounded-xl ring-1 p-2.5 ${rec ? 'ring-emerald-400/50 bg-emerald-500/10' : 'ring-fuchsia-400/50 bg-fuchsia-500/10'}`}>
                    <p className="text-xs">{l.nome} {rec ? 'recebe' : 'deve'}</p>
                    <p className={`font-display text-xl font-extrabold ${rec ? 'text-emerald-600 dark:text-emerald-300' : 'text-fuchsia-600 dark:text-fuchsia-300'}`}>{formatCurrency(Math.abs(l.saldo))}</p>
                  </div>); })}
                {r.semDono === 0 && r.linhas.every((l) => Math.abs(l.saldo) <= 0.01) && <p className="col-span-2 text-sm text-muted">Tudo quitado — cada um já pagou a sua parte justa.</p>}
              </div>
              {r.semDono === 0 && r.acertos.length > 0 && <div className="mt-2 space-y-1">{r.acertos.map((a, k) => <p key={k} className="text-xs flex items-center gap-1.5"><b className="text-fuchsia-500">{a.de}</b><ArrowRight className="w-3 h-3" /><b className="text-emerald-500">{a.para}</b><span className="ml-auto font-semibold">{formatCurrency(a.valor)}</span></p>)}</div>}
              <p className="text-[11px] text-muted mt-2 flex items-start gap-1.5"><Info className="w-3.5 h-3.5 shrink-0 mt-px" />Depois do acerto, todos ficam com a mesma participação {modo === 'renda' ? 'proporcional à renda' : 'igual'} nas despesas.</p>
            </div>
          </Panel>
        </div>

        {/* Coluna 3: dicas */}
        <div className="xl:col-span-3 space-y-4">
          <InsightsPanel title="Insights e Dicas" subtitle="Leitura automática do seu rateio." items={insights} />
          <CoinHouseArt className="hidden xl:block w-56 h-40 mx-auto" />
        </div>
      </div>
    </div>
  );
}
