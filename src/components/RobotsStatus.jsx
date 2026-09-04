import { useMemo, useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Trigger } from '../api/entities.js';
import { FOCUS_LABEL } from '../lib/assistant.js';
import { Bot } from 'lucide-react';

const cfgOf = (a) => { try { return typeof a.config === 'string' ? JSON.parse(a.config) : (a.config || {}); } catch { return {}; } };
function rel(iso) {
  if (!iso) return null;
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (!isFinite(d)) return null;
  if (d < 3600) return `há ${Math.max(1, Math.round(d / 60))} min`;
  if (d < 86400) return `há ${Math.round(d / 3600)}h`;
  return `há ${Math.round(d / 86400)}d`;
}

export function RobotsStatus({ dark }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { data: agents = [] } = useQuery({ queryKey: ['triggers'], queryFn: () => Trigger.list(), refetchInterval: 60_000 });

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    if (open) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const robots = useMemo(() => agents.map((a) => {
    const c = cfgOf(a);
    const active = c.monitor && a.enabled !== false;
    const firedRel = a.last_fired ? rel(a.last_fired) : null;
    const recent = a.last_fired && (Date.now() - new Date(a.last_fired).getTime()) < 36 * 3600000;
    return { id: a.id, name: a.name, emoji: c.emoji || '🤖', focus: FOCUS_LABEL[c.focus] || 'Assistente', monitor: !!c.monitor, active, firedRel, recent };
  }), [agents]);

  const activeCount = robots.filter((r) => r.active).length;
  const signaling = robots.filter((r) => r.recent);

  if (!agents.length) return null;

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} title="Seus robôs"
        className={`relative flex items-center gap-2 rounded-xl transition h-10 pl-1.5 pr-2 sm:pr-3 ${signaling.length > 0 ? 'ring-1 ring-amber-400/60' : ''} ${dark ? 'hover:bg-white/10' : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10'}`}>
        <span className="relative flex -space-x-2">
          {robots.slice(0, 3).map((r) => (
            <span key={r.id} className="relative w-7 h-7 rounded-lg flex items-center justify-center text-sm ring-2 ring-[hsl(var(--card))]" style={{ background: 'linear-gradient(135deg,#10b98133,#6366f133)' }}>
              {r.emoji}
              <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[hsl(var(--card))] ${r.active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            </span>
          ))}
          {robots.length > 3 && <span className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold ring-2 ring-[hsl(var(--card))] bg-black/10 dark:bg-white/15">+{robots.length - 3}</span>}
        </span>
        <span className="hidden sm:flex flex-col leading-none text-left">
          <span className={`text-xs font-semibold ${dark ? 'text-white' : ''}`}>Robôs</span>
          <span className={`text-[10px] ${signaling.length > 0 ? 'text-amber-500 font-medium' : dark ? 'text-white/70' : 'text-muted'}`}>{signaling.length > 0 ? 'sinalizando' : `${activeCount} ativo${activeCount === 1 ? '' : 's'}`}</span>
        </span>
        {signaling.length > 0 && <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-[hsl(var(--border))] flex items-center justify-between">
            <span className="font-semibold text-sm flex items-center gap-2"><Bot className="w-4 h-4 text-emerald-500" /> Seus robôs</span>
            <span className="text-xs text-muted">{activeCount} monitorando</span>
          </div>
          {signaling.length > 0 && (
            <div className="px-4 py-2 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs">
              {signaling.map((r) => r.name).join(', ')} sinalizou recentemente.
            </div>
          )}
          <div className="max-h-72 overflow-y-auto divide-y divide-[hsl(var(--border))]">
            {robots.map((r) => (
              <button key={r.id} onClick={() => { setOpen(false); navigate('/agentes'); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-black/5 dark:hover:bg-white/5">
                <span className="relative w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: 'linear-gradient(135deg,#10b98122,#6366f122)' }}>{r.emoji}<span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[hsl(var(--card))] ${r.active ? 'bg-emerald-500' : 'bg-slate-400'}`} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-tight truncate">{r.name}</p>
                  <p className="text-[11px] text-muted truncate">{r.focus} · {r.monitor ? (r.active ? 'monitorando 24/7' : 'pausado') : 'só chat'}</p>
                </div>
                {r.firedRel && <span className="text-[10px] text-amber-500 shrink-0">sinalizou {r.firedRel}</span>}
              </button>
            ))}
          </div>
          <button onClick={() => { setOpen(false); navigate('/agentes'); }} className="w-full px-4 py-2.5 text-sm text-emerald-600 hover:bg-emerald-500/10 font-medium border-t border-[hsl(var(--border))]">Abrir Central de Robôs</button>
        </div>
      )}
    </div>
  );
}
