import { useMemo, useRef, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Trigger, Category, Account, Transaction, Investment, Debt, Goal, Subscription, CreditCardInvoice, AppSettings } from '../api/entities.js';
import { useAuth } from '../context/AuthContext.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Button, Input, Spinner, Badge } from '../components/ui';
import { routeAgent } from '../lib/assistant.js';
import { answerHybrid } from '../lib/chat.js';
import { MessagesSquare, Send, Sparkles, User, Bot, Cpu } from 'lucide-react';

const FOCUS_LABEL = { geral: 'Assistente geral', saldo: 'Saldo & Contas', gastos: 'Gastos & Categorias', patrimonio: 'Patrimonio & Investimentos', mercado: 'Mercado', vencimentos: 'Vencimentos' };
const cfgOf = (a) => { try { return typeof a.config === 'string' ? JSON.parse(a.config) : (a.config || {}); } catch { return {}; } };

const SUGGESTIONS = ['Onde gasto mais?', 'Como esta minha saude financeira?', 'O que vence essa semana?', 'Qual meu patrimonio?', 'Como esta o dolar?', 'Onde posso economizar?'];

export default function Chat() {
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
  const scrollRef = useRef(null);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, loading]);

  const send = async (q) => {
    const question = (q ?? input).trim();
    if (!question || loading) return;
    const robot = routeAgent(question, agents);
    const agent = robot ? { name: robot.name, focus: cfgOf(robot).focus, focusLabel: FOCUS_LABEL[cfgOf(robot).focus] || 'Assistente', emoji: cfgOf(robot).emoji || '🤖' } : { name: 'Assistente', focus: 'geral', focusLabel: 'Assistente geral', emoji: '🤖' };
    const history = messages.slice(-6);
    setMessages((m) => [...m, { role: 'user', text: question }]);
    setInput(''); setLoading(true);
    try {
      const { text, via } = await answerHybrid({ question, ctx, agent, apiKey, history });
      setMessages((m) => [...m, { role: 'assistant', text, via, robot: agent }]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', text: 'Ops, nao consegui responder agora. ' + (e.message || ''), robot: agent }]);
    } finally { setLoading(false); }
  };

  return (
    <div className="animate-fadeIn">
      <PageHeader title={<span className="flex items-center gap-2"><MessagesSquare className="w-6 h-6 text-indigo-500" /> Chat dos Robos</span>}
        subtitle="Pergunte e eu escolho o robo certo pra te responder" />

      <Card className="py-2.5 mb-3">
        <p className="text-xs text-muted flex items-center gap-2">
          {apiKey ? <><Sparkles className="w-4 h-4 text-emerald-500" /> IA generativa ativa (Gemini). As respostas usam seus dados reais.</>
            : <><Cpu className="w-4 h-4 text-sky-500" /> Modo local (sem custo). Para respostas generativas, configure a chave Gemini em <Link to="/configuracoes" className="underline font-medium">Configuracoes</Link>.</>}
        </p>
      </Card>

      <Card className="p-0 flex flex-col" style={{ height: 'min(70vh, 640px)' }}>
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center text-muted">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-3"><MessagesSquare className="w-8 h-8 text-indigo-500" /></div>
              <p className="font-semibold text-[hsl(var(--text))]">Fale com seus robos</p>
              <p className="text-sm mt-1 max-w-sm">Eu analiso sua pergunta e encaminho pro robo com a especialidade certa (saldo, gastos, patrimonio, mercado, vencimentos).</p>
              <div className="flex flex-wrap gap-2 justify-center mt-4">
                {SUGGESTIONS.map((s) => <button key={s} onClick={() => send(s)} className="px-3 py-1.5 rounded-full border border-[hsl(var(--border))] text-sm hover:bg-black/5 dark:hover:bg-white/5">{s}</button>)}
              </div>
              {agents.length === 0 && <p className="text-xs mt-4">Dica: crie robos em <Link to="/agentes" className="underline">Agentes & Robos</Link> para respostas com personalidade.</p>}
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-lg ${m.role === 'user' ? 'bg-emerald-500 text-white' : ''}`} style={m.role !== 'user' ? { background: 'linear-gradient(135deg,#10b98122,#6366f122)' } : {}}>{m.role === 'user' ? <User className="w-4 h-4" /> : (m.robot?.emoji || <Bot className="w-4 h-4" />)}</span>
              <div className="max-w-[80%]">
                {m.role === 'assistant' && m.robot && <p className="text-[11px] text-muted mb-0.5 flex items-center gap-1">{m.robot.name} · {m.robot.focusLabel}{m.via === 'gemini' ? <Badge color="emerald">IA</Badge> : <Badge color="slate">local</Badge>}</p>}
                <div className={`rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-emerald-500 text-white' : 'bg-black/5 dark:bg-white/5'}`}>{m.text}</div>
              </div>
            </div>
          ))}
          {loading && <div className="flex gap-3"><span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#10b98122,#6366f122)' }}><Bot className="w-4 h-4" /></span><div className="rounded-2xl px-4 py-3 bg-black/5 dark:bg-white/5"><Spinner className="w-4 h-4 text-indigo-500" /></div></div>}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="border-t border-[hsl(var(--border))] p-3 flex gap-2">
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Pergunte algo sobre suas financas..." disabled={loading} />
          <Button type="submit" disabled={loading || !input.trim()}><Send className="w-4 h-4" /></Button>
        </form>
      </Card>
    </div>
  );
}
