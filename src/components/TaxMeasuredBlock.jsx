import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Landmark, CreditCard, FileText, PiggyBank, ChevronRight } from 'lucide-react';
import { Card } from './ui';
import { Reveal } from './Animated.jsx';
import { formatCurrency } from '../lib/utils.js';
import { TaxLedger, FiscalNote } from '../api/entities.js';

// Bloco do rodapé do Dashboard: tributos medidos por documento no ano
// (IOF das faturas + notas fiscais + IR do informe). Link para a tela Impostos.
export function TaxMeasuredBlock() {
  const nav = useNavigate();
  const year = new Date().getFullYear();
  const { data: ledger = [] } = useQuery({ queryKey: ['tax-ledger-all'], queryFn: () => TaxLedger.list() });
  const { data: notes = [] } = useQuery({ queryKey: ['fiscal-notes'], queryFn: () => FiscalNote.list() });

  const d = useMemo(() => {
    const ys = String(year);
    const iof = ledger.filter((r) => r.source === 'invoice' && r.kind === 'IOF' && String(r.reference_month || '').startsWith(ys)).reduce((s, r) => s + Number(r.amount || 0), 0);
    const ir = ledger.filter((r) => r.source === 'informe' && Number(r.year) === year).reduce((s, r) => s + Number(r.amount || 0), 0);
    const nfe = notes.filter((r) => String(r.reference_month || '').startsWith(ys)).reduce((s, r) => s + Number(r.total_tax || 0), 0);
    return { iof, ir, nfe, total: iof + ir + nfe };
  }, [ledger, notes, year]);

  if (d.total <= 0) return null;
  const pct = (v) => (d.total > 0 ? (v / d.total) * 100 : 0);

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
        </div>
        <div className="flex flex-wrap gap-4 mt-3 text-sm">
          <span className="inline-flex items-center gap-1.5 text-violet-600"><CreditCard className="w-4 h-4" /> IOF {formatCurrency(d.iof)}</span>
          <span className="inline-flex items-center gap-1.5 text-emerald-600"><FileText className="w-4 h-4" /> Notas {formatCurrency(d.nfe)}</span>
          <span className="inline-flex items-center gap-1.5 text-blue-600"><PiggyBank className="w-4 h-4" /> IR {formatCurrency(d.ir)}</span>
        </div>
      </Card>
    </Reveal>
  );
}
