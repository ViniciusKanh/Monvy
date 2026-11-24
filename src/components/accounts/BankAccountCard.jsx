import { useMemo, useState } from 'react';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';
import { Wallet, Landmark, PiggyBank, CreditCard as CardIcon, MoreVertical, Pencil, Trash2, Star, ArrowUp, ArrowDown } from 'lucide-react';
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
  const up = variation >= 0;

  // detalhes reais da conta: tipo + agencia/conta (se cadastradas) ou banco/COMPE
  const details = [TYPE_LABEL[account.account_type] || 'Conta'];
  if (account.agency) details.push(`Ag. ${account.agency}`);
  if (account.account_number) details.push(`Cc. ${account.account_number}`);
  if (!account.agency && !account.account_number && bankInfo?.code) details.push(`COMPE ${bankInfo.code}`);

  return (
    <div className="relative overflow-hidden rounded-2xl px-5 py-4 text-white shadow-card hover-lift h-full ring-1 ring-white/20"
      style={{ background: bankGradient(account) }} title="Arraste para reordenar">
      <div className="absolute -right-10 -top-12 w-40 h-40 rounded-full bg-white/10 pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />

      {/* topo: logo + nome + detalhes | favorito + menu */}
      <div className="relative flex items-start gap-3">
        <div className="relative w-12 h-12 rounded-xl bg-white shadow flex items-center justify-center overflow-hidden shrink-0"
          title={bankInfo?.fullName ? `${bankInfo.fullName}${bankInfo.code ? ` · COMPE ${bankInfo.code}` : ''}` : undefined}>
          {showLogo
            ? <img src={bankInfo.logoUrl} alt={bankInfo.fullName || account.bank || ''} className="w-8 h-8 object-contain" onError={() => setLogoBroken(true)} />
            : <Icon className="w-6 h-6" style={{ color: account.color || '#0d1433' }} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display font-bold text-lg leading-tight truncate">{account.name}</p>
          <span className="inline-block max-w-full truncate text-[11px] mt-1 px-2 py-0.5 rounded-md bg-black/20 ring-1 ring-white/15" title={bankInfo?.fullName || account.bank || undefined}>
            {details.join(' • ')}
          </span>
        </div>
        <div className="flex items-center gap-0.5 shrink-0 -mr-1.5 -mt-1">
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

      {/* base: saldo | sparkline | variação 30 dias */}
      <div className="relative flex items-end gap-3 mt-4">
        <p className={`font-display text-[1.7rem] leading-none font-extrabold whitespace-nowrap drop-shadow ${neg ? 'text-rose-100' : ''}`} title={`${pct}% do saldo consolidado`}>{formatCurrency(account.current_balance)}</p>
        <div className="flex-1 min-w-[40px] h-9 opacity-90">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`spark-${account.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fff" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#fff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis hide domain={['dataMin', 'dataMax']} />
              <Area type="monotone" dataKey="value" stroke="rgba(255,255,255,.9)" strokeWidth={1.75} fill={`url(#spark-${account.id})`} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="text-right shrink-0 leading-tight">
          <p className={`text-xs font-bold flex items-center justify-end gap-0.5 ${up ? 'text-emerald-200' : 'text-rose-200'}`}>
            {up ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
            {variationPct != null ? `${variationPct >= 0 ? '+' : ''}${variationPct.toFixed(1).replace('.', ',')}%` : formatCurrency(variation)}
          </p>
          <p className="text-[11px] text-white/75">(30 dias)</p>
        </div>
      </div>
    </div>
  );
}
