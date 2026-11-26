import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Support } from '../api/entities.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Button, Input, Field, Modal, Spinner, Badge, Textarea } from '../components/ui';
import { HeroTitle, Panel, GlowButton } from '../components/kit.jsx';
import { SupportBotArt } from '../components/art/PageArt.jsx';
import { WHATS_NEW } from '../components/WhatsNew.jsx';
import { toast } from '../lib/toast.js';
import { LifeBuoy, Search, ChevronDown, Sparkles, Plus, Ticket, Pencil, Trash2, ArrowRight, BarChart3, FileText, Zap, CheckCircle2, CreditCard, Upload, Calculator, FileBadge2, LineChart, ShieldCheck, BookOpen, Headphones, Activity, Megaphone, Clock, X, AlertTriangle } from 'lucide-react';

const QUICK = [
  ['Cartão', CreditCard, 'cartão fatura', '#38bdf8'], ['Importação', Upload, 'importar', '#a78bfa'], ['Simulador', Calculator, 'simulador', '#818cf8'],
  ['Imposto de Renda', FileBadge2, 'imposto renda', '#22d3ee'], ['Investimentos', LineChart, 'investimento', '#c084fc'], ['Relatórios', FileText, 'relatório', '#60a5fa'], ['Segurança', ShieldCheck, 'segurança senha', '#e879f9'],
];
const ART_ICON = [[/cart[aã]o|fatura/i, CreditCard], [/import/i, Upload], [/simul/i, Calculator], [/imposto|renda|ir\b/i, FileBadge2], [/invest/i, LineChart], [/relat/i, FileText], [/seguran|senha|2fa/i, ShieldCheck]];
const iconFor = (a) => (ART_ICON.find(([re]) => re.test(`${a.title} ${a.category}`)) || [null, BookOpen])[1];
const readMin = (a) => Math.max(1, Math.round(String(a.body || '').split(/\s+/).length / 180));
const fmtDur = (min) => (min == null ? '—' : min < 60 ? `${Math.round(min)} min` : min < 1440 ? `${(min / 60).toFixed(1).replace('.', ',')} h` : `${(min / 1440).toFixed(1).replace('.', ',')} d`);

