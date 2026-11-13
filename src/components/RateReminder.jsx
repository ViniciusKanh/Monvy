import { useEffect, useState } from 'react';
import { Star, X } from 'lucide-react';
import { Button } from './ui';

// Lembrete de avaliação na loja. Definido pelo admin (campanha), aparece UMA
// vez por campanha e marca como lido no dispositivo (não volta a aparecer).
export function RateReminder({ campaign }) {
  const [open, setOpen] = useState(false);
  const flag = campaign?.id ? `monvy_rate_${campaign.id}` : null;

  useEffect(() => {
    if (!campaign || !campaign.active || !flag) return;
    try { if (localStorage.getItem(flag)) return; } catch { return; }
    const t = setTimeout(() => setOpen(true), 1800); // deixa a tela carregar antes
    return () => clearTimeout(t);
  }, [campaign, flag]);

  const dismiss = () => { try { if (flag) localStorage.setItem(flag, '1'); } catch { /* */ } setOpen(false); };
  const rate = () => { try { if (campaign.url) window.open(campaign.url, '_blank', 'noopener'); } catch { /* */ } dismiss(); };

  if (!open || !campaign) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/50 animate-fadeIn" onClick={dismiss}>
      <div className="w-full max-w-sm rounded-3xl bg-[hsl(var(--card))] shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="relative p-6 text-center text-white" style={{ background: 'linear-gradient(135deg,#059669,#0d9488)' }}>
          <button onClick={dismiss} className="absolute top-3 right-3 text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
          <div className="w-16 h-16 rounded-2xl bg-white/15 mx-auto flex items-center justify-center">
            <Star className="w-8 h-8" fill="currentColor" />
          </div>
          <div className="flex justify-center gap-1 mt-3">
            {[0, 1, 2, 3, 4].map((i) => <Star key={i} className="w-5 h-5 text-amber-300" fill="currentColor" />)}
          </div>
        </div>
        <div className="p-6 text-center">
          <h3 className="font-display text-lg font-bold">{campaign.title || 'Gostando do Monvy?'}</h3>
          <p className="text-sm text-muted mt-2 leading-relaxed">{campaign.message || 'Sua avaliação nos ajuda demais. Que tal avaliar na loja?'}</p>
          <div className="mt-5 flex flex-col gap-2">
            {campaign.url ? <Button className="w-full" onClick={rate}><Star className="w-4 h-4" /> Avaliar na loja</Button> : null}
            <Button variant="ghost" className="w-full" onClick={dismiss}>Agora não</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
