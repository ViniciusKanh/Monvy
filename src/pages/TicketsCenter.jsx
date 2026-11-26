import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Support } from '../api/entities.js';
import { useAuth } from '../context/AuthContext.jsx';
import { HeroTitle, Panel, Donut, GlowButton, KebabMenu, Pager } from '../components/kit.jsx';
import { SupportBotArt } from '../components/art/PageArt.jsx';
import { Card, Button, Input, Select, Field, Modal, Spinner, EmptyState, Textarea } from '../components/ui';
import { Reveal } from '../components/Animated.jsx';
import { toast } from '../lib/toast.js';
import {
  Ticket, Plus, Search, Settings2, Send, Paperclip, X, Image as ImageIcon, UserCircle, Mail,
  Shield, CheckCircle2, RotateCcw, Trash2, Filter, MailWarning, MailX, RefreshCw,
  Lock, UserPlus, MessageSquareText, ChevronDown, Layers, FolderOpen, Clock, Zap, Timer, AlertTriangle, LayoutGrid, Activity, ChevronsRight, MessageCircle, Upload, FileText, KeyRound, GitCompare, Link2, Lightbulb, HelpCircle, ArrowRight, ArrowUp, ArrowDown, ListChecks,
} from 'lucide-react';

const HEX = { amber: '#f59e0b', blue: '#3b82f6', violet: '#8b5cf6', emerald: '#10b981', slate: '#64748b', rose: '#f43f5e', sky: '#0ea5e9', teal: '#14b8a6', indigo: '#6366f1' };
const COLOR_KEYS = Object.keys(HEX);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'status';

