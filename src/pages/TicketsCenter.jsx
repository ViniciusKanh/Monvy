import { useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Support } from '../api/entities.js';
import { useAuth } from '../context/AuthContext.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Button, Input, Select, Field, Modal, Spinner, EmptyState, Textarea } from '../components/ui';
import { Reveal } from '../components/Animated.jsx';
import { toast } from '../lib/toast.js';
import {
  Ticket, Plus, Search, Settings2, Send, Paperclip, X, Image as ImageIcon, UserCircle, Mail,
  Shield, CheckCircle2, RotateCcw, Trash2, Filter,
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

export default function TicketsCenter() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const ticketsQ = useQuery({ queryKey: ['support-tickets'], queryFn: () => Support.tickets() });
  const cfgQ = useQuery({ queryKey: ['support-config'], queryFn: () => Support.config() });
  const tickets = ticketsQ.data?.tickets || [];
  const isAdmin = ticketsQ.data?.isAdmin ?? (user?.role === 'admin');
  const categories = cfgQ.data?.categories || [];
  const statuses = cfgQ.data?.statuses || [];
  const statusMap = useMemo(() => Object.fromEntries(statuses.map((s) => [s.key, s])), [statuses]);
  const stOf = (key) => statusMap[key] || { key, label: key, color: 'slate' };

  const [q, setQ] = useState('');
  const [fStatus, setFStatus] = useState('all');
  const [fCat, setFCat] = useState('all');
  const [scope, setScope] = useState('all'); // admin: all | mine | users
  const [openId, setOpenId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [cfgOpen, setCfgOpen] = useState(false);

  const shown = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return tickets.filter((t) => {
      if (fStatus !== 'all' && t.status !== fStatus) return false;
      if (fCat !== 'all' && t.category !== fCat) return false;
      if (isAdmin && scope === 'mine' && t.created_by_id !== user?.id) return false;
      if (isAdmin && scope === 'users' && t.created_by_id === user?.id) return false;
      if (qq) { const hay = `#${t.number || ''} ${t.subject || ''} ${t.user_name || ''} ${t.user_email || ''}`.toLowerCase(); if (!hay.includes(qq.replace('#', ''))) return false; }
      return true;
    });
  }, [tickets, q, fStatus, fCat, scope, isAdmin, user]);

  const counts = useMemo(() => { const m = {}; for (const t of tickets) m[t.status] = (m[t.status] || 0) + 1; return m; }, [tickets]);
  const openCount = tickets.filter((t) => !stOf(t.status).final).length;

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageHeader
        title={<span className="flex items-center gap-2"><Ticket className="w-6 h-6 text-indigo-500" /> Central de Tickets</span>}
        subtitle={isAdmin ? 'Gerencie, responda e resolva os chamados' : 'Acompanhe seus chamados'}
        actions={<div className="flex gap-2">{isAdmin && <Button variant="outline" onClick={() => setCfgOpen(true)}><Settings2 className="w-4 h-4" /> Categorias & Status</Button>}<Button onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4" /> Novo chamado</Button></div>}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="py-4"><p className="text-xs text-muted">Total</p><p className="font-display text-2xl font-bold">{tickets.length}</p></Card>
        <Card className="py-4"><p className="text-xs text-muted">Em aberto</p><p className="font-display text-2xl font-bold text-amber-500">{openCount}</p></Card>
        <Card className="py-4"><p className="text-xs text-muted">Aguardando resposta</p><p className="font-display text-2xl font-bold text-violet-500">{counts.answered || 0}</p></Card>
        <Card className="py-4"><p className="text-xs text-muted">Finalizados</p><p className="font-display text-2xl font-bold text-emerald-500">{statuses.filter((s) => s.final).reduce((n, s) => n + (counts[s.key] || 0), 0)}</p></Card>
      </div>

      {/* Filtros */}
      <Card className="py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-[180px] card px-2 py-1.5"><Search className="w-4 h-4 text-muted shrink-0" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por numero (#1001) ou assunto..." className="flex-1 bg-transparent outline-none text-sm" /></div>
          <Select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="w-auto"><option value="all">Todos os status</option>{statuses.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</Select>
          <Select value={fCat} onChange={(e) => setFCat(e.target.value)} className="w-auto"><option value="all">Todas as categorias</option>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</Select>
          {isAdmin && <Select value={scope} onChange={(e) => setScope(e.target.value)} className="w-auto"><option value="all">Todos</option><option value="users">De usuarios</option><option value="mine">Abertos por mim</option></Select>}
        </div>
      </Card>

      {ticketsQ.isLoading ? <div className="flex justify-center py-10"><Spinner className="w-6 h-6 text-emerald-500" /></div>
        : tickets.length === 0 ? <Card><EmptyState icon={Ticket} title="Nenhum chamado" subtitle="Abra um chamado para comecar." action={<Button onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4" /> Novo chamado</Button>} /></Card>
        : shown.length === 0 ? <Card><EmptyState icon={Filter} title="Nada neste filtro" /></Card>
        : (
          <div className="space-y-2">
            {shown.map((t, i) => (
              <Reveal key={t.id} i={Math.min(i, 10)}>
                <button onClick={() => setOpenId(t.id)} className="w-full text-left">
                  <Card className="py-3 hover-lift">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-muted shrink-0 w-14">#{t.number || '—'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{t.subject}</p>
                        <p className="text-xs text-muted truncate">{t.category || 'Sem categoria'}{isAdmin ? ` · ${t.user_name || t.user_email}` : ''} · aberto {fmtDate(t.created_date)}</p>
                      </div>
                      {isAdmin && t.priority && t.priority !== 'normal' && <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: (t.priority === 'urgente' ? HEX.rose : HEX.amber) + '22', color: t.priority === 'urgente' ? HEX.rose : HEX.amber }}>{t.priority}</span>}
                      <StatusChip st={stOf(t.status)} />
                    </div>
                  </Card>
                </button>
              </Reveal>
            ))}
          </div>
        )}

      {createOpen && <CreateTicket categories={categories} onClose={() => setCreateOpen(false)} onDone={() => { qc.invalidateQueries({ queryKey: ['support-tickets'] }); setCreateOpen(false); }} />}
      {openId && <TicketThread id={openId} isAdmin={isAdmin} statuses={statuses} categories={categories} stOf={stOf} onClose={() => setOpenId(null)} />}
      {cfgOpen && <ConfigModal categories={categories} statuses={statuses} onClose={() => setCfgOpen(false)} onDone={() => { qc.invalidateQueries({ queryKey: ['support-config'] }); setCfgOpen(false); }} />}
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
        <Field label="Descricao"><Textarea rows={5} value={form.description} onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))} placeholder="Descreva com o maximo de detalhes." /></Field>
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

