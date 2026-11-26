import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { Payslip, AppSettings } from '../../api/entities.js';
import { Panel, GlowButton, TIP } from '../kit.jsx';
import { Button, Spinner, Select } from '../ui';
import { toast } from '../../lib/toast.js';
import { formatCurrency, monthKey, monthLabel } from '../../lib/utils.js';
import { groupByCompany, payslipSeries, kindLabel, formatCnpj, companyKey } from '../../lib/payslips.js';
import { PayslipModal } from './PayslipModal.jsx';
import { FolderOpen, Sparkles, Plus, Building2, Banknote, ShieldCheck, Receipt, Wallet, PiggyBank, Landmark, ArrowRight, FileText, Calculator, Pencil, Trash2, Download, BarChart3, Info } from 'lucide-react';

const money = (v) => formatCurrency(v || 0);
const short = (mk) => { const [y, m] = mk.split('-'); return `${['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][Number(m) - 1]}/${y.slice(2)}`; };
const COMPANY_TONES = ['#a78bfa', '#38bdf8', '#34d399', '#f472b6', '#fbbf24', '#2dd4bf'];

// Banco de holerites por empresa — leitura por IA, totais do ano e integração
// com a Carga Tributária (INSS/IRRF confirmados por documento).
export function PayslipBank({ onSimulate, simulated }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data: payslips = [], isLoading } = useQuery({ queryKey: ['payslips'], queryFn: () => Payslip.list() });
  const { data: settingsList = [] } = useQuery({ queryKey: ['appsettings'], queryFn: () => AppSettings.list() });
  const geminiKey = settingsList[0]?.gemini_api_key;

  const years = useMemo(() => {
    const s = new Set(payslips.map((p) => String(p.competence || '').slice(0, 4)).filter(Boolean));
    s.add(String(new Date().getFullYear()));
    return [...s].sort().reverse();
  }, [payslips]);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [company, setCompany] = useState('all');
  const [modal, setModal] = useState(null); // { initial, autoPick }

  const groupsAll = useMemo(() => groupByCompany(payslips), [payslips]);
  const inYear = useMemo(() => payslips.filter((p) => String(p.competence || '').startsWith(year) && (company === 'all' || companyKey(p) === company)), [payslips, year, company]);
  const groups = useMemo(() => groupByCompany(inYear), [inYear]);
  const tot = useMemo(() => {
    const s = (k) => inYear.reduce((a, p) => a + (Number(p[k]) || 0), 0);
    return { gross: s('gross'), inss: s('inss'), irrf: s('irrf'), net: s('net'), fgts: s('fgts'), other: s('other_deductions') };
  }, [inYear]);
  const endMk = year === String(new Date().getFullYear()) ? monthKey(new Date()) : `${year}-12`;
  const series = useMemo(() => payslipSeries(company === 'all' ? payslips : payslips.filter((p) => companyKey(p) === company), endMk, 12).map((r) => ({ ...r, label: short(r.mk), outros: Math.max(0, r.gross - r.net - r.inss - r.irrf) })), [payslips, company, endMk]);
  const hasSeries = series.some((r) => r.gross > 0);
  const toneOf = (key) => COMPANY_TONES[Math.max(0, groupsAll.findIndex((g) => g.key === key)) % COMPANY_TONES.length];
  const taxRate = tot.gross > 0 ? ((tot.inss + tot.irrf) / tot.gross) * 100 : 0;

  const invalidate = () => { qc.invalidateQueries({ queryKey: ['payslips'] }); qc.invalidateQueries({ predicate: (q) => String(q.queryKey?.[0] || '').startsWith('tax-') }); };
  const save = useMutation({
    mutationFn: async (data) => {
      const { id, created_date, updated_date, created_by_id, is_deleted, ...rest } = data;
      // mesma empresa + competência + tipo = substitui (evita duplicar ao reenviar)
      const dup = !id && payslips.find((p) => p.competence === rest.competence && p.kind === rest.kind && companyKey(p) === companyKey(rest));
      if (id || dup) return Payslip.update(id || dup.id, rest);
      return Payslip.create(rest);
    },
    onSuccess: (_, data) => { invalidate(); toast.success(`Holerite de ${monthLabel(data.competence)} salvo — Carga Tributária atualizada.`); setYear(data.competence.slice(0, 4)); setModal(null); },
    onError: (e) => toast.error('Não foi possível salvar: ' + (e.message || e)),
  });
  const remove = useMutation({ mutationFn: (id) => Payslip.remove(id), onSuccess: () => { invalidate(); toast.success('Holerite removido.'); } });

  function download(p) {
    if (!p.file_data) return;
    const a = document.createElement('a');
    a.href = `data:${p.file_type || 'application/pdf'};base64,${p.file_data}`;
    a.download = p.file_name || `holerite-${p.competence}.${/pdf/.test(p.file_type) ? 'pdf' : 'jpg'}`;
    a.click();
  }

  const kpis = [
    { l: 'Bruto recebido', v: tot.gross, icon: Banknote, c: '#34d399' },
    { l: 'INSS pago', v: tot.inss, icon: ShieldCheck, c: '#f472b6' },
    { l: 'IRRF pago', v: tot.irrf, icon: Receipt, c: '#38bdf8' },
    { l: 'Líquido recebido', v: tot.net, icon: Wallet, c: '#a78bfa' },
    { l: 'FGTS depositado', v: tot.fgts, icon: PiggyBank, c: '#fbbf24' },
  ];

  return (
    <Panel id="holerites" tone="violet" glow title="Meus holerites" subtitle="Banco de contracheques por empresa — a IA lê o PDF ou a foto e preenche tudo." icon={FolderOpen} iconClass="text-violet-400"
      action={<div className="flex gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => setModal({ initial: null, autoPick: false })}><Plus className="w-4 h-4" /> Lançar à mão</Button>
        <GlowButton tone="violet" onClick={() => setModal({ initial: null, autoPick: true })}><Sparkles className="w-4 h-4" /> Enviar holerite</GlowButton>
      </div>}>
      {isLoading ? <div className="py-10 grid place-items-center"><Spinner className="w-6 h-6" /></div> : payslips.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-violet-400/40 p-6 sm:p-8 text-center">
          <span className="w-14 h-14 rounded-2xl bg-violet-500/15 text-violet-500 grid place-items-center mx-auto"><FileText className="w-7 h-7" /></span>
          <p className="font-display text-lg font-bold mt-3">Guarde seus holerites aqui</p>
          <p className="text-sm text-muted mt-1 max-w-lg mx-auto">Envie o PDF ou uma foto do contracheque. A IA extrai empresa, CNPJ, competência, proventos, INSS, IRRF, FGTS e líquido. Os impostos passam a aparecer como <b>confirmados</b> em Minha Carga Tributária.</p>
          <div className="mt-4 flex justify-center gap-2 flex-wrap">
            <GlowButton tone="violet" onClick={() => setModal({ initial: null, autoPick: true })}><Sparkles className="w-4 h-4" /> Enviar o primeiro holerite</GlowButton>
            <Button variant="outline" onClick={() => setModal({ initial: null, autoPick: false })}><Plus className="w-4 h-4" /> Lançar à mão</Button>
          </div>
          {!geminiKey && <p className="text-xs text-amber-600 mt-3">Para a leitura automática, configure a chave do Gemini em Configurações.</p>}
        </div>
      ) : (
        <div className="space-y-5">
          {/* filtros */}
          <div className="flex flex-wrap items-center gap-2">
            <Select value={year} onChange={(e) => setYear(e.target.value)} className="!w-28 h-9">{years.map((y) => <option key={y} value={y}>{y}</option>)}</Select>
            <div className="flex gap-1.5 overflow-x-auto max-w-full pb-0.5">
              <button onClick={() => setCompany('all')} className={`px-3 py-1.5 rounded-full text-xs font-semibold ring-1 whitespace-nowrap transition ${company === 'all' ? 'bg-violet-500/20 ring-violet-400/60 text-violet-700 dark:text-violet-200' : 'ring-[hsl(var(--border))] text-muted hover:text-[hsl(var(--text))]'}`}>Todas as empresas ({payslips.length})</button>
              {groupsAll.map((g) => (
                <button key={g.key} onClick={() => setCompany(g.key)} className={`px-3 py-1.5 rounded-full text-xs font-semibold ring-1 whitespace-nowrap flex items-center gap-1.5 transition ${company === g.key ? 'bg-violet-500/20 ring-violet-400/60 text-violet-700 dark:text-violet-200' : 'ring-[hsl(var(--border))] text-muted hover:text-[hsl(var(--text))]'}`}><i className="w-2 h-2 rounded-full" style={{ background: toneOf(g.key) }} />{g.company} ({g.count})</button>
              ))}
            </div>
          </div>

          {/* KPIs do ano */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {kpis.map((k) => (
              <div key={k.l} className="rounded-2xl ring-1 ring-[hsl(var(--border))] bg-[hsl(var(--card))] p-3.5 flex items-center gap-3" style={{ backgroundImage: `linear-gradient(135deg,${k.c}1f,transparent 70%)` }}>
                <span className="w-10 h-10 rounded-xl grid place-items-center shrink-0" style={{ background: `${k.c}26`, color: k.c }}><k.icon className="w-5 h-5" /></span>
                <div className="min-w-0"><p className="text-[11px] text-muted">{k.l} · {year}</p><p className="font-display text-lg font-bold truncate">{money(k.v)}</p></div>
              </div>
            ))}
          </div>

          {/* integração Carga Tributária */}
          <button onClick={() => nav('/carga-tributaria')} className="w-full text-left rounded-2xl ring-1 ring-fuchsia-400/40 bg-fuchsia-500/10 px-4 py-3 flex items-center gap-3 hover:bg-fuchsia-500/15 transition">
            <Landmark className="w-5 h-5 text-fuchsia-400 shrink-0" />
            <span className="flex-1 text-sm">Em {year} seus holerites somam <b>{money(tot.inss + tot.irrf)}</b> de impostos sobre o salário ({taxRate.toFixed(1).replace('.', ',')}% do bruto). Esses valores entram como <b>confirmados</b> em Minha Carga Tributária nos meses com holerite.</span>
            <ArrowRight className="w-4 h-4 text-muted shrink-0" />
          </button>

          {/* evolução */}
          {hasSeries && (
            <div className="rounded-2xl ring-1 ring-[hsl(var(--border))] p-3 sm:p-4">
              <p className="text-sm font-semibold flex items-center gap-2 mb-2"><BarChart3 className="w-4 h-4 text-sky-400" /> Evolução — últimos 12 meses{company !== 'all' ? ` · ${groupsAll.find((g) => g.key === company)?.company}` : ''}</p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={series} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} />
                    <Tooltip contentStyle={TIP} formatter={(v, name) => [money(v), name]} cursor={{ fill: 'hsl(var(--muted) / .12)' }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="net" name="Líquido" stackId="a" fill="#34d399" />
                    <Bar dataKey="inss" name="INSS" stackId="a" fill="#ec4899" />
                    <Bar dataKey="irrf" name="IRRF" stackId="a" fill="#3b82f6" />
                    <Bar dataKey="outros" name="Outros descontos" stackId="a" fill="#a855f7" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* lista por empresa */}
          {groups.length === 0 ? <p className="text-sm text-muted text-center py-6">Nenhum holerite em {year}{company !== 'all' ? ' para esta empresa' : ''}.</p> : groups.map((g) => (
            <div key={g.key} className="rounded-2xl ring-1 ring-[hsl(var(--border))] overflow-hidden">
              <div className="px-4 py-3 flex flex-wrap items-center gap-3 bg-black/[.03] dark:bg-white/[.04]" style={{ boxShadow: `inset 3px 0 0 ${toneOf(g.key)}` }}>
                <span className="w-10 h-10 rounded-xl grid place-items-center shrink-0" style={{ background: `${toneOf(g.key)}26`, color: toneOf(g.key) }}><Building2 className="w-5 h-5" /></span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{g.company}</p>
                  <p className="text-xs text-muted">{g.cnpj ? `CNPJ ${formatCnpj(g.cnpj)} · ` : ''}{g.count} holerite(s) · {g.first === g.last ? monthLabel(g.first) : `${short(g.first)} a ${short(g.last)}`}</p>
                </div>
                <div className="flex gap-4 text-xs">
                  <span><span className="text-muted block">Bruto</span><b>{money(g.gross)}</b></span>
                  <span><span className="text-muted block">INSS + IRRF</span><b className="text-rose-500">{money(g.inss + g.irrf)}</b></span>
                  <span><span className="text-muted block">Líquido</span><b className="text-emerald-600 dark:text-emerald-300">{money(g.net)}</b></span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[760px]">
                  <thead><tr className="text-[11px] uppercase tracking-wide text-muted"><th className="text-left font-semibold px-4 py-2">Competência</th><th className="text-left font-semibold px-2">Tipo</th><th className="text-right font-semibold px-2">Bruto</th><th className="text-right font-semibold px-2">INSS</th><th className="text-right font-semibold px-2">IRRF</th><th className="text-right font-semibold px-2">Outros</th><th className="text-right font-semibold px-2">Líquido</th><th className="w-36" /></tr></thead>
                  <tbody className="divide-y divide-[hsl(var(--border))]">
                    {g.list.map((p) => (
                      <tr key={p.id} className="hover:bg-black/[.02] dark:hover:bg-white/[.03]">
                        <td className="px-4 py-2.5"><b>{monthLabel(p.competence)}</b>{p.source === 'ia' && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-600 dark:text-violet-300 font-semibold">IA</span>}{p.file_data && <FileText className="w-3.5 h-3.5 inline ml-1.5 text-muted" title="Arquivo guardado" />}</td>
                        <td className="px-2 text-muted">{kindLabel(p.kind)}</td>
                        <td className="px-2 text-right tabular-nums">{money(p.gross)}</td>
                        <td className="px-2 text-right tabular-nums text-rose-500">{money(p.inss)}</td>
                        <td className="px-2 text-right tabular-nums text-rose-500">{money(p.irrf)}</td>
                        <td className="px-2 text-right tabular-nums text-muted">{money(p.other_deductions)}</td>
                        <td className="px-2 text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-300">{money(p.net)}</td>
                        <td className="px-2 text-right">
                          <span className="inline-flex gap-0.5">
                            {[
                              [Calculator, 'Simular com este holerite', () => onSimulate?.(p), ''],
                              [Pencil, 'Editar', () => setModal({ initial: p, autoPick: false }), ''],
                              ...(p.file_data ? [[Download, 'Baixar arquivo', () => download(p), '']] : []),
                              [Trash2, 'Excluir', () => { if (window.confirm(`Excluir o holerite de ${monthLabel(p.competence)} (${p.company})?`)) remove.mutate(p.id); }, 'hover:text-rose-500'],
                            ].map(([Ic, t, fn, cls]) => <button key={t} title={t} aria-label={t} onClick={fn} className={`p-1.5 rounded-lg text-muted hover:bg-black/5 dark:hover:bg-white/10 hover:text-[hsl(var(--text))] ${cls}`}><Ic className="w-4 h-4" /></button>)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          {simulated && <p className="text-xs text-muted flex gap-1.5"><Info className="w-3.5 h-3.5 shrink-0" />{simulated}</p>}
        </div>
      )}

      <PayslipModal open={!!modal} onClose={() => setModal(null)} initial={modal?.initial} autoPick={modal?.autoPick} geminiKey={geminiKey}
        companies={groupsAll.map((g) => g.company)} saving={save.isPending} onSave={(d) => save.mutate(d)} />
    </Panel>
  );
}