function readImage(file, max = 1100) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve('');
    if (file.type === 'application/pdf') { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file); return; }
    const img = new Image(); const r = new FileReader();
    r.onload = () => { img.src = r.result; }; r.onerror = reject;
    img.onload = () => { const s = Math.min(1, max / Math.max(img.width, img.height)); const w = Math.round(img.width * s), h = Math.round(img.height * s); const cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d').drawImage(img, 0, 0, w, h); resolve(cv.toDataURL('image/jpeg', 0.72)); };
    r.readAsDataURL(file);
  });
}
function StatusChip({ st }) {
  const hex = HEX[st?.color] || HEX.slate;
  return <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${hex}22`, color: hex }}>{st?.label || 'Novo'}</span>;
}
// Sinalizacao de entrega do e-mail da mensagem — nunca afirma "enviado" sem
// confirmacao real do provedor (vem direto do que o backend gravou).
function EmailStatus({ status, error, onResend, resending }) {
  if (!status) return null;
  const map = {
    sent: { icon: CheckCircle2, cls: 'text-emerald-500', text: 'e-mail enviado' },
    failed: { icon: MailX, cls: 'text-rose-500', text: 'falha ao enviar e-mail' },
    skipped: { icon: MailWarning, cls: 'text-amber-500', text: 'e-mail não configurado' },
  };
  const info = map[status] || map.skipped;
  const Icon = info.icon;
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <span className={`text-[10px] flex items-center gap-1 ${info.cls}`} title={error || ''}><Icon className="w-3 h-3" /> {info.text}</span>
      <button onClick={onResend} disabled={resending} title="Reenviar este e-mail" className="text-[10px] text-sky-500 hover:underline flex items-center gap-0.5 disabled:opacity-50">
        {resending ? <Spinner className="w-2.5 h-2.5" /> : <RefreshCw className="w-2.5 h-2.5" />} reenviar
      </button>
    </div>
  );
}

const PRIO = { urgente: ['Urgente', '#f43f5e'], alta: ['Alta', '#fb7185'], normal: ['Média', '#fbbf24'], baixa: ['Baixa', '#34d399'] };
const CAT_ICON = [[/import/i, Upload], [/relat/i, FileText], [/acess|permiss|login|senha/i, KeyRound], [/concil/i, GitCompare], [/integra|banc/i, Link2], [/sugest|melhor/i, Lightbulb], [/d[uú]vida/i, HelpCircle]];
const catIcon = (c) => (CAT_ICON.find(([re]) => re.test(c || '')) || [null, FolderOpen])[1];
const PALETTE = ['#22d3ee', '#a855f7', '#3b82f6', '#c084fc', '#2dd4bf', '#f472b6', '#fbbf24', '#64748b'];
const SLA_MIN = 24 * 60; // meta: 1ª resposta em até 24 h
const initials = (n) => String(n || '?').split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
const hueOf = (s) => [...String(s || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
const dur = (min) => (min == null ? '—' : min < 60 ? `${Math.round(min)} min` : min < 1440 ? `${Math.floor(min / 60)} h ${Math.round(min % 60)} min` : `${(min / 1440).toFixed(1).replace('.', ',')} d`);
const ago = (d) => { if (!d) return ''; const m = Math.round((Date.now() - new Date(d)) / 60000); return m < 60 ? `há ${Math.max(1, m)} min` : m < 1440 ? `há ${Math.round(m / 60)} h` : `há ${Math.round(m / 1440)} d`; };
const PER = 8;

export default function TicketsCenter() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const ticketsQ = useQuery({ queryKey: ['support-tickets'], queryFn: () => Support.tickets() });
  const cfgQ = useQuery({ queryKey: ['support-config'], queryFn: () => Support.config() });
  const tickets = ticketsQ.data?.tickets || [];
  const isAdmin = ticketsQ.data?.isAdmin ?? (user?.role === 'admin');
  const admins = ticketsQ.data?.admins || [];
  const adminMap = useMemo(() => Object.fromEntries(admins.map((a) => [a.id, a])), [admins]);
  const categories = cfgQ.data?.categories || [];
  const statuses = cfgQ.data?.statuses || [];
  const statusMap = useMemo(() => Object.fromEntries(statuses.map((s) => [s.key, s])), [statuses]);
  const stOf = (key) => statusMap[key] || { key, label: key, color: 'slate' };

  const [q, setQ] = useState('');
  const [fStatus, setFStatus] = useState('all');
  const [fCat, setFCat] = useState('all');
  const [scope, setScope] = useState('all');
  const [fAssigned, setFAssigned] = useState('all');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [cfgOpen, setCfgOpen] = useState(false);
  const [macrosOpen, setMacrosOpen] = useState(false);
  // atalho vindo da tela de Ajuda: /chamados?novo=1
  useEffect(() => { if (params.get('novo')) { setCreateOpen(true); params.delete('novo'); setParams(params, { replace: true }); } }, [params, setParams]);

  const shown = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return tickets.filter((t) => {
      if (fStatus !== 'all' && t.status !== fStatus) return false;
      if (fCat !== 'all' && t.category !== fCat) return false;
      if (isAdmin && scope === 'mine' && t.created_by_id !== user?.id) return false;
      if (isAdmin && scope === 'users' && t.created_by_id === user?.id) return false;
      if (isAdmin && fAssigned === 'mine' && t.assigned_to_id !== user?.id) return false;
      if (isAdmin && fAssigned === 'unassigned' && t.assigned_to_id) return false;
      if (qq) { const hay = `#${t.number || ''} ${t.subject || ''} ${t.user_name || ''} ${t.user_email || ''}`.toLowerCase(); if (!hay.includes(qq.replace('#', ''))) return false; }
      return true;
    });
  }, [tickets, q, fStatus, fCat, scope, fAssigned, isAdmin, user]);
  const pages = Math.max(1, Math.ceil(shown.length / PER)); const cur = Math.min(page, pages);
  const rows = shown.slice((cur - 1) * PER, cur * PER);

  // métricas reais: últimos 30 dias contra os 30 anteriores
  const m = useMemo(() => {
    const isFinal = (t) => !!stOf(t.status).final;
    const now = Date.now(); const d30 = now - 30 * 864e5; const d60 = now - 60 * 864e5;
    const inWin = (t, a, b) => { const c = new Date(t.created_date).getTime(); return c >= a && c < b; };
    const cur30 = tickets.filter((t) => inWin(t, d30, now + 1)); const prev30 = tickets.filter((t) => inWin(t, d60, d30));
    const delta = (a, b) => (b > 0 ? ((a - b) / b) * 100 : null);
    const firstMin = (t) => (t.first_reply_date ? (new Date(t.first_reply_date) - new Date(t.created_date)) / 60000 : null);
    const replied = tickets.map(firstMin).filter((x) => x != null && x >= 0);
    const resolved = tickets.filter((t) => isFinal(t) && t.resolved_date).map((t) => (new Date(t.resolved_date) - new Date(t.created_date)) / 60000).filter((x) => x >= 0);
    // SLA: respondido em até 24 h, ou ainda aberto e dentro das 24 h
    let inSla = 0, outSla = 0;
    for (const t of tickets) { const f = firstMin(t); if (f != null) (f <= SLA_MIN ? inSla++ : outSla++); else if (!isFinal(t)) ((now - new Date(t.created_date)) / 60000 <= SLA_MIN ? inSla++ : outSla++); }
    const byCat = {}; for (const t of tickets) byCat[t.category || 'Outro'] = (byCat[t.category || 'Outro'] || 0) + 1;
    const byStatus = {}; for (const t of tickets) byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    const high = tickets.filter((t) => ['alta', 'urgente'].includes(t.priority) && !isFinal(t)).length;
    return {
      total: tickets.length, open: tickets.filter((t) => !isFinal(t)).length, waiting: byStatus.answered || 0, done: tickets.filter(isFinal).length, high,
      dTotal: delta(cur30.length, prev30.length), dOpen: delta(cur30.filter((t) => !isFinal(t)).length, prev30.filter((t) => !isFinal(t)).length),
      avgResolve: resolved.length ? resolved.reduce((a, b) => a + b, 0) / resolved.length : null,
      avgFirst: replied.length ? replied.reduce((a, b) => a + b, 0) / replied.length : null,
      inSla, outSla, byCat: Object.entries(byCat).sort((a, b) => b[1] - a[1]), byStatus,
      recent: [...tickets].sort((a, b) => String(b.updated_date).localeCompare(String(a.updated_date))).slice(0, 4),
    };
  }, [tickets, statusMap]);
  const slaPct = m.inSla + m.outSla ? Math.round((m.inSla / (m.inSla + m.outSla)) * 100) : null;
  const catData = m.byCat.slice(0, 5).map(([name, value], i) => ({ name, value, color: PALETTE[i] }));
  if (m.byCat.length > 5) catData.push({ name: 'Demais', value: m.byCat.slice(5).reduce((s, x) => s + x[1], 0), color: PALETTE[7] });

  const delTicket = useMutation({ mutationFn: (id) => Support.deleteTicket(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['support-tickets'] }); toast.success('Chamado excluído. Um e-mail de aviso foi enviado.'); }, onError: (e) => toast.error(e.message || 'Falha ao excluir') });
  const assignMe = useMutation({ mutationFn: (id) => Support.assignTicket(id, user?.id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['support-tickets'] }); toast.success('Chamado atribuído a você.'); }, onError: (e) => toast.error(e.message || 'Falha') });
  const confirmDel = (t) => { if (window.confirm(`Excluir o chamado #${t.number || ''} — ${t.subject}? Um e-mail de aviso será enviado. Esta ação não pode ser desfeita.`)) delTicket.mutate(t.id); };
  const chip = (v, invert) => v == null || !Number.isFinite(v) ? null : <span className={`text-[11px] font-bold inline-flex items-center gap-0.5 ${(invert ? v <= 0 : v >= 0) ? 'text-emerald-500' : 'text-rose-500'}`}>{v >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}{v >= 0 ? '+' : ''}{Math.round(v)}%</span>;
  const KPIS = [
    [Layers, 'Total', m.total, '#38bdf8', chip(m.dTotal)], [FolderOpen, 'Em aberto', m.open, '#fbbf24', chip(m.dOpen, true)], [Clock, 'Aguardando resposta', m.waiting, '#a78bfa'],
    [CheckCircle2, 'Finalizados', m.done, '#34d399'], [Zap, 'Resolução média', dur(m.avgResolve), '#818cf8'], [Timer, 'Primeira resposta', dur(m.avgFirst), '#22d3ee'], [AlertTriangle, 'Prioridade alta', m.high, '#fb7185'],
  ];

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="relative">
        <HeroTitle icon={Ticket} lead="Central de" accent="Tickets" iconClass="text-sky-400" subtitle={isAdmin ? 'Gerencie, responda e resolva os chamados.' : 'Abra e acompanhe seus chamados.'}
          actions={<div className="flex flex-wrap gap-2 relative z-[1]">{isAdmin && <Button variant="outline" onClick={() => setMacrosOpen(true)}><MessageSquareText className="w-4 h-4" /> Respostas prontas</Button>}{isAdmin && <Button variant="outline" onClick={() => setCfgOpen(true)}><Settings2 className="w-4 h-4" /> Categorias & Status</Button>}<GlowButton tone="sky" onClick={() => setCreateOpen(true)} className="py-2.5"><Plus className="w-4 h-4" />Novo chamado</GlowButton></div>} />
        <SupportBotArt className="hidden 2xl:block absolute left-[36%] -top-6 w-80 h-40 pointer-events-none opacity-90" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-9 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 2xl:grid-cols-7 gap-3">
            {KPIS.map(([Ic, l, v, c, d]) => (
              <div key={l} className="rounded-2xl ring-1 bg-[hsl(var(--card))] p-3.5" style={{ '--tw-ring-color': `${c}66`, backgroundImage: `linear-gradient(160deg,${c}24,transparent 70%)`, boxShadow: `0 0 22px -12px ${c}` }}>
                <Ic className="w-6 h-6" style={{ color: c }} />
                <p className="text-xs text-muted mt-2 leading-tight min-h-[2rem]">{l}</p>
                <div className="flex items-end justify-between gap-1"><b className="font-display text-2xl leading-none whitespace-nowrap">{ticketsQ.isLoading ? '…' : v}</b>{d}</div>
              </div>
            ))}
          </div>

          <section className="rounded-2xl ring-1 ring-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-[200px] rounded-xl ring-1 ring-[hsl(var(--border))] px-3 py-2"><Search className="w-4 h-4 text-muted shrink-0" /><input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Buscar por número (#1001) ou assunto..." className="flex-1 bg-transparent outline-none text-sm" /></div>
            <Select value={fStatus} onChange={(e) => { setFStatus(e.target.value); setPage(1); }} className="w-auto"><option value="all">Todos os status</option>{statuses.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</Select>
            <Select value={fCat} onChange={(e) => { setFCat(e.target.value); setPage(1); }} className="w-auto"><option value="all">Todas as categorias</option>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</Select>
            {isAdmin && <Select value={scope} onChange={(e) => { setScope(e.target.value); setPage(1); }} className="w-auto"><option value="all">Todos</option><option value="users">De usuários</option><option value="mine">Abertos por mim</option></Select>}
            {isAdmin && <Select value={fAssigned} onChange={(e) => { setFAssigned(e.target.value); setPage(1); }} className="w-auto"><option value="all">Qualquer responsável</option><option value="mine">Atribuídos a mim</option><option value="unassigned">Não atribuídos</option></Select>}
          </section>

          <Panel tone="violet" title={`Chamados (${shown.length})`} icon={Ticket} iconClass="text-sky-400" action={<button onClick={() => ticketsQ.refetch()} className="text-xs text-muted flex items-center gap-1.5 hover:text-[hsl(var(--text))]">Atualizado {ticketsQ.dataUpdatedAt ? ago(ticketsQ.dataUpdatedAt) : ''}<RefreshCw className={`w-4 h-4 ${ticketsQ.isFetching ? 'animate-spin' : ''}`} /></button>}>
            {ticketsQ.isLoading ? <div className="flex justify-center py-10"><Spinner className="w-6 h-6 text-sky-500" /></div>
              : tickets.length === 0 ? <EmptyState icon={Ticket} title="Nenhum chamado" subtitle="Abra um chamado para começar." action={<Button onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4" /> Novo chamado</Button>} />
              : shown.length === 0 ? <EmptyState icon={Filter} title="Nada neste filtro" />
              : (
                <>
                  <div className="overflow-x-auto -mx-1"><table className="w-full text-[13px] min-w-[900px]">
                    <thead><tr className="text-left text-xs text-muted border-b border-[hsl(var(--border))]"><th className="py-2 pl-3 font-medium">#</th><th className="py-2 font-medium">Assunto</th><th className="py-2 font-medium">Categoria</th>{isAdmin && <th className="py-2 font-medium">Solicitante</th>}<th className="py-2 font-medium">Abertura</th><th className="py-2 font-medium">Prioridade</th>{isAdmin && <th className="py-2 font-medium">Responsável</th>}<th className="py-2 font-medium">Status</th><th className="py-2" /></tr></thead>
                    <tbody>{rows.map((t) => { const [pl, pc] = PRIO[t.priority] || PRIO.normal; const CI = catIcon(t.category); const resp = adminMap[t.assigned_to_id]; const st = stOf(t.status); const sc = HEX[st.color] || HEX.slate; return (
                      <tr key={t.id} className="border-b border-[hsl(var(--border))] last:border-0 hover:bg-black/[.03] dark:hover:bg-white/[.03] cursor-pointer" onClick={() => setOpenId(t.id)}>
                        <td className="py-2.5 pl-3 font-mono text-xs relative"><span className="absolute left-0 top-2 bottom-2 w-1 rounded-full" style={{ background: pc }} />#{t.number || '—'}</td>
                        <td className="py-2.5 max-w-[220px]"><b className="block truncate">{t.subject}</b><span className="text-[11px] text-muted">atualizado {ago(t.updated_date)}</span></td>
                        <td className="py-2.5"><span className="inline-flex items-center gap-1.5"><CI className="w-4 h-4 text-sky-400" />{t.category || 'Outro'}</span></td>
                        {isAdmin && <td className="py-2.5"><span className="inline-flex items-center gap-2 max-w-[170px]"><span className="w-7 h-7 rounded-full grid place-items-center text-[10px] font-bold text-white shrink-0" style={{ background: `hsl(${hueOf(t.user_email)} 60% 45%)` }}>{initials(t.user_name || t.user_email)}</span><span className="truncate">{t.user_name || t.user_email}</span></span></td>}
                        <td className="py-2.5 text-xs whitespace-nowrap">{t.created_date ? new Date(t.created_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '—'}<br /><span className="text-muted">{t.created_date ? new Date(t.created_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}</span></td>
                        <td className="py-2.5"><span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ring-1" style={{ color: pc, '--tw-ring-color': `${pc}66`, background: `${pc}1a` }}><ChevronsRight className="w-3 h-3" />{pl}</span></td>
                        {isAdmin && <td className="py-2.5 text-xs">{resp ? <span className="inline-flex items-center gap-1.5"><span className="w-6 h-6 rounded-full grid place-items-center text-[9px] font-bold text-white" style={{ background: `hsl(${hueOf(resp.email)} 55% 45%)` }}>{initials(resp.name)}</span>{String(resp.name).split(' ')[0]}</span> : <span className="text-muted">—</span>}</td>}
                        <td className="py-2.5"><span className="inline-flex text-[11px] font-semibold px-2.5 py-1 rounded-full ring-1 leading-tight text-center" style={{ color: sc, '--tw-ring-color': `${sc}66`, background: `${sc}1a` }}>{st.label}</span></td>
                        <td className="py-2.5 pr-2" onClick={(e) => e.stopPropagation()}><div className="flex items-center gap-1 justify-end"><button onClick={() => setOpenId(t.id)} className="p-1.5 rounded-lg text-muted hover:text-[hsl(var(--text))]" aria-label="Abrir conversa"><MessageCircle className="w-4 h-4" /></button>
                          <KebabMenu items={[{ label: 'Abrir conversa', icon: MessageCircle, onClick: () => setOpenId(t.id) }, isAdmin && t.assigned_to_id !== user?.id && { label: 'Atribuir a mim', icon: UserPlus, onClick: () => assignMe.mutate(t.id) }, { label: 'Excluir chamado', icon: Trash2, danger: true, onClick: () => confirmDel(t) }]} /></div></td>
                      </tr>); })}</tbody>
                  </table></div>
                  <div className="flex items-center justify-between mt-3 flex-wrap gap-2"><span className="text-xs text-muted">Mostrando {(cur - 1) * PER + 1}–{Math.min(cur * PER, shown.length)} de {shown.length} chamados</span>{pages > 1 && <Pager page={cur} pages={pages} onPage={setPage} />}</div>
                </>
              )}
          </Panel>
        </div>

        <div className="xl:col-span-3 space-y-4">
          <Panel tone="sky" title="Volume por categoria" icon={LayoutGrid} iconClass="text-sky-400">
            <div className="flex items-center gap-4"><Donut size={120} thickness={0.24} data={catData} center={<><b className="font-display text-xl">{m.total}</b><span className="text-[10px] text-muted">chamados</span></>} />
              <div className="flex-1 space-y-1 text-xs min-w-0">{catData.map((c) => <p key={c.name} className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} /><span className="flex-1 truncate">{c.name}</span><b>{Math.round((c.value / Math.max(1, m.total)) * 100)}%</b><span className="text-muted">({c.value})</span></p>)}{!catData.length && <span className="text-muted">Sem dados.</span>}</div></div>
          </Panel>
          <Panel tone="violet" title="Fila por status" icon={ListChecks} iconClass="text-sky-400">
            <div className="space-y-2.5">{statuses.map((s) => { const n = m.byStatus[s.key] || 0; const c = HEX[s.color] || HEX.slate; return <button key={s.key} onClick={() => { setFStatus(s.key); setPage(1); }} className="w-full flex items-center gap-2 text-sm text-left"><span className="w-28 truncate">{s.label}</span><span className="flex-1 h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden"><span className="block h-full rounded-full" style={{ width: `${(n / Math.max(1, m.total)) * 100}%`, background: c, boxShadow: `0 0 8px ${c}` }} /></span><b className="w-6 text-right">{n}</b></button>; })}</div>
          </Panel>
          <Panel tone="violet" title="Atividade recente" icon={Activity} iconClass="text-sky-400">
            {m.recent.length === 0 ? <p className="text-sm text-muted">Sem atividade.</p> : <ol className="relative border-l border-sky-400/40 ml-1.5 space-y-3">{m.recent.map((t) => <li key={t.id} className="pl-4 relative"><span className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-sky-400" /><button onClick={() => setOpenId(t.id)} className="text-left w-full"><p className="text-sm font-medium flex justify-between gap-2"><span className="truncate">#{t.number} · {t.subject}</span><span className="text-[11px] text-muted shrink-0">{ago(t.updated_date)}</span></p><p className="text-xs text-muted">Status: {stOf(t.status).label}{t.assigned_to_id && adminMap[t.assigned_to_id] ? ` · ${adminMap[t.assigned_to_id].name}` : ''}</p></button></li>)}</ol>}
          </Panel>
          <Panel tone="emerald" title="SLA de atendimento" icon={Zap} iconClass="text-sky-400" subtitle={`Meta: 1ª resposta em até 24 h${slaPct != null ? ` · ${slaPct}% no prazo` : ''}`}>
            <div className="h-3 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400" style={{ width: `${slaPct ?? 0}%` }} /></div>
            <div className="grid grid-cols-3 gap-2 mt-3 text-xs"><div><p className="text-muted">Dentro do prazo</p><b className="text-emerald-500 text-sm">{m.inSla}</b></div><div><p className="text-muted">Fora do prazo</p><b className="text-rose-500 text-sm">{m.outSla}</b></div><div><p className="text-muted">1ª resposta média</p><b className="text-sm">{dur(m.avgFirst)}</b></div></div>
          </Panel>
        </div>
      </div>

      {createOpen && <CreateTicket categories={categories} onClose={() => setCreateOpen(false)} onDone={() => { qc.invalidateQueries({ queryKey: ['support-tickets'] }); setCreateOpen(false); }} />}
      {openId && <TicketThread id={openId} isAdmin={isAdmin} statuses={statuses} categories={categories} stOf={stOf} admins={admins} onClose={() => setOpenId(null)} />}
      {cfgOpen && <ConfigModal categories={categories} statuses={statuses} onClose={() => setCfgOpen(false)} onDone={() => { qc.invalidateQueries({ queryKey: ['support-config'] }); setCfgOpen(false); }} />}
      {macrosOpen && <MacrosModal onClose={() => setMacrosOpen(false)} />}
    </div>
  );
}

function CreateTicket({ categories, onClose, onDone }) {
  const [form, setForm] = useState({ subject: '', category: categories[0] || 'Duvida', description: '', image_url: '' });
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const create = useMutation({ mutationFn: () => Support.createTicket(form), onSuccess: () => { toast.success('Chamado aberto!'); onDone(); }, onError: (e) => toast.error(e.message || 'Falha') });
  const onImg = async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; setBusy(true); try { const url = await readImage(f); setForm((s) => ({ ...s, image_url: url })); } catch {} finally { setBusy(false); } };
  return (
    <Modal open onClose={onClose} title="Abrir chamado" maxWidth="max-w-lg"
      footer={<><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={() => create.mutate()} disabled={create.isPending || !form.subject || !form.description}>{create.isPending ? <Spinner className="w-4 h-4" /> : 'Enviar chamado'}</Button></>}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Assunto"><Input value={form.subject} onChange={(e) => setForm((s) => ({ ...s, subject: e.target.value }))} placeholder="Resumo" /></Field>
          <Field label="Categoria"><Select value={form.category} onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))}>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</Select></Field>
        </div>
        <Field label="Descrição"><Textarea rows={5} value={form.description} onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))} placeholder="Descreva com o máximo de detalhes." /></Field>
        <Field label="Anexo (opcional)">
          {form.image_url ? (
            <div className="flex items-center gap-3 p-2 rounded-lg border border-[hsl(var(--border))]">
              {form.image_url.startsWith('data:application/pdf') ? <span className="w-12 h-12 rounded-lg bg-rose-500/10 flex items-center justify-center"><Paperclip className="w-5 h-5 text-rose-500" /></span> : <img src={form.image_url} alt="" className="w-12 h-12 rounded-lg object-cover" />}
              <span className="text-sm text-muted flex-1">Anexo pronto</span>
              <button onClick={() => setForm((s) => ({ ...s, image_url: '' }))} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10"><X className="w-4 h-4" /></button>
            </div>
          ) : (<><input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={onImg} /><button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 border-dashed border-[hsl(var(--border))] text-sm text-muted hover:bg-black/5 dark:hover:bg-white/5">{busy ? <Spinner className="w-4 h-4" /> : <><ImageIcon className="w-4 h-4" /> Anexar</>}</button></>)}
        </Field>
      </div>
    </Modal>
  );
}

