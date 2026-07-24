import { useMemo, useRef, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Transaction, Account, Category, Subscription, Goal, AppSettings, Ai } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Button, Input, Spinner, Badge } from '../components/ui';
import { Link } from 'react-router-dom';
import { formatCurrency, monthKey } from '../lib/utils.js';
import { monthTotals, categoryBreakdown, lastMonths, monthlySeries } from '../lib/analytics.js';
import { Bot, Send, Sparkles, User } from 'lucide-react';

const SUGGESTIONS = [
  'Quanto gastei este mes?',
  'Onde posso economizar?',
  'Como esta minha saude financeira?',
  'Quais minhas maiores despesas?',
];

export default function AIAssistant() {
  const { data: transactions = [] } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => Account.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });
  const { data: subs = [] } = useQuery({ queryKey: ['subscriptions'], queryFn: () => Subscription.list() });
  const { data: goals = [] } = useQuery({ queryKey: ['goals'], queryFn: () => Goal.list() });
  const { data: settingsList = [] } = useQuery({ queryKey: ['appsettings'], queryFn: () => AppSettings.list() });
  const apiKey = settingsList[0]?.gemini_api_key;
  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, loading]);

  const buildContext = () => {
    const mk = monthKey(new Date());
    const cur = monthTotals(transactions, mk);
    const cats = categoryBreakdown(transactions, mk, catMap).slice(0, 8).map((c) => ({ nome: c.name, valor: Math.round(c.value) }));
    const series = monthlySeries(transactions, lastMonths(6)).map((s) => ({ mes: s.name, receita: Math.round(s.inc), despesa: Math.round(s.exp) }));
    return {
      mesAtual: mk,
      saldoTotal: Math.round(accounts.reduce((a, x) => a + Number(x.current_balance || 0), 0)),
      contas: accounts.map((a) => ({ nome: a.name, saldo: Math.round(a.current_balance || 0) })),
      receitaMes: Math.round(cur.inc), despesaMes: Math.round(cur.exp), saldoMes: Math.round(cur.bal), taxaPoupanca: Math.round(cur.rate),
      gastosPorCategoria: cats,
      evolucao6meses: series,
      assinaturas: subs.map((s) => ({ nome: s.name, valor: s.amount })),
      metas: goals.map((g) => ({ nome: g.name, alvo: g.target_amount, atual: g.current_amount })),
    };
  };

  const send = async (q) => {
    const question = (q ?? input).trim();
    if (!question || loading) return;
    if (!apiKey) { setMessages((m) => [...m, { role: 'assistant', text: 'Configure a chave da API Gemini em Configuracoes para usar o assistente.' }]); return; }
    const history = messages.slice(-6);
    setMessages((m) => [...m, { role: 'user', text: question }]);
    setInput(''); setLoading(true);
    try {
      const { answer } = await Ai.ask(question, buildContext(), apiKey, history);
      setMessages((m) => [...m, { role: 'assistant', text: answer }]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', text: 'Ops, nao consegui responder agora. ' + (e.message || '') }]);
    } finally { setLoading(false); }
  };

  return (
    <div className="animate-fadeIn">
      <PageHeader title={<span className="flex items-center gap-2"><Bot className="w-6 h-6 text-indigo-500" /> Assistente IA</span>}
        subtitle="Pergunte sobre suas financas em linguagem natural" />

      {!apiKey && (
        <Card className="mb-4 border-amber-500/30 bg-amber-50 dark:bg-amber-500/10">
          <p className="text-sm text-amber-700 dark:text-amber-300">Configure sua chave gratuita do Gemini em <Link to="/configuracoes" className="font-semibold underline">Configuracoes</Link> para conversar com o assistente.</p>
        </Card>
      )}

      <Card className="p-0 flex flex-col" style={{ height: 'min(70vh, 620px)' }}>
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center text-muted">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-3"><Sparkles className="w-8 h-8 text-indigo-500" /></div>
              <p className="font-semibold text-[hsl(var(--text))]">Como posso ajudar?</p>
              <p className="text-sm mt-1 max-w-sm">Pergunte sobre gastos, economia, metas e mais. Eu uso seus dados reais.</p>
              <div className="flex flex-wrap gap-2 justify-center mt-4">
                {SUGGESTIONS.map((sug) => <button key={sug} onClick={() => send(sug)} className="px-3 py-1.5 rounded-full border border-[hsl(var(--border))] text-sm hover:bg-black/5 dark:hover:bg-white/5">{sug}</button>)}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${m.role === 'user' ? 'bg-emerald-500 text-white' : 'bg-indigo-500 text-white'}`}>{m.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}</span>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-emerald-500 text-white' : 'bg-black/5 dark:bg-white/5'}`}>{m.text}</div>
            </div>
          ))}
          {loading && <div className="flex gap-3"><span className="w-8 h-8 rounded-lg bg-indigo-500 text-white flex items-center justify-center"><Bot className="w-4 h-4" /></span><div className="rounded-2xl px-4 py-3 bg-black/5 dark:bg-white/5"><Spinner className="w-4 h-4 text-indigo-500" /></div></div>}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="border-t border-[hsl(var(--border))] p-3 flex gap-2">
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Pergunte algo sobre suas financas..." disabled={loading} />
          <Button type="submit" disabled={loading || !input.trim()}><Send className="w-4 h-4" /></Button>
        </form>
      </Card>
    </div>
  );
}
