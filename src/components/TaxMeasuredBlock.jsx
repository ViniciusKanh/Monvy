import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Landmark, CreditCard, FileText, PiggyBank, ChevronRight, Wallet } from 'lucide-react';
import { Card } from './ui';
import { Reveal } from './Animated.jsx';
import { formatCurrency } from '../lib/utils.js';
import { TaxLedger, FiscalNote, CreditCardTransaction, Payslip } from '../api/entities.js';
import { iofForYear } from '../lib/cardTaxes.js';

// Bloco do rodapé do Dashboard: tributos medidos por documento no ano
// (IOF das faturas + notas fiscais + IR do informe). Link para a tela Impostos.
export function TaxMeasuredBlock({ variant = 'card' } = {}) {
  const nav = useNavigate();
  const year = new Date().getFullYear();
  const { data: ledger = [] } = useQuery({ queryKey: ['tax-ledger-all'], queryFn: () => TaxLedger.list() });
  const { data: notes = [] } = useQuery({ queryKey: ['fiscal-notes'], queryFn: () => FiscalNote.list() });
  const { data: cardTxs = [] } = useQuery({ queryKey: ['cardtx'], queryFn: () => CreditCardTransaction.list() });
  const { data: payslips = [] } = useQuery({ queryKey: ['payslips'], queryFn: () => Payslip.list() });

  const d = useMemo(() => {
    const ys = String(year);
    const iof = iofForYear(year, ledger, cardTxs);
    const ir = ledger.filter((r) => r.source === 'informe' && Number(r.year) === year).reduce((s, r) => s + Number(r.amount || 0), 0);
    const nfe = notes.filter((r) => String(r.reference_month || '').startsWith(ys)).reduce((s, r) => s + Number(r.total_tax || 0), 0);
    // INSS + IRRF dos holerites guardados (Salário Líquido)
    const folha = payslips.filter((p) => String(p.competence || '').startsWith(ys)).reduce((s, p) => s + Number(p.inss || 0) + Number(p.irrf || 0), 0);
    return { iof, ir, nfe, folha, total: iof + ir + nfe + folha };
  }, [ledger, notes, year, cardTxs, payslips]);

  if (d.total <= 0) return null;
  const pct = (v) => (d.total > 0 ? (v / d.total) * 100 : 0);

  if (variant === 'compact') {
    return (
      <button type="button" onClick={() => nav('/impostos')} className="card !rounded-xl p-4 text-left hover-lift flex flex-col">
        <div className="flex items-center justify-between w-full"><h3 className="font-semibold text-sm">Impostos medidos em {year}</h3><ChevronRight className="w-4 h-4 text-muted" /></div>
        <p className="font-display text-2xl font-extrabold mt-3">{formatCurrency(d.total)}</p>
        <div className="mt-3 h-2 w-full rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800">
          <div style={{ width: `${pct(d.iof)}%`, background: '#6d28d9' }} />
          <div style={{ width: `${pct(d.nfe)}%`, background: '#059669' }} />
          <div style={{ width: `${pct(d.ir)}%`, background: '#2563eb' }} />
          <div style={{ width: `${pct(d.folha)}%`, background: '#ec4899' }} />
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 text-[10px]">
          <span className="inline-flex items-center gap-1 text-violet-600 dark:text-violet-300"><CreditCard className="w-3 h-3" /> IOF {formatCurrency(d.iof)}</span>
          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-300"><FileText className="w-3 h-3" /> Notas {formatCurrency(d.nfe)}</span>
          <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-300"><PiggyBank className="w-3 h-3" /> IR {formatCurrency(d.ir)}</span>
          {d.folha > 0 && <span className="inline-flex items-center gap-1 text-pink-600 dark:text-pink-300"><Wallet className="w-3 h-3" /> Holerites {formatCurrency(d.folha)}</span>}
        </div>
      </button>
    );
  }

  return (
    <Reveal>
      <Card className="cursor-pointer hover-lift" onClick={() => nav('/impostos')}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2"><Landmark className="w-4 h-4 text-emerald-600" /> Impostos medidos em {year}</h3>
          <span className="text-sm text-muted inline-flex items-center gap-1">ver análise <ChevronRight className="w-4 h-4" /></span>
        </div>
        <p className="font-display text-3xl font-extrabold mt-1">{formatCurrency(d.total)}</p>
        <div className="mt-3 h-2.5 rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800">
          <div style={{ width: `${pct(d.iof)}%`, background: '#6d28d9' }} />
          <div style={{ width: `${pct(d.nfe)}%`, background: '#059669' }} />
          <div style={{ width: `${pct(d.ir)}%`, background: '#2563eb' }} />
          <div style={{ width: `${pct(d.folha)}%`, background: '#ec4899' }} />
        </div>
        <div className="flex flex-wrap gap-4 mt-3 text-sm">
          <span className="inline-flex items-center gap-1.5 text-violet-600"><CreditCard className="w-4 h-4" /> IOF {formatCurrency(d.iof)}</span>
          <span className="inline-flex items-center gap-1.5 text-emerald-600"><FileText className="w-4 h-4" /> Notas {formatCurrency(d.nfe)}</span>
          <span className="inline-flex items-center gap-1.5 text-blue-600"><PiggyBank className="w-4 h-4" /> IR {formatCurrency(d.ir)}</span>
          {d.folha > 0 && <span className="inline-flex items-center gap-1.5 text-pink-600"><Wallet className="w-4 h-4" /> Holerites (INSS+IRRF) {formatCurrency(d.folha)}</span>}
        </div>
      </Card>
    </Reveal>
  );
}
