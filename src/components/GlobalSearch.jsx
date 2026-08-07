import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Account, Transaction, Category, CreditCard, Goal, Subscription, Investment, Debt } from '../api/entities.js';
import { formatCurrency } from '../lib/utils.js';
import { Search, X, Wallet, ArrowLeftRight, CreditCard as CardIcon, Tags, Target, RefreshCw, LineChart, Landmark, CornerDownLeft } from 'lucide-react';

export function openGlobalSearch() { window.dispatchEvent(new Event('monvy-open-search')); }

export function GlobalSearch() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const inputRef = useRef(null);

  const enabled = open;
  const { data: transactions = [] } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list(), enabled });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => Account.list(), enabled });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list(), enabled });
  const { data: cards = [] } = useQuery({ queryKey: ['cards'], queryFn: () => CreditCard.list(), enabled });
  const { data: goals = [] } = useQuery({ queryKey: ['goals'], queryFn: () => Goal.list(), enabled });
  const { data: subs = [] } = useQuery({ queryKey: ['subscriptions'], queryFn: () => Subscription.list(), enabled });
  const { data: investments = [] } = useQuery({ queryKey: ['investments'], queryFn: () => Investment.list(), enabled });
  const { data: debts = [] } = useQuery({ queryKey: ['debts'], queryFn: () => Debt.list(), enabled });
  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((o) => !o); }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('monvy-open-search', onOpen);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('monvy-open-search', onOpen); window.removeEventListener('keydown', onKey); };
  }, []);
  useEffect(() => { if (open) { setQ(''); setTimeout(() => inputRef.current?.focus(), 30); } }, [open]);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    const num = s.replace(/[^0-9,.]/g, '').replace(',', '.');
    const hit = (txt) => String(txt || '').toLowerCase().includes(s);
    const out = [];
    // transacoes
    transactions.filter((t) => hit(t.description) || hit(catMap[t.category_id]?.name) || (num && String(t.amount).includes(num))).slice(0, 6)
      .forEach((t) => out.push({ group: 'Lancamentos', icon: ArrowLeftRight, label: t.description || catMap[t.category_id]?.name || 'Lancamento', sub: `${new Date(String(t.date).slice(0, 10) + 'T00:00').toLocaleDateString('pt-BR')} · ${formatCurrency(t.amount)}`, path: '/lancamentos' }));
    accounts.filter((a) => hit(a.name) || hit(a.bank)).slice(0, 4).forEach((a) => out.push({ group: 'Contas', icon: Wallet, label: a.name, sub: formatCurrency(a.current_balance || 0), path: '/contas' }));
    cards.filter((c) => hit(c.name)).slice(0, 4).forEach((c) => out.push({ group: 'Cartoes', icon: CardIcon, label: c.name, sub: c.brand || '', path: '/cartoes' }));
    categories.filter((c) => hit(c.name)).slice(0, 4).forEach((c) => out.push({ group: 'Categorias', icon: Tags, label: c.name, sub: c.type === 'income' ? 'Receita' : 'Despesa', path: '/categorias' }));
    goals.filter((g) => hit(g.name)).slice(0, 3).forEach((g) => out.push({ group: 'Metas & Cofres', icon: Target, label: g.name, sub: formatCurrency(g.current_amount || 0), path: '/metas' }));
    subs.filter((x) => hit(x.name)).slice(0, 3).forEach((x) => out.push({ group: 'Assinaturas', icon: RefreshCw, label: x.name, sub: formatCurrency(x.amount || 0), path: '/assinaturas' }));
    investments.filter((i) => hit(i.name) || hit(i.ticker)).slice(0, 3).forEach((i) => out.push({ group: 'Investimentos', icon: LineChart, label: i.name, sub: formatCurrency(i.current_value || 0), path: '/investimentos' }));
    debts.filter((d) => hit(d.name)).slice(0, 3).forEach((d) => out.push({ group: 'Dividas', icon: Landmark, label: d.name, sub: d.institution || '', path: '/dividas' }));
    return out;
  }, [q, transactions, accounts, cards, categories, goals, subs, investments, debts, catMap]);

  const grouped = useMemo(() => { const m = {}; for (const r of results) (m[r.group] = m[r.group] || []).push(r); return Object.entries(m); }, [results]);
  const go = (path) => { setOpen(false); navigate(path); };

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-start justify-center pt-[12vh] px-4" onMouseDown={() => setOpen(false)}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative w-full max-w-xl card p-0 overflow-hidden animate-[popIn_.15s_ease]" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[hsl(var(--border))]">
          <Search className="w-5 h-5 text-muted shrink-0" />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar lancamentos, contas, cartoes, metas, investimentos..." className="flex-1 bg-transparent outline-none text-sm" />
          <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {q.trim().length < 2 ? (
            <div className="p-8 text-center text-sm text-muted"><Search className="w-8 h-8 mx-auto mb-2 opacity-40" />Digite para buscar em todo o Monvy.<div className="mt-2 text-xs">Dica: abra a busca a qualquer momento com <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono">K</kbd></div></div>
          ) : grouped.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted">Nada encontrado para "{q}".</div>
          ) : grouped.map(([group, items]) => (
            <div key={group}>
              <p className="px-4 pt-3 pb-1 text-[10px] font-bold tracking-widest text-muted">{group.toUpperCase()}</p>
              {items.map((r, i) => (
                <button key={i} onClick={() => go(r.path)} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-black/5 dark:hover:bg-white/5 text-left">
                  <span className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0"><r.icon className="w-4 h-4" /></span>
                  <div className="min-w-0 flex-1"><p className="text-sm font-medium truncate">{r.label}</p>{r.sub && <p className="text-xs text-muted truncate">{r.sub}</p>}</div>
                  <CornerDownLeft className="w-3.5 h-3.5 text-muted opacity-0 group-hover:opacity-100" />
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
