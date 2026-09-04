import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Transaction, Account, Category, CreditCardTransaction, Investment, Debt, Goal, Subscription, CreditCardInvoice, AppSettings } from '../api/entities.js';
import { useAuth } from '../context/AuthContext.jsx';
import { combineExpenses } from '../lib/analytics.js';
import { answerHybrid } from '../lib/chat.js';
import { Card, Spinner, Button } from './ui';
import { toast } from '../lib/toast.js';
import { Sparkles, Cpu, Brain } from 'lucide-react';

// Bloco reutilizável de "análise inteligente" com Gemini (quando configurado) e
// fallback no motor local. Prompt curto = baixo consumo de tokens. Resultado
// persistido por tela (storageKey) até o usuário gerar de novo.
export function AiInsight({ prompt, storageKey, title = 'Análise inteligente', agentName = 'Analista', agentFocus = 'geral' }) {
  const { user } = useAuth();
  const KEY = `monvy_ai_${storageKey}`;
  const [data, setData] = useState(() => { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } });
  const [busy, setBusy] = useState(false);

  const { data: transactions = [] } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => Account.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });
  const { data: cardTxs = [] } = useQuery({ queryKey: ['cardtx'], queryFn: () => CreditCardTransaction.list() });
  const { data: investments = [] } = useQuery({ queryKey: ['investments'], queryFn: () => Investment.list() });
  const { data: debts = [] } = useQuery({ queryKey: ['debts'], queryFn: () => Debt.list() });
  const { data: goals = [] } = useQuery({ queryKey: ['goals'], queryFn: () => Goal.list() });
  const { data: subs = [] } = useQuery({ queryKey: ['subscriptions'], queryFn: () => Subscription.list() });
  const { data: invoices = [] } = useQuery({ queryKey: ['invoices'], queryFn: () => CreditCardInvoice.list() });
  const { data: settingsList = [] } = useQuery({ queryKey: ['appsettings'], queryFn: () => AppSettings.list() });
  const apiKey = settingsList[0]?.gemini_api_key;

  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const ctx = useMemo(() => ({ user, transactions: combineExpenses(transactions, cardTxs), accounts, categories, catMap, investments, debts, goals, subs, invoices }),
    [user, transactions, cardTxs, accounts, categories, catMap, investments, debts, goals, subs, invoices]);

  const gerar = async () => {
    setBusy(true);
    try {
      const { text, via } = await answerHybrid({ question: prompt, ctx, agent: { name: agentName, focusLabel: agentFocus }, apiKey, history: [] });
      const payload = { text, via, at: Date.now() };
      setData(payload);
      try { localStorage.setItem(KEY, JSON.stringify(payload)); } catch { /* ignore */ }
    } catch (e) { toast.error(e.message || 'Não consegui analisar agora.'); } finally { setBusy(false); }
  };

  return (
    <Card>
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <h3 className="font-semibold flex items-center gap-2"><Brain className="w-4 h-4 text-violet-500" /> {title}
          {data && <span className="text-[10px] font-normal text-muted inline-flex items-center gap-1 ml-1">{data.via === 'gemini' ? <><Sparkles className="w-3 h-3 text-emerald-500" /> Gemini</> : <><Cpu className="w-3 h-3" /> Motor local</>}</span>}
        </h3>
        <Button size="sm" variant="outline" onClick={gerar} disabled={busy}>{busy ? <Spinner className="w-4 h-4" /> : <><Sparkles className="w-4 h-4" /> {data ? 'Gerar de novo' : 'Analisar com IA'}</>}</Button>
      </div>
      {busy ? <div className="flex items-center gap-2 text-sm text-muted py-2"><Spinner className="w-4 h-4 text-violet-500" /> Analisando seus dados…</div>
        : data ? <p className="text-sm whitespace-pre-line leading-relaxed">{data.text}</p>
        : <p className="text-sm text-muted">{apiKey ? 'Gere uma análise curta e personalizada com IA generativa (Gemini).' : 'Gere uma análise curta com o motor local (sem IA de terceiros).'}</p>}
    </Card>
  );
}
