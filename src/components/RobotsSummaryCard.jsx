import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Trigger, Notification, Robots, Transaction, Account, Category, Investment, Debt, Goal, Subscription, CreditCardInvoice, AppSettings } from '../api/entities.js';
import { useAuth } from '../context/AuthContext.jsx';
import { FOCUS_LABEL } from '../lib/assistant.js';
import { converse } from '../lib/chat.js';
import { Card, Button, Spinner } from './ui';
import { toast } from '../lib/toast.js';
import { Bot, RefreshCw, MessageSquare, ChevronRight, Sparkles, Cpu } from 'lucide-react';

const cfgOf = (a) => { try { return typeof a.config === 'string' ? JSON.parse(a.config) : (a.config || {}); } catch { return {}; } };
const rel = (iso) => { if (!iso) return ''; const d = (Date.now() - new Date(iso).getTime()) / 1000; if (!isFinite(d)) return ''; if (d < 3600) return `há ${Math.max(1, Math.round(d / 60))}min`; if (d < 86400) return `há ${Math.round(d / 3600)}h`; return `há ${Math.round(d / 86400)}d`; };

export function RobotsSummaryCard() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const SUM_KEY = 'monvy_robot_summary';
  const [summary, setSummary] = useState(() => { try { return JSON.parse(localStorage.getItem(SUM_KEY)) || null; } catch { return null; } }); // { parts, via, at, fired }
  const [summaryBusy, setSummaryBusy] = useState(false);
  const { data: agents = [], isLoading } = useQuery({ queryKey: ['triggers'], queryFn: () => Trigger.list(), refetchInterval: 60_000 });
  const { data: notifications = [] } = useQuery({ queryKey: ['notifications'], queryFn: () => Notification.list({ _limit: 50 }), refetchInterval: 60_000 });
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

  const robots = useMemo(() => agents.map((a) => { const c = cfgOf(a); return { id: a.id, name: a.name, emoji: c.emoji || '🤖', focus: FOCUS_LABEL[c.focus] || 'Assistente', active: c.monitor && a.enabled !== false, monitor: !!c.monitor, fired: a.last_fired }; }), [agents]);
  const activeCount = robots.filter((r) => r.active).length;
  const recentAlerts = useMemo(() => notifications.filter((n) => n.kind === 'alert' || n.kind === 'ticket').slice(0, 3), [notifications]);

  const gerarResumo = async (fired = 0) => {
    setSummaryBusy(true);
    try {
      const q = 'Faça um resumo curto e claro da minha situação financeira deste mês (saldo, entradas, saídas e o que mais se destaca) e traga 2 ou 3 insights práticos e acionáveis, cada um começando com um verbo. Seja direto e use números quando ajudar.';
      const { parts } = await converse({ question: q, ctx, agents, primary: null, apiKey, history: [] });
      const payload = { parts, via: parts[0]?.via, at: Date.now(), fired };
      setSummary(payload);
      try { localStorage.setItem(SUM_KEY, JSON.stringify(payload)); } catch { /* ignore */ }
    } catch (e) { toast.error(e.message || 'Não consegui gerar o resumo agora.'); } finally { setSummaryBusy(false); }
  };

  const check = async () => {
    setBusy(true);
    try {
      const { fired } = await Robots.check();
      qc.invalidateQueries({ queryKey: ['notifications'] }); qc.invalidateQueries({ queryKey: ['triggers'] });
      toast.success(fired ? `${fired} alerta(s) gerado(s) pelos robôs.` : 'Tudo certo — nenhum alerta agora.');
      await gerarResumo(fired);
    }
    catch (e) { toast.error(e.message || 'Falha ao verificar'); } finally { setBusy(false); }
  };

  if (isLoading) return <Card className="flex items-center justify-center py-10"><Spinner className="w-5 h-5 text-emerald-500" /></Card>;

  return (
    <Card className="hover-lift">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold flex items-center gap-2"><Bot className="w-5 h-5 text-emerald-500" /> Seus robôs</h3>
        <button onClick={() => navigate('/agentes')} className="text-xs text-emerald-600 hover:underline flex items-center gap-0.5">Central <ChevronRight className="w-3 h-3" /></button>
      </div>

      {robots.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-sm text-muted mb-3">Nenhum robô ainda. Contrate sua equipe pra monitorar tudo 24/7.</p>
          <Button size="sm" onClick={() => navigate('/agentes')}><Bot className="w-4 h-4" /> Contratar robôs</Button>
        </div>
      ) : (<>
        <div className="flex items-center gap-3 mb-3">
          <div className="flex -space-x-1.5">{robots.slice(0, 6).map((r) => <span key={r.id} className="relative w-9 h-9 rounded-xl flex items-center justify-center text-lg ring-2 ring-[hsl(var(--card))]" style={{ background: 'linear-gradient(135deg,#10b98122,#6366f122)' }} title={r.name}>{r.emoji}<span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[hsl(var(--card))] ${r.active ? 'bg-emerald-500' : 'bg-slate-400'}`} /></span>)}</div>
          <div className="text-sm"><span className="font-semibold">{activeCount}</span> <span className="text-muted">monitorando de {robots.length}</span></div>
        </div>

        {recentAlerts.length > 0 ? (
          <div className="space-y-1.5 mb-3">
            <p className="text-[11px] text-muted uppercase tracking-wide">Últimos sinais</p>
            {recentAlerts.map((n) => (
              <div key={n.id} className="flex items-center gap-2 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                <span className="flex-1 min-w-0 truncate">{n.title}{n.text ? ` — ${n.text}` : ''}</span>
                <span className="text-[10px] text-muted shrink-0">{rel(n.created_date)}</span>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-muted mb-3">Nenhum sinal recente. Seus robôs estão de olho.</p>}

        {(summaryBusy || summary) && (
          <div className="mb-3 rounded-xl border border-[hsl(var(--border))] bg-black/[0.02] dark:bg-white/[0.03] p-3">
            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
              <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Resumo dos robôs</span>
              {summary && !summaryBusy && <span className="text-[10px] text-muted">· {rel(new Date(summary.at).toISOString())}</span>}
              {summary && !summaryBusy && <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-muted">{summary.via === 'gemini' ? <><Sparkles className="w-3 h-3 text-emerald-500" /> IA generativa</> : <><Cpu className="w-3 h-3" /> Motor local</>}</span>}
            </div>
            {summaryBusy ? (
              <div className="flex items-center gap-2 text-sm text-muted py-1"><Spinner className="w-4 h-4 text-emerald-500" /> Os robôs estão analisando seus dados…</div>
            ) : (
              <div className="space-y-2.5">
                {summary.fired > 0 && <p className="text-[11px] text-amber-600 dark:text-amber-400">⚠ {summary.fired} alerta(s) gerado(s) nesta verificação.</p>}
                {summary.parts.map((p, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="w-6 h-6 rounded-lg flex items-center justify-center text-sm shrink-0" style={{ background: 'linear-gradient(135deg,#10b98122,#6366f122)' }}>{p.robot.emoji}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold">{p.robot.name} <span className="text-muted font-normal">· {p.robot.focusLabel}</span></p>
                      <p className="text-sm whitespace-pre-line leading-snug">{p.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1" onClick={check} disabled={busy || summaryBusy}>{busy || summaryBusy ? <Spinner className="w-4 h-4" /> : <><RefreshCw className="w-4 h-4" /> {summary ? 'Verificar de novo' : 'Verificar agora'}</>}</Button>
          <Button size="sm" className="flex-1" onClick={() => navigate('/chat')}><MessageSquare className="w-4 h-4" /> Perguntar</Button>
        </div>
      </>)}
    </Card>
  );
}
