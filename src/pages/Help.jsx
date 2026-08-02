import { useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Support } from '../api/entities.js';
import { useAuth } from '../context/AuthContext.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Button, Input, Select, Field, Modal, Spinner, Badge, EmptyState, Textarea } from '../components/ui';
import { Reveal } from '../components/Animated.jsx';
import { toast } from '../lib/toast.js';
import {
  LifeBuoy, Search, ChevronDown, Sparkles, Plus, MessageSquarePlus, Ticket, Paperclip, X,
  Send, CheckCircle2, RotateCcw, Pencil, Trash2, Shield, Image as ImageIcon,
} from 'lucide-react';

const STATUS = {
  open: { label: 'Aberto', color: 'amber' },
  answered: { label: 'Respondido', color: 'blue' },
  resolved: { label: 'Resolvido', color: 'emerald' },
  reopened: { label: 'Reaberto', color: 'rose' },
  closed: { label: 'Encerrado', color: 'slate' },
};
const st = (s) => STATUS[s] || STATUS.open;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

// comprime imagem para dataURL leve
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

export default function Help() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const articlesQ = useQuery({ queryKey: ['help-articles'], queryFn: () => Support.articles() });
  const ticketsQ = useQuery({ queryKey: ['support-tickets'], queryFn: () => Support.tickets() });
  const articles = articlesQ.data?.articles || [];
  const tickets = ticketsQ.data?.tickets || [];
  const isAdmin = ticketsQ.data?.isAdmin ?? (user?.role === 'admin');

  const [ask, setAsk] = useState('');
  const [openId, setOpenId] = useState(null);

  // assistente: busca por relevancia (palavras-chave) nos artigos
  const matches = useMemo(() => {
    const q = ask.trim().toLowerCase();
    if (q.length < 2) return [];
    const terms = q.split(/\s+/).filter((t) => t.length > 2);
    return articles.map((a) => {
      const text = `${a.title} ${a.body} ${a.category}`.toLowerCase();
      let score = 0; for (const t of terms) if (text.includes(t)) score += text.split(t).length - 1;
      if (text.includes(q)) score += 5;
      return { a, score };
    }).filter((x) => x.score > 0).sort((x, y) => y.score - x.score).slice(0, 4).map((x) => x.a);
  }, [ask, articles]);

  const grouped = useMemo(() => {
    const m = {}; for (const a of articles) (m[a.category || 'Geral'] = m[a.category || 'Geral'] || []).push(a);
    return Object.entries(m);
  }, [articles]);

  // ---- chamados ----
  const [ticketModal, setTicketModal] = useState(false);
  const [tForm, setTForm] = useState({ subject: '', description: '', image_url: '' });
  const [tBusy, setTBusy] = useState(false);
  const tFileRef = useRef(null);
  const createTicket = useMutation({
    mutationFn: () => Support.createTicket(tForm),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['support-tickets'] }); setTicketModal(false); setTForm({ subject: '', description: '', image_url: '' }); toast.success('Chamado aberto! Acompanhe em Meus chamados.'); },
    onError: (e) => toast.error(e.message || 'Falha ao abrir chamado'),
  });

  const [threadId, setThreadId] = useState(null);

  // ---- admin: artigos ----
  const [artModal, setArtModal] = useState(null); // null | {id?,title,category,body,published}
  const saveArticle = useMutation({
    mutationFn: () => Support.saveArticle(artModal),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['help-articles'] }); setArtModal(null); toast.success('Artigo salvo'); },
    onError: (e) => toast.error(e.message || 'Falha ao salvar'),
  });
  const delArticle = useMutation({
    mutationFn: (id) => Support.deleteArticle(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['help-articles'] }); toast.success('Artigo removido'); },
  });

  const onTicketImage = async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; setTBusy(true); try { const url = await readImage(f); setTForm((s) => ({ ...s, image_url: url })); } catch {} finally { setTBusy(false); } };

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageHeader
        title={<span className="flex items-center gap-2"><LifeBuoy className="w-6 h-6 text-emerald-500" /> Ajuda & Suporte</span>}
        subtitle="Tire duvidas nos artigos ou abra um chamado para o suporte"
        actions={<Button onClick={() => setTicketModal(true)}><MessageSquarePlus className="w-4 h-4" /> Abrir chamado</Button>}
      />

      {/* Assistente / busca */}
      <div className="relative overflow-hidden rounded-3xl p-6 text-white shadow-soft" style={{ background: 'linear-gradient(135deg,#059669 0%,#0d9488 55%,#0ea5e9 100%)' }}>
        <div className="absolute -top-16 -right-12 w-64 h-64 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(255,255,255,.2), transparent 70%)' }} />
        <div className="relative">
          <div className="flex items-center gap-2 text-[11px] tracking-[0.28em] font-medium text-emerald-100"><Sparkles className="w-3.5 h-3.5" /> ASSISTENTE</div>
          <h2 className="font-display text-2xl font-extrabold mt-1">Como posso ajudar?</h2>
          <div className="mt-3 flex items-center gap-2 bg-white/15 rounded-xl px-3 py-2 max-w-xl">
            <Search className="w-4 h-4 text-white/80 shrink-0" />
            <input value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="Ex: como importar a fatura do cartao" className="flex-1 bg-transparent outline-none placeholder-white/60 text-sm" />
          </div>
          {matches.length > 0 && (
            <div className="mt-3 space-y-2 max-w-xl">
              {matches.map((a) => (
                <button key={a.id} onClick={() => { setOpenId(a.id); document.getElementById(`art-${a.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} className="w-full text-left bg-white/10 hover:bg-white/20 transition rounded-xl p-3">
                  <p className="text-sm font-semibold">{a.title}</p>
                  <p className="text-xs text-white/80 line-clamp-2">{a.body}</p>
                </button>
              ))}
            </div>
          )}
          {ask.trim().length >= 2 && matches.length === 0 && (
            <p className="mt-3 text-sm text-white/90 max-w-xl">Nao encontrei um artigo sobre isso. <button onClick={() => { setTForm((s) => ({ ...s, subject: ask })); setTicketModal(true); }} className="underline font-semibold">Abrir um chamado</button> com sua duvida.</p>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Artigos */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Artigos de ajuda</h3>
            {isAdmin && <Button size="sm" variant="outline" onClick={() => setArtModal({ title: '', category: 'Geral', body: '', published: true })}><Plus className="w-4 h-4" /> Novo artigo</Button>}
          </div>
          {articlesQ.isLoading ? <div className="flex justify-center py-8"><Spinner className="w-6 h-6 text-emerald-500" /></div>
            : grouped.length === 0 ? <Card><EmptyState icon={LifeBuoy} title="Sem artigos ainda" /></Card>
            : grouped.map(([cat, list]) => (
              <div key={cat}>
                <p className="text-xs font-bold tracking-widest text-muted mb-2">{cat.toUpperCase()}</p>
                <div className="space-y-2">
                  {list.map((a) => {
                    const open = openId === a.id;
                    return (
                      <Card key={a.id} id={`art-${a.id}`} className="p-0 overflow-hidden">
                        <button onClick={() => setOpenId(open ? null : a.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
                          <span className="flex-1 font-medium flex items-center gap-2">{a.title}{a.published === false && <Badge color="slate">rascunho</Badge>}</span>
                          <ChevronDown className={`w-4 h-4 text-muted transition ${open ? 'rotate-180' : ''}`} />
                        </button>
                        {open && (
                          <div className="px-4 pb-4 -mt-1">
                            <p className="text-sm text-muted whitespace-pre-line leading-relaxed">{a.body}</p>
                            {isAdmin && (
                              <div className="flex gap-2 mt-3">
                                <Button size="sm" variant="outline" onClick={() => setArtModal({ id: a.id, title: a.title, category: a.category, body: a.body, published: a.published !== false })}><Pencil className="w-4 h-4" /> Editar</Button>
                                <Button size="sm" variant="outline" onClick={() => { if (confirm('Remover este artigo?')) delArticle.mutate(a.id); }} className="text-rose-500"><Trash2 className="w-4 h-4" /> Remover</Button>
                              </div>
                            )}
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>

        {/* Chamados */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2"><Ticket className="w-4 h-4 text-indigo-500" /> {isAdmin ? 'Todos os chamados' : 'Meus chamados'}</h3>
            {isAdmin && <Badge color="violet"><Shield className="w-3 h-3" /> admin</Badge>}
          </div>
          {ticketsQ.isLoading ? <div className="flex justify-center py-8"><Spinner className="w-6 h-6 text-emerald-500" /></div>
            : tickets.length === 0 ? <Card><EmptyState icon={Ticket} title="Nenhum chamado" subtitle="Abra um chamado se precisar de ajuda." /></Card>
            : <div className="space-y-2">
              {tickets.map((t) => (
                <Reveal key={t.id}>
                  <button onClick={() => setThreadId(t.id)} className="w-full text-left">
                    <Card className="py-3 hover-lift">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm truncate flex-1">{t.subject}</p>
                        <Badge color={st(t.status).color}>{st(t.status).label}</Badge>
                      </div>
                      <p className="text-xs text-muted mt-1">{isAdmin ? `${t.user_name || t.user_email} · ` : ''}{fmtDate(t.updated_date || t.created_date)}</p>
                    </Card>
                  </button>
                </Reveal>
              ))}
            </div>}
        </div>
      </div>

      {/* Modal abrir chamado */}
      <Modal open={ticketModal} onClose={() => setTicketModal(false)} title="Abrir chamado" maxWidth="max-w-lg"
        footer={<><Button variant="outline" onClick={() => setTicketModal(false)}>Cancelar</Button><Button onClick={() => createTicket.mutate()} disabled={createTicket.isPending || !tForm.subject || !tForm.description}>{createTicket.isPending ? <Spinner className="w-4 h-4" /> : 'Enviar chamado'}</Button></>}>
        <div className="space-y-3">
          <Field label="Assunto"><Input value={tForm.subject} onChange={(e) => setTForm((s) => ({ ...s, subject: e.target.value }))} placeholder="Resumo do problema" /></Field>
          <Field label="Descricao"><Textarea rows={5} value={tForm.description} onChange={(e) => setTForm((s) => ({ ...s, description: e.target.value }))} placeholder="Descreva o que aconteceu, com o maximo de detalhes." /></Field>
          <Field label="Anexo (opcional)" hint="Imagem ou PDF ajudam a entender o problema">
            {tForm.image_url ? (
              <div className="flex items-center gap-3 p-2 rounded-lg border border-[hsl(var(--border))]">
                {tForm.image_url.startsWith('data:application/pdf') ? <span className="w-12 h-12 rounded-lg bg-rose-500/10 flex items-center justify-center"><Paperclip className="w-5 h-5 text-rose-500" /></span> : <img src={tForm.image_url} alt="" className="w-12 h-12 rounded-lg object-cover" />}
                <span className="text-sm text-muted flex-1">Anexo pronto</span>
                <button onClick={() => setTForm((s) => ({ ...s, image_url: '' }))} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <>
                <input ref={tFileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={onTicketImage} />
                <button type="button" onClick={() => tFileRef.current?.click()} disabled={tBusy} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 border-dashed border-[hsl(var(--border))] text-sm text-muted hover:bg-black/5 dark:hover:bg-white/5">{tBusy ? <Spinner className="w-4 h-4" /> : <><ImageIcon className="w-4 h-4" /> Anexar imagem</>}</button>
              </>
            )}
          </Field>
        </div>
      </Modal>

      {/* Modal artigo (admin) */}
      {artModal && (
        <Modal open onClose={() => setArtModal(null)} title={artModal.id ? 'Editar artigo' : 'Novo artigo'} maxWidth="max-w-lg"
          footer={<><Button variant="outline" onClick={() => setArtModal(null)}>Cancelar</Button><Button onClick={() => saveArticle.mutate()} disabled={saveArticle.isPending || !artModal.title}>{saveArticle.isPending ? <Spinner className="w-4 h-4" /> : 'Salvar'}</Button></>}>
          <div className="space-y-3">
            <Field label="Titulo"><Input value={artModal.title} onChange={(e) => setArtModal((s) => ({ ...s, title: e.target.value }))} placeholder="Ex: Como pagar uma fatura" /></Field>
            <Field label="Categoria"><Input value={artModal.category} onChange={(e) => setArtModal((s) => ({ ...s, category: e.target.value }))} placeholder="Ex: Cartao de credito" /></Field>
            <Field label="Conteudo"><Textarea rows={7} value={artModal.body} onChange={(e) => setArtModal((s) => ({ ...s, body: e.target.value }))} placeholder="Escreva a orientacao..." /></Field>
            <label className="flex items-center justify-between text-sm"><span>Publicado (visivel aos usuarios)</span><input type="checkbox" className="w-5 h-5 accent-emerald-500" checked={artModal.published !== false} onChange={(e) => setArtModal((s) => ({ ...s, published: e.target.checked }))} /></label>
          </div>
        </Modal>
      )}

      {/* Modal thread do chamado */}
      {threadId && <TicketThread id={threadId} isAdmin={isAdmin} onClose={() => setThreadId(null)} />}
    </div>
  );
}

function TicketThread({ id, isAdmin, onClose }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['ticket', id], queryFn: () => Support.ticket(id) });
  const ticket = q.data?.ticket;
  const messages = q.data?.messages || [];
  const [reply, setReply] = useState('');
  const [img, setImg] = useState('');
  const fileRef = useRef(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['ticket', id] }); qc.invalidateQueries({ queryKey: ['support-tickets'] }); };

  const sendReply = useMutation({ mutationFn: () => Support.replyTicket({ id, body: reply, image_url: img || undefined }), onSuccess: () => { setReply(''); setImg(''); refresh(); }, onError: (e) => toast.error(e.message || 'Falha') });
  const setStatus = useMutation({ mutationFn: (status) => Support.setTicketStatus(id, status), onSuccess: () => { refresh(); }, onError: (e) => toast.error(e.message || 'Falha') });
  const onImg = async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; try { setImg(await readImage(f)); } catch {} };

  return (
    <Modal open onClose={onClose} title={ticket?.subject || 'Chamado'} maxWidth="max-w-xl"
      footer={
        <div className="flex items-center gap-2 w-full flex-wrap justify-end">
          {isAdmin && ticket && ticket.status !== 'resolved' && <Button size="sm" variant="outline" onClick={() => setStatus.mutate('resolved')}><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Resolver</Button>}
          {!isAdmin && ticket && (ticket.status === 'resolved' || ticket.status === 'answered') && <>
            <Button size="sm" variant="outline" onClick={() => setStatus.mutate('reopened')}><RotateCcw className="w-4 h-4" /> Reabrir</Button>
            <Button size="sm" variant="outline" onClick={() => setStatus.mutate('closed')} className="text-emerald-500"><CheckCircle2 className="w-4 h-4" /> Resolveu</Button>
          </>}
          <Button onClick={onClose}>Fechar</Button>
        </div>
      }>
      {q.isLoading ? <div className="flex justify-center py-8"><Spinner className="w-6 h-6 text-emerald-500" /></div> : (
        <div className="space-y-3">
          <div className="flex items-center gap-2"><Badge color={st(ticket?.status).color}>{st(ticket?.status).label}</Badge><span className="text-xs text-muted">aberto em {fmtDate(ticket?.created_date)}</span></div>
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
          {ticket && ticket.status !== 'closed' && (
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
