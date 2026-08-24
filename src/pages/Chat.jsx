import { useMemo, useRef, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Trigger, Category, Account, Transaction, Investment, Debt, Goal, Subscription, CreditCardInvoice, AppSettings } from '../api/entities.js';
import { useAuth } from '../context/AuthContext.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Button, Input, Spinner, Badge } from '../components/ui';
import { converse } from '../lib/chat.js';
import { deliberate, suggestFor } from '../lib/assistant.js';
import { CouncilThinking } from '../components/Splash.jsx';
import { MessagesSquare, Send, Sparkles, User, Bot, Cpu, Users } from 'lucide-react';

const SUGGESTIONS = ['Onde gasto mais?', 'Como esta minha saude financeira?', 'O que vence essa semana?', 'Qual meu patrimônio?', 'Como esta o dolar?', 'Onde posso economizar?'];

export default function Chat() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: agents = [] } = useQuery({ queryKey: ['triggers'], queryFn: () => Trigger.list() });
  const { data: transactions = [] } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => Account.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });
  const { data: investments = [] } = useQuery({ queryKey: ['investments'], queryFn: () => Investment.list() });
  const { data: debts = [] } = useQuery({ queryKey: ['debts'], queryFn: () => Debt.list() });
  const { data: goals = [] } = useQuery({ queryKey: ['goals'], queryFn: () => Goal.list() });
  const { data: subs = [] } = useQuery({ queryKey: ['subscriptions'], queryFn: () => Subscription.list() });
  const { data: invoices = [] } = useQuery({ queryKey: ['invoices'], queryFn: () => CreditCardInvoice.list() });
  const { data: settingsList = [] } = useQuery({ queryKey: ['appsettings'], queryFn: () => AppSettings.list() });
  const apiKey = settingsList[0]?.gemini_api_key;

  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const ctx = useMemo(() => ({ user, transactions, accounts, categories, catMap, investments, debts, goals, subs, invoices }), [user, transactions, accounts, categories, catMap, investments, debts, goals, subs, invoices]);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [thinking, setThinking] = useState([]);
  const scrollRef = useRef(null);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, loading]);

  const send = async (q) => {
    const question = (q ?? input).trim();
    if (!question || loading) return;
    const history = messages.filter((m) => m.role === 'user' || m.role === 'assistant').slice(-6);
    setThinking(deliberate(question, agents).slice(0, 4).map((x) => ({ emoji: x.emoji, name: x.name })));
    setMessages((m) => [...m, { role: 'user', text: question }]);
    setInput(''); setLoading(true);
    try {
      const { council, panel, parts } = await converse({ question, ctx, agents, primary: null, apiKey, history });
      const additions = [];
      if (council.length > 1) additions.push({ role: 'council', items: council.slice(0, 4), winners: parts.map((p) => p.robot.name), panel });
      const acts = suggestFor(question);
      parts.forEach((p, i) => additions.push({ role: 'assistant', text: p.text, via: p.via, robot: p.robot, actions: i === parts.length - 1 ? acts : [] }));
      setMessages((m) => [...m, ...additions]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', text: 'Ops, não consegui responder agora. ' + (e.message || ''), robot: { name: 'Assistente', focusLabel: '', emoji: '🤖' } }]);
    } finally { setLoading(false); }
  };

  return (
    <div className="animate-fadeIn">
      <PageHeader title={<span className="flex items-center gap-2"><MessagesSquare className="w-6 h-6 text-indigo-500" /> Chat dos Robos</span>}
        subtitle="Pergunte e eu escolho o robo certo pra te responder" />

      <Card className="py-2.5 mb-3">
        <p className="text-xs text-muted flex items-center gap-2">
          {apiKey ? <><Sparkles className="w-4 h-4 text-emerald-500" /> IA generativa ativa (Gemini). As respostas usam seus dados reais.</>
            : <><Cpu className="w-4 h-4 text-sky-500" /> Modo local (sem custo). Para respostas generativas, configure a chave Gemini em <Link to="/configuracoes" className="underline font-medium">Configurações</Link>.</>}
        </p>
      </Card>

      <Card className="p-0 flex flex-col" style={{ height: 'min(70vh, 640px)' }}>
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center text-muted">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-3"><MessagesSquare className="w-8 h-8 text-indigo-500" /></div>
              <p className="font-semibold text-[hsl(var(--text))]">Fale com seus robos</p>
              <p className="text-sm mt-1 max-w-sm">Eu analiso sua pergunta e encaminho pro robo com a especialidade certa (saldo, gastos, patrimônio, mercado, vencimentos).</p>
              <div className="flex flex-wrap gap-2 justify-center mt-4">
                {SUGGESTIONS.map((s) => <button key={s} onClick={() => send(s)} className="px-3 py-1.5 rounded-full border border-[hsl(var(--border))] text-sm hover:bg-black/5 dark:hover:bg-white/5">{s}</button>)}
              </div>
              {agents.length === 0 && <p className="text-xs mt-4">Dica: crie robos em <Link to="/agentes" className="underline">Agentes & Robos</Link> para respostas com personalidade.</p>}
            </div>
          )}
          {messages.map((m, i) => m.role === 'council' ? (
            <div key={i} className="rounded-xl border border-[hsl(var(--border))] bg-black/[0.03] dark:bg-white/[0.03] px-3 py-2">
              <p className="text-[11px] font-semibold text-muted flex items-center gap-1.5 mb-1.5"><Users className="w-3.5 h-3.5 text-indigo-500" /> Os robôs se reuniram</p>
              <div className="flex flex-wrap gap-1.5">
                {m.items.map((it, k) => { const win = (m.winners || []).includes(it.name); return (
                  <span key={k} className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${win ? 'bg-emerald-500 text-white font-semibold' : 'bg-black/5 dark:bg-white/10 text-muted'}`}>
                    {it.emoji} {it.name} · {Math.round(it.score * 100)}%{win ? ' ✓' : ''}
                  </span>
                ); })}
              </div>
              <p className="text-[11px] text-muted mt-1.5">{m.panel ? `${(m.winners || []).join(' e ')} responderam juntos — a pergunta envolve mais de uma especialidade.` : `${(m.winners || [])[0]} assumiu por ter o papel mais adequado.`}</p>
            </div>
          ) : (
            <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-lg ${m.role === 'user' ? 'bg-emerald-500 text-white' : ''}`} style={m.role !== 'user' ? { background: 'linear-gradient(135deg,#10b98122,#6366f122)' } : {}}>{m.role === 'user' ? <User className="w-4 h-4" /> : (m.robot?.emoji || <Bot className="w-4 h-4" />)}</span>
              <div className="max-w-[80%]">
                {m.role === 'assistant' && m.robot && <p className="text-[11px] text-muted mb-0.5 flex items-center gap-1">{m.robot.name} · {m.robot.focusLabel}{m.via === 'gemini' ? <Badge color="emerald">IA</Badge> : <Badge color="slate">local</Badge>}</p>}
                <div className={`rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-emerald-500 text-white' : 'bg-black/5 dark:bg-white/5'}`}>{m.text}</div>
                {m.actions?.length > 0 && <div className="flex flex-wrap gap-1.5 mt-1.5">{m.actions.map((a, k) => <button key={k} onClick={() => navigate(a.path)} className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition">{a.label} →</button>)}</div>}
              </div>
            </div>
          ))}
          {loading && <div className="rounded-2xl px-4 py-3 bg-black/5 dark:bg-white/5 w-fit">{thinking.length > 1 ? <CouncilThinking robots={thinking} /> : <Spinner className="w-4 h-4 text-indigo-500" />}</div>}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="border-t border-[hsl(var(--border))] p-3 flex gap-2">
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Pergunte algo sobre suas finanças..." disabled={loading} />
          <Button type="submit" disabled={loading || !input.trim()}><Send className="w-4 h-4" /></Button>
        </form>
      </Card>
    </div>
  );
}