function TicketThread({ id, isAdmin, statuses, categories, stOf, admins = [], onClose }) {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['ticket', id], queryFn: () => Support.ticket(id) });
  const macrosQ = useQuery({ queryKey: ['ticket-macros'], queryFn: () => Support.macros(), enabled: isAdmin });
  const macros = macrosQ.data?.macros || [];
  const ticket = query.data?.ticket;
  const messages = query.data?.messages || [];
  const [reply, setReply] = useState('');
  const [img, setImg] = useState('');
  const [internalNote, setInternalNote] = useState(false);
  const [macrosMenuOpen, setMacrosMenuOpen] = useState(false);
  const fileRef = useRef(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['ticket', id] }); qc.invalidateQueries({ queryKey: ['support-tickets'] }); };
  const sendReply = useMutation({
    mutationFn: () => Support.replyTicket({ id, body: reply, image_url: img || undefined, internal: internalNote }),
    onSuccess: (r) => { setReply(''); setImg(''); setInternalNote(false); refresh(); if (r?.emailStatus === 'failed') toast.error('Resposta salva, mas o e-mail falhou — você pode reenviar.'); else if (r?.internal) toast.success('Nota interna salva.'); },
    onError: (e) => toast.error(e.message || 'Falha'),
  });
  const assign = useMutation({ mutationFn: (assignedToId) => Support.assignTicket(id, assignedToId), onSuccess: refresh, onError: (e) => toast.error(e.message || 'Falha') });
  const [resendingId, setResendingId] = useState(null);
  const resendEmail = useMutation({
    mutationFn: (msgId) => Support.resendTicketEmail(msgId),
    onMutate: (msgId) => setResendingId(msgId),
    onSuccess: (r) => { refresh(); if (r?.emailStatus === 'sent') toast.success('E-mail reenviado com sucesso.'); else if (r?.emailStatus === 'skipped') toast.error('Sem provedor de e-mail configurado.'); else toast.error('Falha ao reenviar: ' + (r?.emailError || 'erro desconhecido')); },
    onError: (e) => toast.error(e.message || 'Falha ao reenviar'),
    onSettled: () => setResendingId(null),
  });
  const setStatus = useMutation({ mutationFn: (payload) => Support.setTicketStatus(id, payload), onSuccess: refresh, onError: (e) => toast.error(e.message || 'Falha') });
  const meta = useMutation({ mutationFn: (data) => Support.updateTicket(id, data), onSuccess: refresh });
  const onImg = async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; try { setImg(await readImage(f)); } catch {} };
  const firstOpen = statuses.find((s) => !s.final) || { key: 'open', label: 'Novo' };

  return (
    <Modal open onClose={onClose} title={ticket ? `#${ticket.number || ''} — ${ticket.subject}` : 'Chamado'} maxWidth="max-w-xl"
      footer={
        <div className="flex items-center gap-2 w-full flex-wrap justify-end">
          {!isAdmin && ticket && stOf(ticket.status).final && <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ status: firstOpen.key, statusLabel: firstOpen.label, final: false })}><RotateCcw className="w-4 h-4" /> Reabrir</Button>}
          <Button onClick={onClose}>Fechar</Button>
        </div>
      }>
      {query.isLoading ? <div className="flex justify-center py-8"><Spinner className="w-6 h-6 text-emerald-500" /></div> : ticket && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusChip st={stOf(ticket.status)} />
            <span className="text-xs text-muted">{ticket.category} · aberto {fmtDate(ticket.created_date)}{ticket.resolved_date ? ` · finalizado ${fmtDate(ticket.resolved_date)}` : ''}</span>
          </div>
          {isAdmin && (
            <div className="rounded-lg bg-black/5 dark:bg-white/5 p-2.5 space-y-2">
              <div className="flex items-center gap-1.5 text-xs"><UserCircle className="w-3.5 h-3.5 text-emerald-500" /><b className="text-[hsl(var(--text))]">{ticket.user_name || 'Sem nome'}</b><a href={`mailto:${ticket.user_email}`} className="text-sky-500 hover:underline flex items-center gap-1"><Mail className="w-3 h-3" /> {ticket.user_email}</a></div>
              <div className="grid grid-cols-2 gap-2">
                <Select value={ticket.status} onChange={(e) => { const st = statuses.find((s) => s.key === e.target.value); setStatus.mutate({ status: st.key, statusLabel: st.label, final: !!st.final }); }}>{statuses.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</Select>
                <Select value={ticket.category || ''} onChange={(e) => meta.mutate({ category: e.target.value })}>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</Select>
                <Select value={ticket.priority || 'normal'} onChange={(e) => meta.mutate({ priority: e.target.value })}>{['baixa', 'normal', 'alta', 'urgente'].map((p) => <option key={p} value={p}>Prio: {p}</option>)}</Select>
                <Select value={ticket.assigned_to_id || ''} onChange={(e) => assign.mutate(e.target.value || null)}>
                  <option value="">Sem responsável</option>
                  {admins.map((a) => <option key={a.id} value={a.id}>Responsável: {a.name}</option>)}
                </Select>
              </div>
            </div>
          )}
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {messages.map((m) => {
              const mine = m.author_role === (isAdmin ? 'admin' : 'user');
              const isInternal = !!m.internal;
              return (
                <div key={m.id} className={`flex ${isInternal ? 'justify-center' : mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[90%] rounded-2xl px-3 py-2 ${isInternal ? 'bg-amber-500/10 border border-dashed border-amber-500/40 w-full' : m.author_role === 'admin' ? 'bg-emerald-500/15' : 'bg-black/5 dark:bg-white/10'}`}>
                    <p className="text-[11px] font-semibold text-muted flex items-center gap-1">
                      {isInternal ? <Lock className="w-3 h-3 text-amber-500" /> : m.author_role === 'admin' && <Shield className="w-3 h-3 text-emerald-500" />}
                      {m.author_name || (m.author_role === 'admin' ? 'Suporte' : 'Você')}
                      {isInternal && <span className="text-[10px] font-normal text-amber-500">· nota interna (so admins veem)</span>}
                    </p>
                    <p className="text-sm whitespace-pre-line">{m.body}</p>
                    {m.image_url && (m.image_url.startsWith('data:application/pdf') ? <a href={m.image_url} target="_blank" rel="noreferrer" className="text-xs text-sky-500 underline">ver anexo (PDF)</a> : <img src={m.image_url} alt="" className="mt-1 rounded-lg max-h-40" />)}
                    <p className="text-[10px] text-muted mt-0.5">{fmtDate(m.created_date)}</p>
                    <EmailStatus status={m.email_status} error={m.email_error} resending={resendingId === m.id} onResend={() => resendEmail.mutate(m.id)} />
                  </div>
                </div>
              );
            })}
          </div>
          {(!stOf(ticket.status).final || isAdmin) && (
            <div className="border-t border-[hsl(var(--border))] pt-3 space-y-2">
              <Textarea rows={2} value={reply} onChange={(e) => setReply(e.target.value)} placeholder={internalNote ? 'Escreva uma nota interna (so a equipe ve)...' : 'Escreva uma resposta...'} className={internalNote ? 'ring-1 ring-amber-500/40' : ''} />
              <div className="flex items-center gap-2 flex-wrap">
                <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={onImg} />
                <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><Paperclip className="w-4 h-4" /> {img ? 'Anexado' : 'Anexar'}</Button>
                {img && <button onClick={() => setImg('')} className="text-rose-500 text-xs">remover</button>}
                {isAdmin && macros.length > 0 && (
                  <div className="relative">
                    <Button size="sm" variant="outline" onClick={() => setMacrosMenuOpen((v) => !v)}><MessageSquareText className="w-4 h-4" /> Respostas prontas <ChevronDown className="w-3 h-3" /></Button>
                    {macrosMenuOpen && (
                      <div className="absolute left-0 bottom-full mb-1 z-20 min-w-[14rem] max-h-56 overflow-y-auto rounded-xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-xl p-1">
                        {macros.map((m) => (
                          <button key={m.id} onClick={() => { setReply((r) => (r ? `${r}
${m.body}` : m.body)); setMacrosMenuOpen(false); }} className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-black/5 dark:hover:bg-white/5">
                            <p className="font-medium truncate">{m.title}</p>
                            <p className="text-[11px] text-muted truncate">{m.body}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {isAdmin && (
                  <label className="flex items-center gap-1 text-xs text-muted cursor-pointer" title="Nota interna: visivel so pra admins, nao envia e-mail nem muda o status do chamado">
                    <input type="checkbox" className="w-3.5 h-3.5 accent-amber-500" checked={internalNote} onChange={(e) => setInternalNote(e.target.checked)} /> <Lock className="w-3 h-3" /> nota interna
                  </label>
                )}
                <div className="flex-1" />
                <Button size="sm" onClick={() => sendReply.mutate()} disabled={sendReply.isPending || !reply.trim()} className={internalNote ? 'bg-amber-500 hover:bg-amber-600 border-amber-500' : ''}>{sendReply.isPending ? <Spinner className="w-4 h-4" /> : <><Send className="w-4 h-4" /> {internalNote ? 'Salvar nota' : 'Enviar'}</>}</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function ConfigModal({ categories, statuses, onClose, onDone }) {
  const [cats, setCats] = useState([...categories]);
  const [sts, setSts] = useState(statuses.map((s) => ({ ...s })));
  const [newCat, setNewCat] = useState('');
  const save = useMutation({ mutationFn: () => Support.saveConfig({ categories: cats, statuses: sts }), onSuccess: () => { toast.success('Configuração salva'); onDone(); }, onError: (e) => toast.error(e.message || 'Falha') });
  const addCat = () => { const v = newCat.trim(); if (v && !cats.includes(v)) { setCats([...cats, v]); setNewCat(''); } };
  const setSt = (i, patch) => setSts((a) => a.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  const addSt = () => setSts([...sts, { key: `st_${Date.now()}`, label: 'Novo status', color: 'slate', final: false }]);
  return (
    <Modal open onClose={onClose} title="Categorias & Status" maxWidth="max-w-lg"
      footer={<><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? <Spinner className="w-4 h-4" /> : 'Salvar'}</Button></>}>
      <div className="space-y-4">
        <div>
          <p className="font-semibold text-sm mb-2">Categorias dos chamados</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {cats.map((c, i) => <span key={i} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-black/5 dark:bg-white/5">{c}<button onClick={() => setCats(cats.filter((_, idx) => idx !== i))} className="text-rose-500"><X className="w-3 h-3" /></button></span>)}
            {cats.length === 0 && <span className="text-xs text-muted">Nenhuma.</span>}
          </div>
          <div className="flex gap-2"><Input value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCat()} placeholder="Nova categoria" /><Button variant="outline" onClick={addCat}><Plus className="w-4 h-4" /></Button></div>
        </div>
        <div>
          <p className="font-semibold text-sm mb-2">Status dos chamados</p>
          <div className="space-y-2">
            {sts.map((s, i) => {
              const key = s.key || slug(s.label);
              return (
                <div key={i} className="flex items-center gap-2 rounded-lg bg-black/5 dark:bg-white/5 p-2">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: HEX[s.color] || HEX.slate }} />
                  <Input value={s.label} onChange={(e) => setSt(i, { label: e.target.value, key: s.key || slug(e.target.value) })} className="flex-1" />
                  <Select value={s.color} onChange={(e) => setSt(i, { color: e.target.value })} className="w-24">{COLOR_KEYS.map((c) => <option key={c} value={c}>{c}</option>)}</Select>
                  <label className="flex items-center gap-1 text-[11px] text-muted shrink-0" title="Encerra o chamado"><input type="checkbox" className="w-4 h-4 accent-emerald-500" checked={!!s.final} onChange={(e) => setSt(i, { final: e.target.checked })} /> final</label>
                  <button onClick={() => setSts(sts.filter((_, idx) => idx !== i))} className="text-rose-500 shrink-0"><Trash2 className="w-4 h-4" /></button>
                </div>
              );
            })}
          </div>
          <Button size="sm" variant="outline" onClick={addSt} className="mt-2"><Plus className="w-4 h-4" /> Adicionar status</Button>
          <p className="text-xs text-muted mt-2">"final" = status que encerra o chamado (o usuário pode reabrir). Ex.: Resolvido, Finalizado.</p>
        </div>
      </div>
    </Modal>
  );
}

function MacrosModal({ onClose }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['ticket-macros'], queryFn: () => Support.macros() });
  const [items, setItems] = useState(null);
  const list = items ?? q.data?.macros ?? [];
  const save = useMutation({
    mutationFn: () => Support.saveMacros(list),
    onSuccess: () => { toast.success('Respostas prontas salvas.'); qc.invalidateQueries({ queryKey: ['ticket-macros'] }); onClose(); },
    onError: (e) => toast.error(e.message || 'Falha'),
  });
  const setItem = (i, patch) => setItems(list.map((m, idx) => idx === i ? { ...m, ...patch } : m));
  const addItem = () => setItems([...list, { id: `m_${Date.now()}`, title: 'Nova resposta', body: '' }]);
  const delItem = (i) => setItems(list.filter((_, idx) => idx !== i));
  return (
    <Modal open onClose={onClose} title="Respostas prontas" maxWidth="max-w-lg"
      footer={<><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? <Spinner className="w-4 h-4" /> : 'Salvar'}</Button></>}>
      {q.isLoading ? <div className="flex justify-center py-6"><Spinner className="w-5 h-5 text-emerald-500" /></div> : (
        <div className="space-y-3">
          <p className="text-xs text-muted">Modelos de resposta rapida que aparecem no botao "Respostas prontas" ao responder um chamado.</p>
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {list.map((m, i) => (
              <div key={m.id} className="rounded-lg bg-black/5 dark:bg-white/5 p-2.5 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Input value={m.title} onChange={(e) => setItem(i, { title: e.target.value })} placeholder="Titulo (ex.: Pedir mais detalhes)" className="flex-1" />
                  <button onClick={() => delItem(i)} className="text-rose-500 shrink-0"><Trash2 className="w-4 h-4" /></button>
                </div>
                <Textarea rows={2} value={m.body} onChange={(e) => setItem(i, { body: e.target.value })} placeholder="Texto que sera inserido na resposta" />
              </div>
            ))}
            {list.length === 0 && <p className="text-xs text-muted text-center py-4">Nenhuma resposta pronta ainda.</p>}
          </div>
          <Button size="sm" variant="outline" onClick={addItem}><Plus className="w-4 h-4" /> Adicionar resposta pronta</Button>
        </div>
      )}
    </Modal>
  );
}
