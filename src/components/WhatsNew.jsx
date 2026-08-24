import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, X, ArrowRight, TrendingUp, ArrowRightLeft, CalendarDays, Building2, ShieldCheck, CreditCard } from 'lucide-react';

const KEY = 'monvy_whatsnew_v3';
const ITEMS = [
  { icon: TrendingUp, color: '#10b981', title: 'Mercado & Indicadores', desc: 'Cotações do dolar/euro/bitcoin e Selic, CDI e IPCA — com o impacto no seu bolso.', path: '/mercado' },
  { icon: CreditCard, color: '#8b5cf6', title: 'Cartão mais inteligente', desc: 'Importe a fatura em PDF e o Monvy separa e categoriza tudo, já considerando estornos.', path: '/cartões' },
  { icon: ArrowRightLeft, color: '#6366f1', title: 'Conversor de Moedas', desc: 'Converta Real para dolar, euro e mais com a cotacao do dia.', path: '/conversor' },
  { icon: CalendarDays, color: '#0ea5e9', title: 'Feriados Nacionais', desc: 'Veja os feriados e saiba quando um vencimento cai em dia não útil.', path: '/feriados' },
  { icon: Building2, color: '#a855f7', title: 'Consulta CNPJ', desc: 'Identifique estabelecimentos e agilize a categorizacao dos gastos.', path: '/cnpj' },
  { icon: ShieldCheck, color: '#f59e0b', title: 'Verificacao em duas etapas', desc: 'Proteja sua conta com um app autenticador, em Configurações.', path: '/configuracoes' },
];

export function WhatsNew() {
  const navigate = useNavigate();
  const [seen, setSeen] = useState(() => { try { return localStorage.getItem(KEY) === '1'; } catch { return true; } });
  if (seen) return null;

  const dismiss = () => { try { localStorage.setItem(KEY, '1'); } catch {} setSeen(true); };
  const go = (path) => { dismiss(); navigate(path); };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg card p-0 overflow-hidden animate-[popIn_.2s_ease] max-h-[90vh] flex flex-col">
        <div className="relative p-5 text-white shrink-0" style={{ background: 'linear-gradient(135deg,#059669 0%,#0d9488 55%,#6366f1 100%)' }}>
          <button onClick={dismiss} className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center"><X className="w-4 h-4" /></button>
          <div className="flex items-center gap-2 text-[11px] tracking-[0.28em] font-medium text-emerald-100"><Sparkles className="w-3.5 h-3.5" /> NOVIDADES</div>
          <h2 className="font-display text-2xl font-extrabold mt-2">O Monvy ficou mais completo 🎉</h2>
          <p className="text-emerald-50 text-sm mt-1">Conheca os novos recursos. Toque em um para abrir agora.</p>
        </div>

        <div className="p-3 overflow-y-auto flex-1">
          {ITEMS.map((it, i) => (
            <button key={i} onClick={() => go(it.path)} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition text-left group">
              <span className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: it.color }}><it.icon className="w-5 h-5" /></span>
              <div className="min-w-0 flex-1"><p className="font-semibold text-sm">{it.title}</p><p className="text-xs text-muted leading-tight">{it.desc}</p></div>
              <ArrowRight className="w-4 h-4 text-muted group-hover:translate-x-0.5 transition shrink-0" />
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-[hsl(var(--border))] shrink-0">
          <button onClick={dismiss} className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold transition">Explorar por conta propria</button>
        </div>
      </div>
    </div>
  );
}
