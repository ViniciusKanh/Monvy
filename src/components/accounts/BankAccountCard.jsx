import { useMemo, useState } from 'react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { Wallet, Landmark, PiggyBank, CreditCard as CardIcon, MoreVertical, Pencil, Trash2, Star, TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency } from '../../lib/utils.js';
import { bankGradient } from '../../lib/bankColors.js';
import { buildBalanceSeries } from '../../lib/accountBalanceSeries.js';

const TYPE_ICON = { checking: Landmark, savings: PiggyBank, wallet: Wallet, credit_card: CardIcon };
const TYPE_LABEL = { checking: 'Conta Corrente', savings: 'Poupança', wallet: 'Carteira', credit_card: 'Cartão' };

export function BankAccountCard({ account, transactions, consolidatedPositive, isFavorite, onToggleFavorite, onEdit, onDelete, bankInfo }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoBroken, setLogoBroken] = useState(false);
  const Icon = TYPE_ICON[account.account_type] || Wallet;
  const showLogo = !!bankInfo?.logoUrl && !logoBroken;
  const neg = Number(account.current_balance) < 0;
  const pct = consolidatedPositive > 0 ? Math.round((Math.max(0, Number(account.current_balance || 0)) / consolidatedPositive) * 100) : 0;

  const accTx = useMemo(() => transactions.filter((t) => t.account_id === account.id || t.account_to_id === account.id), [transactions, account.id]);
  const series = useMemo(() => buildBalanceSeries({
    transactions: accTx, initialTotal: Number(account.initial_balance || 0), days: 30, accountIds: new Set([account.id]),
  }), [accTx, account.id, account.initial_balance]);

  const variation = series.length ? series[series.length - 1].value - series[0].value : 0;
  const variationPct = series.length && series[0].value !== 0 ? (variation / Math.abs(series[0].value)) * 100 : null;

  return (
    <div className="relative overflow-hidden rounded-2xl p-5 text-white shadow-card hover-lift h-full"
      style={{ background: bankGradient(account) }}>
      <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-white/10" />
      <div className="relative flex items-start justify-between">
        <div className="relative w-11 h-11 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center overflow-hidden"
          title={bankInfo?.fullName ? `${bankInfo.fullName}${bankInfo.code ? ` · COMPE ${bankInfo.code}` : ''}` : undefined}>
          {showLogo
            ? <img src={bankInfo.logoUrl} alt={bankInfo.fullName || account.bank || ''} className="w-7 h-7 object-contain" onError={() => setLogoBroken(true)} />
            : <Icon className="w-5 h-5" />}
          {showLogo && (
            <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-black/30 backdrop-blur flex items-center justify-center ring-1 ring-white/20">
              <Icon className="w-2.5 h-2.5" />
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => onToggleFavorite(account.id)} title={isFavorite ? 'Remover dos favoritos' : 'Marcar como favorita'} aria-label={isFavorite ? 'Remover dos favoritos' : 'Marcar como favorita'} aria-pressed={isFavorite} className="p-1.5 rounded-lg hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/60 outline-none">
            <Star className={`w-4 h-4 ${isFavorite ? 'fill-amber-300 text-amber-300' : ''}`} />
          </button>
          <div className="relative">
            <button onClick={() => setMenuOpen((v) => !v)} aria-label="Mais opções da conta" aria-haspopup="menu" aria-expanded={menuOpen} className="p-1.5 rounded-lg hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/60 outline-none"><MoreVertical className="w-4 h-4" /></button>
            {menuOpen && (
              <div role="menu" className="absolute right-0 mt-1 w-32 card p-1 z-10 text-[hsl(var(--text))]">
                <button onClick={() => { onEdit(account); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-black/5 dark:hover:bg-white/10"><Pencil className="w-3.5 h-3.5" /> Editar</button>
                <button onClick={() => { onDelete(account.id); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"><Trash2 className="w-3.5 h-3.5" /> Excluir</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="relative font-medium mt-4 text-white/90 truncate">{account.name}</p>
      <span className="relative inline-flex items-center gap-1 text-[11px] mt-1 px-2 py-0.5 rounded-full bg-white/15" title={bankInfo?.fullName || undefined}>
        {TYPE_LABEL[account.account_type] || 'Conta'}{account.bank ? ` · ${account.bank}` : ''}{bankInfo?.code ? ` · COMPE ${bankInfo.code}` : ''}
      </span>
      <p className={`relative font-display text-3xl font-extrabold mt-3 ${neg ? 'text-rose-200' : ''}`}>{formatCurrency(account.current_balance)}</p>

      <div className="relative flex items-center justify-between mt-3">
        <span className={`inline-flex items-center gap-1 text-xs font-medium ${variation >= 0 ? 'text-emerald-200' : 'text-rose-200'}`}>
          {variation >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          {variationPct != null ? `${variationPct >= 0 ? '+' : ''}${variationPct.toFixed(1)}%` : formatCurrency(variation)} em 30d
        </span>
        <span className="text-[11px] text-white/70">{pct}% do total</span>
      </div>

      <div className="relative h-10 -mx-1 mt-1 opacity-90">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series}>
            <defs>
              <linearGradient id={`spark-${account.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fff" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#fff" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="value" stroke="#fff" strokeWidth={1.5} fill={`url(#spark-${account.id})`} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
