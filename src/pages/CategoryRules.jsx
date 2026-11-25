import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CategoryRule, Category, Transaction, AppSettings } from '../api/entities.js';
import { Button, Input, Select, Field, Modal, Spinner, EmptyState } from '../components/ui';
import { PageTitle, StatCard, Panel, Donut, Pager, InsightRow, GlowButton, pct1 } from '../components/kit.jsx';
import { toast } from '../lib/toast.js';
import { formatCurrency, monthKey, inMonth } from '../lib/utils.js';
import { matchRule, ruleMatches, rulePatterns } from '../lib/categoryPredictor.js';
import { categoryIcon } from '../lib/categoryIcons.js';
import {
  Wand2, Plus, Pencil, Trash2, Copy, ArrowRight, Play, Zap, Network, Layers, Target, CalendarClock, LayoutGrid, ArrowDown, ArrowUp,
  Search, Filter, Trophy, AlertTriangle, BarChart3, Info, CheckCircle2,
} from 'lucide-react';

const empty = { pattern: '', category_id: '', tx_type: 'expense', priority: 0, is_active: true };
const PAGE = 8;

export default function CategoryRules() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data: rules = [], isLoading } = useQuery({ queryKey: ['catrules'], queryFn: () => CategoryRule.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });
  const { data: transactions = [] } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: settingsList = [] } = useQuery({ queryKey: ['appsettings'], queryFn: () => AppSettings.list() });
  const settings = settingsList[0];
  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [simOpen, setSimOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('priority');
  const [page, setPage] = useState(1);
  const [toDelete, setToDelete] = useState(null);

  const inval = () => qc.invalidateQueries({ queryKey: ['catrules'] });
  const save = useMutation({ mutationFn: (p) => editing ? CategoryRule.update(editing.id, p) : CategoryRule.create(p), onSuccess: () => { inval(); setModal(false); toast.success('Regra salva.'); } });
  const del = useMutation({ mutationFn: (id) => CategoryRule.remove(id), onSuccess: () => { inval(); setToDelete(null); } });
  const toggle = useMutation({ mutationFn: (r) => CategoryRule.update(r.id, { is_active: r.is_active === false }), onSuccess: inval });
  const dup = useMutation({ mutationFn: (r) => CategoryRule.create({ pattern: r.pattern, category_id: r.category_id, tx_type: r.tx_type, priority: Number(r.priority || 0), is_active: false }), onSuccess: () => { inval(); toast.success('Regra duplicada (inativa) — edite e ative.'); } });

  const real = useMemo(() => transactions.filter((t) => t.type !== 'transfer'), [transactions]);
  const uncategorized = useMemo(() => real.filter((t) => !t.category_id), [real]);
  const active = rules.filter((r) => r.is_active !== false);

  // acertos por regra: lançamentos que a regra pega E que estão na categoria de destino
  const hits = useMemo(() => {
    const m = {};
    for (const r of rules) m[r.id] = real.filter((t) => (!r.tx_type || r.tx_type === t.type) && t.category_id === r.category_id && ruleMatches(t.description, r)).length;
    return m;
  }, [rules, real]);

  // taxa de acerto: dos lançamentos categorizados que alguma regra ativa pegaria, quantos concordam com a regra
  const accuracy = (txs) => {
    let n = 0, ok = 0;
    for (const t of txs) { if (!t.category_id) continue; const cid = matchRule(t.description, active, t.type); if (!cid) continue; n++; if (cid === t.category_id) ok++; }
    return n ? (ok / n) * 100 : null;
  };
  const now = new Date();
  const mk = monthKey(now); const prevMk = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const accAll = useMemo(() => accuracy(real), [real, active]); // eslint-disable-line react-hooks/exhaustive-deps
  const accCur = useMemo(() => accuracy(real.filter((t) => inMonth(t.date, mk))), [real, active, mk]); // eslint-disable-line react-hooks/exhaustive-deps
  const accPrev = useMemo(() => accuracy(real.filter((t) => inMonth(t.date, prevMk))), [real, active, prevMk]); // eslint-disable-line react-hooks/exhaustive-deps
  const accShown = accCur ?? accAll;
  const accDelta = accCur != null && accPrev != null ? accCur - accPrev : null;

  const coverage = real.length ? ((real.length - uncategorized.length) / real.length) * 100 : 0;
  const lastRun = settings?.rules_last_run && typeof settings.rules_last_run === 'object' ? settings.rules_last_run : null;

  // simulação: o que as regras ativas fariam com os lançamentos sem categoria
  const simulation = useMemo(() => uncategorized.map((t) => ({ t, cid: matchRule(t.description, active, t.type) })), [uncategorized, active]);
  const simHits = simulation.filter((s) => s.cid && catMap[s.cid]);

  const rType = (r) => r.tx_type || (catMap[r.category_id]?.type === 'income' ? 'income' : 'expense');
  const counts = { all: rules.length, expense: rules.filter((r) => rType(r) === 'expense').length, income: rules.filter((r) => rType(r) === 'income').length, active: active.length };
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const arr = rules.filter((r) => {
      if (filter === 'expense' && rType(r) !== 'expense') return false;
      if (filter === 'income' && rType(r) !== 'income') return false;
      if (filter === 'active' && r.is_active === false) return false;
      if (s && !String(r.pattern).toLowerCase().includes(s) && !(catMap[r.category_id]?.name || '').toLowerCase().includes(s)) return false;
      return true;
    });
    arr.sort((a, b) => sort === 'hits' ? (hits[b.id] || 0) - (hits[a.id] || 0) : sort === 'az' ? String(a.pattern).localeCompare(String(b.pattern)) : (Number(b.priority || 0) - Number(a.priority || 0)) || String(a.pattern).localeCompare(String(b.pattern)));
    return arr;
  }, [rules, filter, q, sort, catMap, hits]);
  useEffect(() => setPage(1), [filter, q, sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const rows = filtered.slice((page - 1) * PAGE, page * PAGE);
  const topRules = [...rules].filter((r) => hits[r.id] > 0).sort((a, b) => hits[b.id] - hits[a.id]).slice(0, 3);

  const openNew = (preset = {}) => { setEditing(null); setForm({ ...empty, category_id: categories.find((c) => c.type === (preset.tx_type || 'expense'))?.id || '', ...preset }); setModal(true); };
  const openEdit = (r) => { setEditing(r); setForm({ pattern: r.pattern, category_id: r.category_id || '', tx_type: rType(r), priority: r.priority || 0, is_active: r.is_active !== false }); setModal(true); };
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = () => { if (!form.pattern.trim() || !form.category_id) return toast.error('Informe o texto e a categoria'); save.mutate({ ...form, pattern: rulePatterns(form).join(', '), priority: Number(form.priority || 0) }); };

  const recordRun = async (processed, categorized) => {
    const payload = { rules_last_run: { at: new Date().toISOString(), processed, categorized } };
    try { if (settings?.id) await AppSettings.update(settings.id, payload); else await AppSettings.create(payload); qc.invalidateQueries({ queryKey: ['appsettings'] }); } catch { /* registro é complementar */ }
  };
  const applyNow = async () => {
    if (!active.length) return toast.info('Crie ou ative ao menos uma regra primeiro.');
    if (!uncategorized.length) { await recordRun(0, 0); return toast.info('Nenhum lançamento sem categoria.'); }
    setBusy(true);
    let done = 0;
    try {
      for (const { t, cid } of simulation) { if (cid && catMap[cid]) { await Transaction.update(t.id, { category_id: cid }); done++; } }
      qc.invalidateQueries({ queryKey: ['transactions'] });
      await recordRun(uncategorized.length, done);
      toast.success(done ? `${done} lançamento(s) categorizado(s) pelas regras.` : 'Nenhum lançamento bateu com as regras.');
      setSimOpen(false);
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const cats = categories.filter((c) => c.type === form.tx_type);
  const lastRunLabel = lastRun ? (() => { const d = new Date(lastRun.at); const today = new Date(); const y = new Date(); y.setDate(y.getDate() - 1); const hh = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); return d.toDateString() === today.toDateString() ? `Hoje, às ${hh}` : d.toDateString() === y.toDateString() ? `Ontem, às ${hh}` : `${d.toLocaleDateString('pt-BR')} ${hh}`; })() : 'Nunca';

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageTitle icon={Wand2} title="Regras de Categorização" subtitle="Categorize automaticamente seus lançamentos por palavra-chave ou condição."
        actions={<>
          <Button variant="outline" onClick={() => setSimOpen(true)}><Play className="w-4 h-4" /> Simular regras</Button>
          <Button variant="outline" onClick={applyNow} disabled={busy}>{busy ? <Spinner className="w-4 h-4" /> : <><Zap className="w-4 h-4" /> Aplicar agora</>}</Button>
          <GlowButton onClick={() => openNew()}><Plus className="w-4 h-4" /> Nova regra</GlowButton>
        </>} />

      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        <StatCard tone="teal" icon={Network} label="Regras ativas" value={active.length} sub={`de ${rules.length} regra${rules.length === 1 ? '' : 's'} cadastrada${rules.length === 1 ? '' : 's'}`} />
        <StatCard tone="violet" icon={Layers} label="Lançamentos sem categoria" value={uncategorized.length} sub="pendentes de categorização" onClick={uncategorized.length ? () => setSimOpen(true) : undefined} />
        <StatCard tone="emerald" icon={Target} label="Taxa de acerto" value={accShown != null ? pct1(accShown) : '—'} sub={accDelta != null ? <span className={accDelta >= 0 ? 'text-emerald-500' : 'text-rose-500'}>{accDelta >= 0 ? '▲ +' : '▼ '}{accDelta.toFixed(1).replace('.', ',')} p.p. vs. mês anterior</span> : accCur == null && accAll != null ? 'geral (sem lançamentos no mês)' : 'concordância das regras com suas categorias'} />
        <StatCard tone="amber" icon={CalendarClock} label="Última execução" value={lastRunLabel} sub={lastRun ? `${lastRun.processed} processado(s) · ${lastRun.categorized} categorizado(s)` : 'use "Aplicar agora"'} />
      </div>

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {[['all', `Todas (${counts.all})`, LayoutGrid], ['expense', `Despesas (${counts.expense})`, ArrowDown], ['income', `Receitas (${counts.income})`, ArrowUp], ['active', `Ativas (${counts.active})`, CheckCircle2]].map(([v, l, Ic]) => (
              <button key={v} onClick={() => setFilter(v)} aria-pressed={filter === v} className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold ring-1 transition ${filter === v ? 'ring-teal-400 bg-teal-400/15 text-teal-700 dark:text-teal-200 shadow-[0_0_14px_rgba(45,212,191,.3)]' : 'ring-[hsl(var(--border))] text-muted hover:text-[hsl(var(--text))]'}`}>
                {v === 'active' ? <span className="w-2 h-2 rounded-full bg-emerald-400" /> : <Ic className="w-4 h-4" />}{l}
              </button>
            ))}
            <div className="relative ml-auto min-w-[200px] flex-1 sm:flex-none sm:w-60"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar regra..." className="input-base !py-2 !pl-9" /></div>
            <label className="relative inline-flex items-center gap-1.5 px-3 py-2 rounded-xl ring-1 ring-[hsl(var(--border))] text-sm cursor-pointer" title="Ordenar">
              <Filter className="w-4 h-4 text-muted" />
              <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Ordenar regras" className="appearance-none bg-transparent outline-none cursor-pointer font-medium [&>option]:text-slate-800"><option value="priority">Prioridade</option><option value="hits">Mais acertos</option><option value="az">A–Z</option></select>
            </label>
          </div>

          <Panel tone="sky" className="!p-3 sm:!p-4">
            {isLoading ? <div className="flex justify-center py-10"><Spinner className="w-6 h-6 text-emerald-500" /></div>
              : rules.length === 0 ? <EmptyState icon={Wand2} title="Nenhuma regra" subtitle='Ex.: se a descrição contém "uber, 99" → Transporte.' action={<Button onClick={() => openNew()}><Plus className="w-4 h-4" /> Nova regra</Button>} />
              : (<>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-separate border-spacing-y-1.5 min-w-[820px]">
                    <thead><tr className="text-left text-xs text-muted">
                      <th className="px-3 py-1 font-medium">Regra (Condição)</th><th className="px-2 py-1 font-medium">Categoria de Destino</th><th className="px-2 py-1 font-medium">Tipo</th>
                      <th className="px-2 py-1 font-medium"><span className="inline-flex items-center gap-1">Prioridade <span title="Quando várias regras batem, vale a de maior prioridade."><Info className="w-3.5 h-3.5" /></span></span></th>
                      <th className="px-2 py-1 font-medium">Status</th><th className="px-2 py-1"><span className="sr-only">Ações</span></th>
                    </tr></thead>
                    <tbody>
                      {rows.length === 0 ? <tr><td colSpan={6} className="text-center text-muted py-8">Nenhuma regra com esses filtros.</td></tr> : rows.map((r) => {
                        const c = catMap[r.category_id]; const Ic = categoryIcon(c); const color = c?.color || '#64748b'; const on = r.is_active !== false; const inc = rType(r) === 'income';
                        const cell = 'bg-black/[0.025] dark:bg-white/[0.03] group-hover:bg-black/[0.045] dark:group-hover:bg-white/[0.05]';
                        return (
                          <tr key={r.id} className={`group ${on ? '' : 'opacity-60'}`}>
                            <td className={`pl-3 pr-2 py-2 rounded-l-xl ${cell}`}>
                              <span className="flex items-center gap-3 min-w-0">
                                <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}26`, color }}><Ic className="w-5 h-5" /></span>
                                <span className="min-w-0"><span className="block text-[11px] text-muted">Se contém</span><span className="block font-semibold truncate max-w-[220px]" title={r.pattern}>{rulePatterns(r).map((p) => p.replace(/^./, (x) => x.toUpperCase())).join(', ')}</span></span>
                                <ArrowRight className="w-4 h-4 text-muted shrink-0 ml-auto" />
                              </span>
                            </td>
                            <td className={`px-2 py-2 ${cell}`}>
                              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ring-1 max-w-[220px]" style={{ '--tw-ring-color': `${color}55`, background: `${color}14` }}><Ic className="w-4 h-4 shrink-0" style={{ color }} /><span className="truncate font-medium">{c?.name || 'Categoria removida'}</span></span>
                            </td>
                            <td className={`px-2 py-2 ${cell}`}><span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${inc ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300' : 'bg-rose-500/15 text-rose-500 dark:text-rose-300'}`}>{inc ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}{inc ? 'Receita' : 'Despesa'}</span></td>
                            <td className={`px-2 py-2 ${cell}`}><span className="inline-flex w-8 h-8 rounded-full items-center justify-center text-sm font-bold bg-violet-500/20 text-violet-600 dark:text-violet-200 ring-1 ring-violet-400/40">{Number(r.priority || 0)}</span></td>
                            <td className={`px-2 py-2 ${cell}`}>
                              <button onClick={() => toggle.mutate(r)} title={on ? 'Clique para desativar' : 'Clique para ativar'} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold ring-1 transition ${on ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 ring-emerald-400/40' : 'bg-black/5 dark:bg-white/5 text-muted ring-[hsl(var(--border))]'}`}><span className={`w-2 h-2 rounded-full ${on ? 'bg-emerald-400' : 'bg-slate-400'}`} />{on ? 'Ativa' : 'Inativa'}</button>
                              {hits[r.id] > 0 && <span className="block text-[10px] text-muted mt-0.5">{hits[r.id]} acerto{hits[r.id] === 1 ? '' : 's'}</span>}
                            </td>
                            <td className={`pr-3 py-2 rounded-r-xl text-right whitespace-nowrap ${cell}`}>
                              <button onClick={() => openEdit(r)} aria-label="Editar regra" className="p-1.5 rounded-lg text-muted hover:text-[hsl(var(--text))] hover:bg-black/5 dark:hover:bg-white/10"><Pencil className="w-4 h-4" /></button>
                              <button onClick={() => dup.mutate(r)} aria-label="Duplicar regra" className="p-1.5 rounded-lg text-muted hover:text-[hsl(var(--text))] hover:bg-black/5 dark:hover:bg-white/10"><Copy className="w-4 h-4" /></button>
                              <button onClick={() => setToDelete(r)} aria-label="Excluir regra" className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10"><Trash2 className="w-4 h-4" /></button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 mt-2 px-1">
                  <p className="text-xs text-muted">Mostrando {rows.length} de {filtered.length} regra{filtered.length === 1 ? '' : 's'}</p>
                  {pages > 1 && <Pager page={page} pages={pages} onPage={setPage} />}
                </div>
              </>)}
          </Panel>
        </div>

        <Panel tone="violet" glow title="Insights de Automação" icon={Zap} iconClass="text-teal-300" className="h-fit">
          <div className="space-y-3">
            <div className="rounded-2xl ring-1 ring-sky-400/25 p-3.5 bg-black/[0.02] dark:bg-white/[0.03]">
              <p className="font-semibold flex items-center gap-2 mb-2"><Trophy className="w-5 h-5 text-amber-400" /> Regras mais utilizadas</p>
              {topRules.length === 0 ? <p className="text-xs text-muted">As regras ainda não têm acertos nos seus lançamentos.</p> : topRules.map((r, i) => (
                <button key={r.id} onClick={() => openEdit(r)} className="w-full flex items-center gap-2 py-1.5 text-sm hover:opacity-80">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: ['#38bdf8', '#a855f7', '#2dd4bf'][i] }} />
                  <span className="flex-1 truncate text-left">{catMap[r.category_id]?.name || r.pattern}</span>
                  <span className="text-muted text-xs whitespace-nowrap">{hits[r.id]} acerto{hits[r.id] === 1 ? '' : 's'}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted" />
                </button>
              ))}
            </div>
            <InsightRow tone="rose" icon={AlertTriangle} title="Lançamentos sem categoria" text={`${uncategorized.length} ite${uncategorized.length === 1 ? 'm' : 'ns'} · ${simHits.length} seriam categorizados pelas regras`} onClick={() => setSimOpen(true)} />
            <div className="rounded-2xl ring-1 ring-teal-400/25 p-3.5 bg-black/[0.02] dark:bg-white/[0.03]">
              <p className="font-semibold flex items-center gap-2 mb-3"><Zap className="w-5 h-5 text-teal-300" /> Cobertura da automação</p>
              <div className="flex items-center gap-4">
                <Donut size={150} thickness={0.22} data={[{ name: 'Categorizados', value: real.length - uncategorized.length, color: '#2dd4bf' }, { name: 'Sem categoria', value: uncategorized.length, color: '#c084fc' }]} center={<><span className="font-display text-2xl font-bold">{pct1(coverage)}</span><span className="text-[11px] text-muted">cobertura</span></>} />
                <div className="text-sm space-y-1.5 min-w-0">
                  <p className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-teal-400" /> Categorizados <b className="ml-auto pl-2">{real.length - uncategorized.length}</b></p>
                  <p className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-purple-400" /> Sem categoria <b className="ml-auto pl-2">{uncategorized.length}</b></p>
                  <div className="border-t border-[hsl(var(--border))] pt-1.5 mt-1.5"><p className="text-xs text-muted">Total de lançamentos</p><p className="font-display text-xl font-bold">{real.length}</p></div>
                </div>
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={() => nav('/lancamentos')}><BarChart3 className="w-4 h-4" /> Ver lançamentos</Button>
          </div>
        </Panel>
      </div>

      {/* Simulação */}
      <Modal open={simOpen} onClose={() => setSimOpen(false)} title="Simular regras nos lançamentos sem categoria" maxWidth="max-w-2xl"
        footer={<><Button variant="outline" onClick={() => setSimOpen(false)}>Fechar</Button><Button onClick={applyNow} disabled={busy || !simHits.length}>{busy ? <Spinner className="w-4 h-4" /> : <><Zap className="w-4 h-4" /> Aplicar em {simHits.length}</>}</Button></>}>
        {uncategorized.length === 0 ? <p className="text-sm text-muted">Nenhum lançamento sem categoria. 🎉</p> : (
          <div className="space-y-2">
            <p className="text-sm text-muted">Nada é alterado até você clicar em aplicar. {simHits.length} de {uncategorized.length} lançamento(s) seriam categorizados.</p>
            <div className="max-h-[55vh] overflow-y-auto divide-y divide-[hsl(var(--border))] rounded-xl ring-1 ring-[hsl(var(--border))]">
              {simulation.map(({ t, cid }) => { const c = catMap[cid]; return (
                <div key={t.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1"><p className="truncate font-medium">{t.description || 'Sem descrição'}</p><p className="text-[11px] text-muted">{new Date(String(t.date).slice(0, 10) + 'T00:00').toLocaleDateString('pt-BR')} · {t.type === 'income' ? 'Receita' : 'Despesa'} · {formatCurrency(t.amount)}</p></div>
                  {c ? <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-lg" style={{ background: `${c.color}22`, color: c.color }}><ArrowRight className="w-3 h-3" /> {c.name}</span>
                    : <button onClick={() => { setSimOpen(false); openNew({ pattern: String(t.description || '').toLowerCase().split(/\s+/).slice(0, 2).join(' '), tx_type: t.type === 'income' ? 'income' : 'expense' }); }} className="text-xs font-semibold text-sky-500 hover:underline whitespace-nowrap">+ criar regra</button>}
                </div>
              ); })}
            </div>
          </div>
        )}
      </Modal>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar regra' : 'Nova regra'} maxWidth="max-w-md"
        footer={<><Button variant="outline" onClick={() => setModal(false)}>Cancelar</Button><Button onClick={submit} disabled={save.isPending}>{save.isPending ? <Spinner className="w-4 h-4" /> : 'Salvar'}</Button></>}>
        <div className="space-y-3">
          <Field label="Tipo"><Select value={form.tx_type} onChange={(e) => { set('tx_type', e.target.value); set('category_id', categories.find((c) => c.type === e.target.value)?.id || ''); }}><option value="expense">Despesa</option><option value="income">Receita</option></Select></Field>
          <Field label="Se a descrição contém" hint="várias palavras separadas por vírgula; não diferencia maiúsculas"><Input value={form.pattern} onChange={(e) => set('pattern', e.target.value)} placeholder="Ex: uber, 99, cabify" /></Field>
          <Field label="Categorizar como"><Select value={form.category_id} onChange={(e) => set('category_id', e.target.value)}><option value="">Selecione</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prioridade" hint="maior = vale primeiro"><Input type="number" value={form.priority} onChange={(e) => set('priority', e.target.value)} /></Field>
            <Field label="Status"><Select value={form.is_active ? '1' : '0'} onChange={(e) => set('is_active', e.target.value === '1')}><option value="1">Ativa</option><option value="0">Inativa</option></Select></Field>
          </div>
          {form.pattern.trim() && (() => { const n = real.filter((t) => (t.type === form.tx_type) && ruleMatches(t.description, form)).length; return <p className="text-xs text-muted">Esta condição pega <b>{n}</b> lançamento(s) existente(s).</p>; })()}
        </div>
      </Modal>

      <Modal open={!!toDelete} onClose={() => setToDelete(null)} title="Excluir regra" maxWidth="max-w-md"
        footer={<><Button variant="outline" onClick={() => setToDelete(null)}>Cancelar</Button><Button variant="danger" onClick={() => del.mutate(toDelete.id)} disabled={del.isPending}>Excluir</Button></>}>
        <p className="text-sm text-muted">Excluir a regra “{toDelete?.pattern}”? Lançamentos já categorizados não mudam.</p>
      </Modal>
    </div>
  );
}
