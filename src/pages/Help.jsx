import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Support } from '../api/entities.js';
import { useAuth } from '../context/AuthContext.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Button, Input, Field, Modal, Spinner, Badge, EmptyState, Textarea } from '../components/ui';
import { toast } from '../lib/toast.js';
import { LifeBuoy, Search, ChevronDown, Sparkles, Plus, Ticket, Pencil, Trash2, ArrowRight } from 'lucide-react';

export default function Help() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const articlesQ = useQuery({ queryKey: ['help-articles'], queryFn: () => Support.articles() });
  const articles = articlesQ.data?.articles || [];

  const [ask, setAsk] = useState('');
  const [openId, setOpenId] = useState(null);

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

  const [artModal, setArtModal] = useState(null);
  const saveArticle = useMutation({ mutationFn: () => Support.saveArticle(artModal), onSuccess: () => { qc.invalidateQueries({ queryKey: ['help-articles'] }); setArtModal(null); toast.success('Artigo salvo'); }, onError: (e) => toast.error(e.message || 'Falha') });
  const delArticle = useMutation({ mutationFn: (id) => Support.deleteArticle(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['help-articles'] }); toast.success('Artigo removido'); } });

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageHeader
        title={<span className="flex items-center gap-2"><LifeBuoy className="w-6 h-6 text-emerald-500" /> Ajuda & Suporte</span>}
        subtitle="Tire duvidas nos artigos ou abra um chamado no suporte"
        actions={<Button onClick={() => navigate('/chamados')}><Ticket className="w-4 h-4" /> Central de Tickets</Button>}
      />

      {/* Assistente / busca */}
      <div className="relative overflow-hidden rounded-3xl p-6 text-white shadow-soft" style={{ background: 'linear-gradient(135deg,#059669 0%,#0d9488 55%,#0ea5e9 100%)' }}>
        <div className="absolute -top-16 -right-12 w-64 h-64 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(255,255,255,.2), transparent 70%)' }} />
        <div className="relative">
          <div className="flex items-center gap-2 text-[11px] tracking-[0.28em] font-medium text-emerald-100"><Sparkles className="w-3.5 h-3.5" /> ASSISTENTE</div>
          <h2 className="font-display text-2xl font-extrabold mt-1">Como posso ajudar?</h2>
          <div className="mt-3 flex items-center gap-2 bg-white/15 rounded-xl px-3 py-2 max-w-xl">
            <Search className="w-4 h-4 text-white/80 shrink-0" />
            <input value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="Ex: como importar a fatura do cartão" className="flex-1 bg-transparent outline-none placeholder-white/60 text-sm" />
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
            <p className="mt-3 text-sm text-white/90 max-w-xl">Nao encontrei um artigo sobre isso. <button onClick={() => navigate('/chamados')} className="underline font-semibold">Abrir um chamado</button> com sua duvida.</p>
          )}
        </div>
      </div>

      {/* Atalho Central de Tickets */}
      <button onClick={() => navigate('/chamados')} className="w-full text-left">
        <Card className="hover-lift flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl bg-indigo-500/15 text-indigo-500 flex items-center justify-center shrink-0"><Ticket className="w-5 h-5" /></span>
          <div className="flex-1"><p className="font-semibold">Central de Tickets</p><p className="text-xs text-muted">{isAdmin ? 'Gerencie, responda e resolva os chamados.' : 'Abra e acompanhe seus chamados.'}</p></div>
          <ArrowRight className="w-5 h-5 text-muted" />
        </Card>
      </button>

      {/* Artigos */}
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

      {artModal && (
        <Modal open onClose={() => setArtModal(null)} title={artModal.id ? 'Editar artigo' : 'Novo artigo'} maxWidth="max-w-lg"
          footer={<><Button variant="outline" onClick={() => setArtModal(null)}>Cancelar</Button><Button onClick={() => saveArticle.mutate()} disabled={saveArticle.isPending || !artModal.title}>{saveArticle.isPending ? <Spinner className="w-4 h-4" /> : 'Salvar'}</Button></>}>
          <div className="space-y-3">
            <Field label="Título"><Input value={artModal.title} onChange={(e) => setArtModal((s) => ({ ...s, title: e.target.value }))} placeholder="Ex: Como pagar uma fatura" /></Field>
            <Field label="Categoria"><Input value={artModal.category} onChange={(e) => setArtModal((s) => ({ ...s, category: e.target.value }))} placeholder="Ex: Cartão de crédito" /></Field>
            <Field label="Conteudo"><Textarea rows={7} value={artModal.body} onChange={(e) => setArtModal((s) => ({ ...s, body: e.target.value }))} placeholder="Escreva a orientacao..." /></Field>
            <label className="flex items-center justify-between text-sm"><span>Publicado (visivel aos usuários)</span><input type="checkbox" className="w-5 h-5 accent-emerald-500" checked={artModal.published !== false} onChange={(e) => setArtModal((s) => ({ ...s, published: e.target.checked }))} /></label>
          </div>
        </Modal>
      )}
    </div>
  );
}
