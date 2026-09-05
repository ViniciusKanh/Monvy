import { useMemo, useState, useRef, useLayoutEffect } from 'react';
import { Ai } from '../api/entities.js';
import { Card, Spinner } from './ui';
import { toast } from '../lib/toast.js';
import { Cloud, Sparkles, Cpu, RefreshCw } from 'lucide-react';

const STOP = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'as', 'os', 'em', 'no', 'na', 'para', 'por', 'com', 'ltda', 'me', 'sa', 'pagamento', 'compra', 'cartao', 'cartão', 'credito', 'crédito', 'parcela', 'parc', 'fatura']);
const PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#14b8a6', '#a855f7', '#0ea5e9'];
const CLOUD_KEY = 'monvy_wordcloud';

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

function localCloud(cardTxs, transactions) {
  const src = [...(cardTxs || []).map((t) => ({ d: t.description, a: Number(t.amount || 0) })),
    ...(transactions || []).filter((t) => t.type === 'expense').map((t) => ({ d: t.description, a: Number(t.amount || 0) }))];
  const map = {};
  for (const { d, a } of src) {
    if (!d || a <= 0) continue;
    const words = norm(d).split(' ').filter((w) => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w));
    const key = words.slice(0, 2).join(' ');
    if (key) map[key] = (map[key] || 0) + a;
  }
  const arr = Object.entries(map).map(([w, v]) => ({ w, v })).sort((a, b) => b.v - a.v).slice(0, 26);
  const max = arr[0]?.v || 1;
  return arr.map((x) => ({ w: x.w, p: Math.max(1, Math.round((x.v / max) * 10)) }));
}

// empacotamento em espiral (tipo word cloud): a maior fica no centro; as demais
// giram em volta procurando o primeiro lugar sem colisão.
function packCloud(words, W, H) {
  if (!W || !H) return [];
  const ranked = [...words].sort((a, b) => b.p - a.p);
  const cx = W / 2, cy = H / 2;
  const scale = Math.min(1.4, Math.max(0.9, W / 620)); // telas maiores => palavras maiores
  const placed = [];
  const hit = (a, b) => !(a.x + a.bw < b.x - 2 || a.x > b.x + b.bw + 2 || a.y + a.bh < b.y - 1 || a.y > b.y + b.bh + 1);
  for (const word of ranked) {
    const fs = (11 + word.p * 2.2) * scale;
    const bw = Math.max(fs * 0.7, word.w.length * fs * 0.52);
    const bh = fs * 1.08;
    let done = false;
    for (let s = 0; s < 6000; s++) {
      const angle = 0.5 * s;
      const radius = 2.0 * Math.sqrt(s);
      const x = cx + radius * Math.cos(angle) - bw / 2;
      const y = cy + radius * Math.sin(angle) * 0.6 - bh / 2;
      if (x < 2 || y < 2 || x + bw > W - 2 || y + bh > H - 2) continue;
      const box = { x, y, bw, bh };
      if (placed.every((p) => !hit(p, box))) { placed.push({ ...word, x, y, bw, bh, fs }); done = true; break; }
    }
    if (!done && placed.length === 0) placed.push({ ...word, x: cx - bw / 2, y: cy - bh / 2, bw, bh, fs });
  }
  return placed;
}

export function AiWordCloud({ cardTxs = [], transactions = [], apiKey }) {
  const local = useMemo(() => localCloud(cardTxs, transactions), [cardTxs, transactions]);
  const [cloud, setCloud] = useState(() => { try { return JSON.parse(localStorage.getItem(CLOUD_KEY)) || null; } catch { return null; } });
  const [busy, setBusy] = useState(false);
  const boxRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 300 });

  const words = (cloud?.words?.length ? cloud.words : local);
  const via = cloud?.via;

  useLayoutEffect(() => {
    if (!boxRef.current) return;
    const el = boxRef.current;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [words.length]);

  const placed = useMemo(() => packCloud(words, size.w, size.h), [words, size]);

  const gerar = async () => {
    setBusy(true);
    try {
      if (apiKey && local.length) {
        const itens = local.slice(0, 20).map((x) => `${x.w}:${x.p}`).join(', ');
        const question = `Estes são meus gastos (item:peso): ${itens}. Escolha até 18 palavras/expressões curtas (1-2 palavras) que melhor representam para onde vai meu dinheiro e dê um peso de 1 a 10 (maior = mais gasto). Responda SOMENTE um JSON: [{"w":"palavra","p":numero}]`;
        const { answer } = await Ai.ask(question, { gastos: itens }, apiKey, [], { name: 'Analista', focus: 'gastos' });
        const m = String(answer || '').match(/\[[\s\S]*\]/);
        if (m) {
          const parsed = JSON.parse(m[0]).filter((x) => x && x.w).map((x) => ({ w: String(x.w).slice(0, 22), p: Math.max(1, Math.min(10, Number(x.p) || 5)) })).slice(0, 20);
          if (parsed.length) { const payload = { words: parsed, via: 'gemini', at: Date.now() }; setCloud(payload); try { localStorage.setItem(CLOUD_KEY, JSON.stringify(payload)); } catch { /* ignore */ } setBusy(false); return; }
        }
      }
      const payload = { words: local, via: 'local', at: Date.now() };
      setCloud(payload); try { localStorage.setItem(CLOUD_KEY, JSON.stringify(payload)); } catch { /* ignore */ }
    } catch (e) { toast.error(e.message || 'Não consegui gerar a nuvem.'); }
    finally { setBusy(false); }
  };

  return (
    <Card>
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
        <div ref={boxRef} className="relative w-full h-44 sm:h-52 rounded-2xl overflow-hidden select-none"
          style={{ background: 'radial-gradient(120% 120% at 50% 45%, hsl(var(--muted)/0.08), transparent 72%)' }}>
          {placed.map((x, i) => (
            <span key={i} title={`peso ${x.p}`}
              className="absolute font-display font-bold leading-none whitespace-nowrap transition-transform hover:scale-110 cursor-default"
              style={{ left: x.x, top: x.y, fontSize: x.fs, color: PALETTE[i % PALETTE.length], opacity: 0.5 + (x.p / 10) * 0.5 }}>
              {x.w}
            </span>
          ))}
        </div>
      )}
      {!cloud && apiKey && <p className="text-[11px] text-muted text-center mt-2">Toque em “Gerar com IA” para o Gemini organizar a nuvem a partir da sua fatura.</p>}
    </Card>
  );
}