export default function Help() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const articlesQ = useQuery({ queryKey: ['help-articles'], queryFn: () => Support.articles() });
  const ticketsQ = useQuery({ queryKey: ['support-tickets'], queryFn: () => Support.tickets(), retry: 0 });
  const articles = articlesQ.data?.articles || [];
  const tickets = ticketsQ.data?.tickets || [];

  const [ask, setAsk] = useState('');
  const [reader, setReader] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [openId, setOpenId] = useState(null);

  const matches = useMemo(() => {
    const q = ask.trim().toLowerCase();
    if (q.length < 2) return [];
    const terms = q.split(/\s+/).filter((t) => t.length > 2);
    return articles.map((a) => {
      const text = `${a.title} ${a.body} ${a.category}`.toLowerCase();
      let score = 0; for (const t of terms) if (text.includes(t)) score += text.split(t).length - 1;
      if (text.includes(q)) score += 5; if (String(a.title).toLowerCase().includes(q)) score += 8;
      return { a, score };
    }).filter((x) => x.score > 0).sort((x, y) => y.score - x.score).slice(0, 5).map((x) => x.a);
  }, [ask, articles]);
  const grouped = useMemo(() => { const m = {}; for (const a of articles) (m[a.category || 'Geral'] = m[a.category || 'Geral'] || []).push(a); return Object.entries(m); }, [articles]);
  const featured = useMemo(() => { const seen = new Set(); const out = []; for (const a of articles) { if (a.published === false) continue; const c = a.category || 'Geral'; if (!seen.has(c)) { seen.add(c); out.push(a); } if (out.length === 4) break; } for (const a of articles) { if (out.length >= 4) break; if (!out.includes(a) && a.published !== false) out.push(a); } return out; }, [articles]);

  // números reais do suporte (chamados visíveis para quem está logado)
  const stats = useMemo(() => {
    const open = tickets.filter((t) => !['resolved', 'closed'].includes(t.status));
    const replied = tickets.filter((t) => t.first_reply_date && t.created_date);
    const avgFirst = replied.length ? replied.reduce((s, t) => s + (new Date(t.first_reply_date) - new Date(t.created_date)) / 60000, 0) / replied.length : null;
    const done = tickets.filter((t) => ['resolved', 'closed'].includes(t.status)).length;
    return { open: open.length, avgFirst, resolvedPct: tickets.length ? Math.round((done / tickets.length) * 100) : null };
  }, [tickets]);
  const lastCheck = Math.max(articlesQ.dataUpdatedAt || 0, ticketsQ.dataUpdatedAt || 0);
  const healthy = !articlesQ.isError && !ticketsQ.isError;
  const news = WHATS_NEW[0];

  const [artModal, setArtModal] = useState(null);
  const saveArticle = useMutation({ mutationFn: () => Support.saveArticle(artModal), onSuccess: () => { qc.invalidateQueries({ queryKey: ['help-articles'] }); setArtModal(null); toast.success('Artigo salvo'); }, onError: (e) => toast.error(e.message || 'Falha') });
  const delArticle = useMutation({ mutationFn: (id) => Support.deleteArticle(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['help-articles'] }); toast.success('Artigo removido'); } });

  return (
    <div className="space-y-5 animate-fadeIn">
      <HeroTitle icon={LifeBuoy} lead="Ajuda &" accent="Suporte" iconClass="text-sky-400" subtitle="Tire dúvidas, encontre respostas e conte com o nosso suporte."
        actions={<GlowButton tone="sky" onClick={() => navigate('/chamados')} className="py-2.5"><Ticket className="w-4 h-4" />Central de Tickets</GlowButton>} />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <section className="xl:col-span-8 relative overflow-hidden rounded-3xl ring-1 ring-cyan-400/50 shadow-[0_0_44px_-14px_rgba(34,211,238,.6)] p-6 bg-[hsl(var(--card))]" style={{ backgroundImage: 'radial-gradient(80% 140% at 0% 0%,rgba(14,165,233,.22),transparent),radial-gradient(60% 120% at 100% 100%,rgba(168,85,247,.25),transparent)' }}>
          <SupportBotArt className="hidden lg:block absolute -right-6 -top-2 w-[24rem] h-48 pointer-events-none" />
          <div className="relative lg:pr-64">
            <span className="inline-flex items-center gap-1.5 text-[11px] tracking-[0.18em] font-bold px-3 py-1 rounded-full ring-1 ring-cyan-400/50 bg-cyan-500/10 text-cyan-600 dark:text-cyan-300"><Sparkles className="w-3.5 h-3.5" />ASSISTENTE MONVY</span>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold mt-3">Como posso ajudar?</h2>
            <p className="text-sm text-muted mt-1">Pesquise um artigo, tema ou dúvida frequente e encontre a resposta em segundos.</p>
          </div>
          <div className="relative mt-4 flex items-center gap-2 rounded-2xl ring-1 ring-cyan-400/60 bg-black/[.04] dark:bg-white/[.04] px-3 py-2 max-w-2xl lg:mr-72 shadow-[0_0_20px_-6px_rgba(34,211,238,.5)]">
            <Search className="w-5 h-5 text-cyan-400 shrink-0" />
            <input value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="Ex.: como importar a fatura do cartão, imposto de renda, simulador..." className="flex-1 bg-transparent outline-none text-sm min-w-0" aria-label="Buscar na ajuda" />
            {ask && <button onClick={() => setAsk('')} className="p-1 text-muted" aria-label="Limpar"><X className="w-4 h-4" /></button>}
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-violet-500/20 text-violet-600 dark:text-violet-200"><Zap className="w-3 h-3" />Busca rápida</span>
          </div>
          {matches.length > 0 && (
            <div className="relative mt-3 space-y-2 max-w-2xl">
              {matches.map((a) => { const Ic = iconFor(a); return (
                <button key={a.id} onClick={() => setReader(a)} className="w-full text-left rounded-xl ring-1 ring-[hsl(var(--border))] bg-[hsl(var(--card))]/80 hover:ring-cyan-400/60 transition p-3 flex gap-3">
                  <Ic className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" /><span className="min-w-0"><b className="text-sm block">{a.title}</b><span className="text-xs text-muted line-clamp-2">{a.body}</span></span>
                </button>); })}
            </div>
          )}
          {ask.trim().length >= 2 && matches.length === 0 && <p className="relative mt-3 text-sm max-w-2xl">Não encontrei um artigo sobre isso. <button onClick={() => navigate('/chamados?novo=1')} className="underline font-semibold text-cyan-600 dark:text-cyan-300">Abrir um chamado</button> com sua dúvida.</p>}
        </section>

        <Panel className="xl:col-span-4" tone="violet" title="Suporte em números" icon={BarChart3} iconClass="text-sky-400" subtitle={isAdmin ? 'Todos os chamados' : 'Seus chamados'}>
          <div className="grid grid-cols-2 gap-3">
            {[[FileText, 'Artigos de ajuda', articles.filter((a) => a.published !== false).length, '#38bdf8'], [Zap, 'Tempo médio de 1ª resposta', fmtDur(stats.avgFirst), '#a78bfa'], [Ticket, 'Chamados abertos', stats.open, '#c084fc'], [CheckCircle2, 'Chamados resolvidos', stats.resolvedPct == null ? '—' : `${stats.resolvedPct}%`, '#34d399']].map(([Ic, l, v, c]) => (
              <div key={l} className="rounded-2xl ring-1 ring-[hsl(var(--border))] p-3 flex items-center gap-3" style={{ backgroundImage: `linear-gradient(135deg,${c}1f,transparent 70%)` }}>
                <Ic className="w-7 h-7 shrink-0" style={{ color: c }} strokeWidth={1.7} />
                <div className="min-w-0"><p className="text-[11px] text-muted leading-tight">{l}</p><p className="font-display text-xl font-bold">{ticketsQ.isLoading && l !== 'Artigos de ajuda' ? '…' : v}</p></div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <section>
        <h3 className="font-semibold text-lg flex items-center gap-2 mb-3"><Zap className="w-5 h-5 text-sky-400" />Acessos rápidos <span className="text-xs text-muted font-normal">Navegue pelos principais temas de ajuda</span></h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3">
          {QUICK.map(([l, Ic, q, c]) => <button key={l} onClick={() => { setAsk(q); window.scrollTo?.({ top: 0, behavior: 'smooth' }); }} className="rounded-2xl ring-1 bg-[hsl(var(--card))] py-4 flex flex-col items-center gap-2 font-semibold text-sm hover:brightness-110 transition" style={{ '--tw-ring-color': `${c}66`, backgroundImage: `linear-gradient(160deg,${c}24,transparent 70%)`, boxShadow: `0 0 20px -10px ${c}` }}><Ic className="w-7 h-7" style={{ color: c }} strokeWidth={1.7} />{l}</button>)}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <h3 className="font-semibold text-lg flex items-center gap-2"><BookOpen className="w-5 h-5 text-violet-400" />Artigos em destaque <span className="text-xs text-muted font-normal hidden sm:inline">Conteúdos que podem te ajudar agora</span></h3>
          <div className="flex items-center gap-3">
            {isAdmin && <Button size="sm" variant="outline" onClick={() => setArtModal({ title: '', category: 'Geral', body: '', published: true })}><Plus className="w-4 h-4" /> Novo artigo</Button>}
            <button onClick={() => setShowAll((v) => !v)} className="text-sm font-semibold flex items-center gap-1 hover:underline">{showAll ? 'Ocultar lista' : 'Ver todos os artigos'}<ArrowRight className="w-4 h-4" /></button>
          </div>
        </div>
        {articlesQ.isLoading ? <Spinner className="w-6 h-6 text-sky-500" /> : featured.length === 0 ? <p className="text-sm text-muted">Sem artigos ainda.</p> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {featured.map((a, i) => { const Ic = iconFor(a); const c = ['#22d3ee', '#c084fc', '#34d399', '#e879f9'][i % 4]; return (
              <button key={a.id} onClick={() => setReader(a)} className="text-left rounded-2xl ring-1 bg-[hsl(var(--card))] p-4 flex flex-col gap-2 hover:brightness-110 transition" style={{ '--tw-ring-color': `${c}66`, boxShadow: `0 0 24px -12px ${c}` }}>
                <div className="flex items-start gap-3"><Ic className="w-8 h-8 shrink-0" style={{ color: c }} strokeWidth={1.6} /><div className="min-w-0"><b className="block leading-tight">{a.title}</b><span className="text-xs text-muted line-clamp-2 mt-1 block">{a.body}</span></div></div>
                <div className="flex items-center justify-between mt-auto pt-1 text-xs text-muted"><span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{readMin(a)} min de leitura · {a.category || 'Geral'}</span><ArrowRight className="w-4 h-4" /></div>
              </button>); })}
          </div>
        )}
        {showAll && grouped.map(([cat, list]) => (
          <div key={cat} className="mt-4">
            <p className="text-xs font-bold tracking-widest text-muted mb-2">{cat.toUpperCase()}</p>
            <div className="space-y-2">
              {list.map((a) => { const open = openId === a.id; return (
                <div key={a.id} className="rounded-2xl ring-1 ring-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
                  <button onClick={() => setOpenId(open ? null : a.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left"><span className="flex-1 font-medium flex items-center gap-2">{a.title}{a.published === false && <Badge color="slate">rascunho</Badge>}</span><ChevronDown className={`w-4 h-4 text-muted transition ${open ? 'rotate-180' : ''}`} /></button>
                  {open && <div className="px-4 pb-4 -mt-1"><p className="text-sm text-muted whitespace-pre-line leading-relaxed">{a.body}</p>{isAdmin && <div className="flex gap-2 mt-3"><Button size="sm" variant="outline" onClick={() => setArtModal({ id: a.id, title: a.title, category: a.category, body: a.body, published: a.published !== false })}><Pencil className="w-4 h-4" /> Editar</Button><Button size="sm" variant="outline" onClick={() => { if (confirm('Remover este artigo?')) delArticle.mutate(a.id); }} className="text-rose-500"><Trash2 className="w-4 h-4" /> Remover</Button></div>}</div>}
                </div>); })}
            </div>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <section className="xl:col-span-6 relative overflow-hidden rounded-3xl ring-1 ring-fuchsia-400/40 shadow-[0_0_34px_-14px_rgba(217,70,239,.6)] p-6 bg-[hsl(var(--card))] flex flex-col sm:flex-row items-center gap-6" style={{ backgroundImage: 'linear-gradient(120deg,rgba(14,165,233,.14),rgba(168,85,247,.18))' }}>
          <Headphones className="w-24 h-24 text-sky-400 shrink-0 drop-shadow-[0_0_18px_rgba(56,189,248,.7)]" strokeWidth={1.4} />
          <div>
            <h3 className="font-display text-2xl font-extrabold">Precisa falar com a gente?</h3>
            <p className="text-sm text-muted mt-1">Abra um chamado, acompanhe o andamento ou veja todos os seus tickets na Central de Tickets.</p>
            <div className="flex flex-wrap gap-2 mt-4"><GlowButton tone="sky" onClick={() => navigate('/chamados?novo=1')}><Plus className="w-4 h-4" />Abrir novo ticket</GlowButton><button onClick={() => navigate('/chamados')} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold ring-1 ring-[hsl(var(--border))] hover:bg-black/5 dark:hover:bg-white/10"><Ticket className="w-4 h-4" />Central de Tickets</button></div>
          </div>
        </section>
        <Panel className="xl:col-span-6" tone="emerald" title="Status do sistema" icon={Activity} iconClass="text-emerald-400" action={<span className={`text-xs font-semibold px-2.5 py-1 rounded-full ring-1 flex items-center gap-1.5 ${healthy ? 'ring-emerald-400/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' : 'ring-amber-400/50 bg-amber-500/10 text-amber-600'}`}><i className={`w-1.5 h-1.5 rounded-full ${healthy ? 'bg-emerald-400' : 'bg-amber-400'}`} />{healthy ? 'Operacional' : 'Instável'}</span>}>
          <div className="flex items-start gap-3 pb-3 border-b border-[hsl(var(--border))]">
            {healthy ? <CheckCircle2 className="w-7 h-7 text-emerald-500 shrink-0" /> : <AlertTriangle className="w-7 h-7 text-amber-500 shrink-0" />}
            <div><b>{healthy ? 'Os serviços do Monvy estão respondendo normalmente.' : 'Algum serviço não respondeu agora — tente de novo em instantes.'}</b><p className="text-xs text-muted">Última verificação: {lastCheck ? `hoje, ${new Date(lastCheck).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : '—'} (artigos e chamados)</p></div>
          </div>
          {news && <button onClick={() => navigate(news.path)} className="w-full flex items-start gap-3 pt-3 text-left group"><Megaphone className="w-6 h-6 text-sky-400 shrink-0" /><div className="flex-1 min-w-0"><b>Novidade: {news.title}</b><p className="text-xs text-muted">{news.desc}</p></div><ArrowRight className="w-4 h-4 text-muted group-hover:translate-x-0.5 transition shrink-0 mt-1" /></button>}
        </Panel>
      </div>

      {reader && (
        <Modal open onClose={() => setReader(null)} title={reader.title} maxWidth="max-w-2xl" footer={<><span className="text-xs text-muted mr-auto">Não resolveu?</span><Button variant="outline" onClick={() => { setReader(null); navigate('/chamados?novo=1'); }}><Ticket className="w-4 h-4" /> Abrir chamado</Button><Button onClick={() => setReader(null)}>Entendi</Button></>}>
          <p className="text-xs text-muted mb-3">{reader.category || 'Geral'} · {readMin(reader)} min de leitura</p>
          <p className="text-sm whitespace-pre-line leading-relaxed">{reader.body}</p>
        </Modal>
      )}
      {artModal && (
        <Modal open onClose={() => setArtModal(null)} title={artModal.id ? 'Editar artigo' : 'Novo artigo'} maxWidth="max-w-lg"
          footer={<><Button variant="outline" onClick={() => setArtModal(null)}>Cancelar</Button><Button onClick={() => saveArticle.mutate()} disabled={saveArticle.isPending || !artModal.title}>{saveArticle.isPending ? <Spinner className="w-4 h-4" /> : 'Salvar'}</Button></>}>
          <div className="space-y-3">
            <Field label="Título"><Input value={artModal.title} onChange={(e) => setArtModal((s) => ({ ...s, title: e.target.value }))} placeholder="Ex.: Como pagar uma fatura" /></Field>
            <Field label="Categoria"><Input value={artModal.category} onChange={(e) => setArtModal((s) => ({ ...s, category: e.target.value }))} placeholder="Ex.: Cartão de crédito" /></Field>
            <Field label="Conteúdo"><Textarea rows={7} value={artModal.body} onChange={(e) => setArtModal((s) => ({ ...s, body: e.target.value }))} placeholder="Escreva a orientação..." /></Field>
            <label className="flex items-center justify-between text-sm"><span>Publicado (visível aos usuários)</span><input type="checkbox" className="w-5 h-5 accent-emerald-500" checked={artModal.published !== false} onChange={(e) => setArtModal((s) => ({ ...s, published: e.target.checked }))} /></label>
          </div>
        </Modal>
      )}
    </div>
  );
}