function TicketThread({ id, isAdmin, statuses, categories, stOf, onClose }) {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['ticket', id], queryFn: () => Support.ticket(id) });
  const ticket = query.data?.ticket;
  const messages = query.data?.messages || [];
  const [reply, setReply] = useState('');
  const [img, setImg] = useState('');
  const fileRef = useRef(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['ticket', id] }); qc.invalidateQueries({ queryKey: ['support-tickets'] }); };
  const sendReply = useMutation({ mutationFn: () => Support.replyTicket({ id, body: reply, image_url: img || undefined }), onSuccess: () => { setReply(''); setImg(''); refresh(); }, onError: (e) => toast.error(e.message || 'Falha') });
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
              <div className="grid grid-cols-3 gap-2">
                <Select value={ticket.status} onChange={(e) => { const st = statuses.find((s) => s.key === e.target.value); setStatus.mutate({ status: st.key, statusLabel: st.label, final: !!st.final }); }}>{statuses.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</Select>
                <Select value={ticket.category || ''} onChange={(e) => meta.mutate({ category: e.target.value })}>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</Select>
                <Select value={ticket.priority || 'normal'} onChange={(e) => meta.mutate({ priority: e.target.value })}>{['baixa', 'normal', 'alta', 'urgente'].map((p) => <option key={p} value={p}>Prio: {p}</option>)}</Select>
              </div>
            </div>
          )}
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {messages.map((m) => {
              const mine = m.author_role === (isAdmin ? 'admin' : 'user');
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${m.author_role === 'admin' ? 'bg-emerald-500/15' : 'bg-black/5 dark:bg-white/10'}`}>
                    <p className="text-[11px] font-semibold text-muted flex items-center gap-1">{m.author_role === 'admin' && <Shield className="w-3 h-3 text-emerald-500" />}{m.author_name || (m.author_role === 'admin' ? 'Suporte' : 'Voce')}</p>
                    <p className="text-sm whitespace-pre-line">{m.body}</p>
                    {m.image_url && (m.image_url.startsWith('data:application/pdf') ? <a href={m.image_url} target="_blank" rel="noreferrer" className="text-xs text-sky-500 underline">ver anexo (PDF)</a> : <img src={m.image_url} alt="" className="mt-1 rounded-lg max-h-40" />)}
                    <p className="text-[10px] text-muted mt-0.5">{fmtDate(m.created_date)}</p>
                  </div>
                </div>
              );
            })}
          </div>
          {!stOf(ticket.status).final && (
            <div className="border-t border-[hsl(var(--border))] pt-3 space-y-2">
              <Textarea rows={2} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Escreva uma resposta..." />
              <div className="flex items-center gap-2">
                <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={onImg} />
                <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><Paperclip className="w-4 h-4" /> {img ? 'Anexado' : 'Anexar'}</Button>
                {img && <button onClick={() => setImg('')} className="text-rose-500 text-xs">remover</button>}
                <div className="flex-1" />
                <Button size="sm" onClick={() => sendReply.mutate()} disabled={sendReply.isPending || !reply.trim()}>{sendReply.isPending ? <Spinner className="w-4 h-4" /> : <><Send className="w-4 h-4" /> Enviar</>}</Button>
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
  const save = useMutation({ mutationFn: () => Support.saveConfig({ categories: cats, statuses: sts }), onSuccess: () => { toast.success('Configuracao salva'); onDone(); }, onError: (e) => toast.error(e.message || 'Falha') });
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
          <p className="text-xs text-muted mt-2">"final" = status que encerra o chamado (o usuario pode reabrir). Ex.: Resolvido, Finalizado.</p>
        </div>
      </div>
    </Modal>
  );
}
