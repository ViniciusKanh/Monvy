import { useMemo, useState } from 'react';
import { Ai } from '../api/entities.js';
import { Card, Spinner } from './ui';
import { toast } from '../lib/toast.js';
import { Cloud, Sparkles, Cpu, RefreshCw } from 'lucide-react';

const STOP = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'as', 'os', 'em', 'no', 'na', 'para', 'por', 'com', 'ltda', 'me', 'sa', 'pagamento', 'compra', 'cartao', 'cartão', 'credito', 'crédito', 'parcela', 'parc', 'fatura']);
const PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#0ea5e9'];
const CLOUD_KEY = 'monvy_wordcloud';

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

// nuvem local a partir das descrições da fatura/cartão, ponderada por valor
function localCloud(cardTxs, transactions) {
  const src = [...(cardTxs || []).map((t) => ({ d: t.description, a: Number(t.amount || 0) })),
    ...(transactions || []).filter((t) => t.type === 'expense').map((t) => ({ d: t.description, a: Number(t.amount || 0) }))];
  const map = {};
  for (const { d, a } of src) {
    if (!d || a <= 0) continue;
    const words = norm(d).split(' ').filter((w) => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w));
    // usa a expressão inteira (curta) como palavra principal, mais os tokens
    const key = words.slice(0, 2).join(' ');
    if (key) map[key] = (map[key] || 0) + a;
  }
  const arr = Object.entries(map).map(([w, v]) => ({ w, v })).sort((a, b) => b.v - a.v).slice(0, 22);
  const max = arr[0]?.v || 1;
  return arr.map((x) => ({ w: x.w, p: Math.max(1, Math.round((x.v / max) * 10)) }));
}

export function AiWordCloud({ cardTxs = [], transactions = [], apiKey, compact }) {
  const local = useMemo(() => localCloud(cardTxs, transactions), [cardTxs, transactions]);
  const [cloud, setCloud] = useState(() => { try { return JSON.parse(localStorage.getItem(CLOUD_KEY)) || null; } catch { return null; } });
  const [busy, setBusy] = useState(false);

  const words = (cloud?.words?.length ? cloud.words : local);
  const via = cloud?.via;

  const gerar = async () => {
    setBusy(true);
    try {
      if (apiKey && local.length) {
        // prompt enxuto: manda só item:peso e pede JSON curto
        const itens = local.slice(0, 20).map((x) => `${x.w}:${x.p}`).join(', ');
        const question = `Estes são meus gastos (item:peso): ${itens}. Escolha até 16 palavras/expressões curtas (1-2 palavras) que melhor representam para onde vai meu dinheiro e dê um peso de 1 a 10 (maior = mais gasto). Responda SOMENTE um JSON: [{"w":"palavra","p":numero}]`;
        const { answer } = await Ai.ask(question, { gastos: itens }, apiKey, [], { name: 'Analista', focus: 'gastos' });
        const m = String(answer || '').match(/\[[\s\S]*\]/);
        if (m) {
          const parsed = JSON.parse(m[0]).filter((x) => x && x.w).map((x) => ({ w: String(x.w).slice(0, 24), p: Math.max(1, Math.min(10, Number(x.p) || 5)) })).slice(0, 18);
          if (parsed.length) { const payload = { words: parsed, via: 'gemini', at: Date.now() }; setCloud(payload); try { localStorage.setItem(CLOUD_KEY, JSON.stringify(payload)); } catch { /* ignore */ } setBusy(false); return; }
        }
      }
      const payload = { words: local, via: 'local', at: Date.now() };
      setCloud(payload); try { localStorage.setItem(CLOUD_KEY, JSON.stringify(payload)); } catch { /* ignore */ }
    } catch (e) { toast.error(e.message || 'Não consegui gerar a nuvem.'); }
    finally { setBusy(false); }
  };

  return (
    <Card className={compact ? 'py-4' : ''}>
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <h3 className="font-semibold flex items-center gap-2"><Cloud className="w-4 h-4 text-indigo-500" /> Nuvem de gastos da fatura
          {via && <span className="text-[10px] font-normal text-muted inline-flex items-center gap-1 ml-1">{via === 'gemini' ? <><Sparkles className="w-3 h-3 text-emerald-500" /> IA</> : <><Cpu className="w-3 h-3" /> local</>}</span>}
        </h3>
        <button onClick={gerar} disabled={busy} className="text-xs font-semibold text-emerald-600 hover:underline flex items-center gap-1 disabled:opacity-50">
          {busy ? <Spinner className="w-3.5 h-3.5" /> : <RefreshCw className="w-3.5 h-3.5" />} {cloud ? 'Atualizar' : (apiKey ? 'Gerar com IA' : 'Gerar')}
        </button>
      </div>
      {words.length === 0 ? (
        <p className="text-sm text-muted py-6 text-center">Sem gastos de cartão suficientes para montar a nuvem. Importe uma fatura ou lance compras no cartão.</p>
      ) : (
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 py-4">
          {words.map((x, i) => (
            <span key={i} className="font-display font-bold leading-none transition hover:scale-110 cursor-default"
              style={{ fontSize: `${12 + x.p * 2.2}px`, color: PALETTE[i % PALETTE.length], opacity: 0.55 + (x.p / 10) * 0.45 }}
              title={`peso ${x.p}`}>{x.w}</span>
          ))}
        </div>
      )}
      {!cloud && apiKey && <p className="text-[11px] text-muted text-center">Toque em “Gerar com IA” para o Gemini organizar a nuvem a partir da sua fatura.</p>}
    </Card>
  );
}
