import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Landmark, ChevronRight, CheckCircle2, CircleDashed } from 'lucide-react';
import { Card } from './ui';
import { Reveal } from './Animated.jsx';
import { formatCurrency, monthKey } from '../lib/utils.js';
import { Transaction, CreditCardTransaction, TaxLedger, FiscalNote } from '../api/entities.js';
import { combineExpenses } from '../lib/analytics.js';
import { buildTaxRecords, aggregate, buildTaxAnalysis } from '../lib/taxBurden.js';
import { monthLabel } from '../lib/utils.js';

const LS_KEY = 'monvy:taxBurden:v1';
const DEFAULTS = { salarioBruto: '4200', dependentes: '0', deducoes: '', inssConfirmado: '392.60', irrfConfirmado: '0', ipvaAnual: '', iptuAnual: '' };
const nnum = (v) => { const x = Number(String(v).replace(',', '.')); return isNaN(x) ? 0 : x; };
function loadCfg() { try { const r = localStorage.getItem(LS_KEY); if (r) return { ...DEFAULTS, ...JSON.parse(r) }; } catch { /* */ } return { ...DEFAULTS }; }

// Card compacto da Carga Tributária para o Dashboard.
export function TaxBurdenCard() {
  const nav = useNavigate();
  const cfg = loadCfg();
  const nowMk = monthKey(new Date());
  const { data: txs = [] } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: cardTxs = [] } = useQuery({ queryKey: ['cardtx'], queryFn: () => CreditCardTransaction.list() });
  const { data: ledger = [] } = useQuery({ queryKey: ['tax-ledger', nowMk], queryFn: () => TaxLedger.list({ reference_month: nowMk }) });
  const { data: notes = [] } = useQuery({ queryKey: ['fiscal-notes'], queryFn: () => FiscalNote.list() });

  const { resumo, narrativa } = useMemo(() => {
    const gastos = combineExpenses(txs, cardTxs)
      .filter((t) => t.type === 'expense' && Number(t.amount) > 0 && String(t.date).slice(0, 7) === nowMk)
      .filter((t) => !/\biof\b/i.test(t.description || ''))
      .map((t) => ({ valor: Number(t.amount), descricao: t.description, categoria: t.category_id }));
    const iofConf = (ledger || []).filter((r) => r.kind === 'IOF').reduce((s, r) => s + Number(r.amount || 0), 0);
    const nfeConf = (notes || []).filter((r) => String(r.reference_month || '') === nowMk).reduce((s, r) => s + Number(r.total_tax || 0), 0);
    const recs = buildTaxRecords({
      ano: Number(nowMk.slice(0, 4)), mes: Number(nowMk.slice(5, 7)),
      salarioBruto: nnum(cfg.salarioBruto), dependentes: nnum(cfg.dependentes), deducoes: nnum(cfg.deducoes),
      inssConfirmado: cfg.inssConfirmado === '' ? undefined : nnum(cfg.inssConfirmado),
      irrfConfirmado: cfg.irrfConfirmado === '' ? undefined : nnum(cfg.irrfConfirmado),
      gastos, ipvaAnual: nnum(cfg.ipvaAnual), iptuAnual: nnum(cfg.iptuAnual),
      iofLancado: iofConf, nfeConfirmado: nfeConf,
    });
    const rb = nnum(cfg.salarioBruto);
    const ag = aggregate(recs, rb);
    const gastoTotal = gastos.reduce((s, g) => s + Number(g.valor), 0);
    const an = buildTaxAnalysis({ mesLabel: monthLabel(nowMk), rendaBruta: rb, gastoTotal, records: recs, resumo: ag });
    return { resumo: ag, narrativa: an.narrativa };
  }, [txs, cardTxs, nowMk, ledger, notes]);

  if (!resumo.temDadoSuficiente) return null;

  return (
    <Reveal>
      <Card className="cursor-pointer hover-lift" onClick={() => nav('/carga-tributaria')}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow" style={{ background: 'linear-gradient(135deg,#065f46,#0d9488)' }}>
              <Landmark className="w-5 h-5" />
            </span>
            <div>
              <p className="text-sm text-muted">Carga tributária do mês</p>
              <p className="font-display text-2xl font-bold leading-tight">{formatCurrency(resumo.totalCarga)}</p>
              <p className="text-xs text-muted">{resumo.percentualCarga.toFixed(1)}% da renda · ≈ {Math.round(resumo.diasEquivalentes)} dias/ano</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-muted" />
        </div>
        {narrativa && <p className="text-xs text-muted mt-2 leading-relaxed line-clamp-2">{narrativa}</p>}
        <div className="flex gap-4 mt-3 text-xs">
          <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 className="w-3.5 h-3.5" /> Confirmado {formatCurrency(resumo.totalConfirmado)}</span>
          <span className="inline-flex items-center gap-1 text-amber-600"><CircleDashed className="w-3.5 h-3.5" /> Estimado {formatCurrency(resumo.totalEstimado)}</span>
        </div>
      </Card>
    </Reveal>
  );
}
