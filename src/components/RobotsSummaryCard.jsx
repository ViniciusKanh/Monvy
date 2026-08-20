import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Trigger, Notification, Robots } from '../api/entities.js';
import { FOCUS_LABEL } from '../lib/assistant.js';
import { Card, Button, Spinner } from './ui';
import { toast } from '../lib/toast.js';
import { Bot, RefreshCw, MessageSquare, ChevronRight } from 'lucide-react';

const cfgOf = (a) => { try { return typeof a.config === 'string' ? JSON.parse(a.config) : (a.config || {}); } catch { return {}; } };
const rel = (iso) => { if (!iso) return ''; const d = (Date.now() - new Date(iso).getTime()) / 1000; if (!isFinite(d)) return ''; if (d < 3600) return `há ${Math.max(1, Math.round(d / 60))}min`; if (d < 86400) return `há ${Math.round(d / 3600)}h`; return `há ${Math.round(d / 86400)}d`; };

export function RobotsSummaryCard() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const { data: agents = [], isLoading } = useQuery({ queryKey: ['triggers'], queryFn: () => Trigger.list(), refetchInterval: 60_000 });
  const { data: notifications = [] } = useQuery({ queryKey: ['notifications'], queryFn: () => Notification.list({ _limit: 50 }), refetchInterval: 60_000 });

  const robots = useMemo(() => agents.map((a) => { const c = cfgOf(a); return { id: a.id, name: a.name, emoji: c.emoji || '🤖', focus: FOCUS_LABEL[c.focus] || 'Assistente', active: c.monitor && a.enabled !== false, monitor: !!c.monitor, fired: a.last_fired }; }), [agents]);
  const activeCount = robots.filter((r) => r.active).length;
  const recentAlerts = useMemo(() => notifications.filter((n) => n.kind === 'alert' || n.kind === 'ticket').slice(0, 3), [notifications]);

  const check = async () => {
    setBusy(true);
    try { const { fired } = await Robots.check(); qc.invalidateQueries({ queryKey: ['notifications'] }); qc.invalidateQueries({ queryKey: ['triggers'] }); toast.success(fired ? `${fired} alerta(s) gerado(s) pelos robôs.` : 'Tudo certo — nenhum alerta agora.'); }
    catch (e) { toast.error(e.message || 'Falha ao verificar'); } finally { setBusy(false); }
  };

  if (isLoading) return <Card className="flex items-center justify-center py-10"><Spinner className="w-5 h-5 text-emerald-500" /></Card>;

  return (
    <Card className="hover-lift">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold flex items-center gap-2"><Bot className="w-5 h-5 text-emerald-500" /> Seus robôs</h3>
        <button onClick={() => navigate('/agentes')} className="text-xs text-emerald-600 hover:underline flex items-center gap-0.5">Central <ChevronRight className="w-3 h-3" /></button>
      </div>

      {robots.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-sm text-muted mb-3">Nenhum robô ainda. Contrate sua equipe pra monitorar tudo 24/7.</p>
          <Button size="sm" onClick={() => navigate('/agentes')}><Bot className="w-4 h-4" /> Contratar robôs</Button>
        </div>
      ) : (<>
        <div className="flex items-center gap-3 mb-3">
          <div className="flex -space-x-1.5">{robots.slice(0, 6).map((r) => <span key={r.id} className="relative w-9 h-9 rounded-xl flex items-center justify-center text-lg ring-2 ring-[hsl(var(--card))]" style={{ background: 'linear-gradient(135deg,#10b98122,#6366f122)' }} title={r.name}>{r.emoji}<span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[hsl(var(--card))] ${r.active ? 'bg-emerald-500' : 'bg-slate-400'}`} /></span>)}</div>
          <div className="text-sm"><span className="font-semibold">{activeCount}</span> <span className="text-muted">monitorando de {robots.length}</span></div>
        </div>

        {recentAlerts.length > 0 ? (
          <div className="space-y-1.5 mb-3">
            <p className="text-[11px] text-muted uppercase tracking-wide">Últimos sinais</p>
            {recentAlerts.map((n) => (
              <div key={n.id} className="flex items-center gap-2 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                <span className="flex-1 min-w-0 truncate">{n.title}{n.text ? ` — ${n.text}` : ''}</span>
                <span className="text-[10px] text-muted shrink-0">{rel(n.created_date)}</span>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-muted mb-3">Nenhum sinal recente. Seus robôs estão de olho.</p>}

        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1" onClick={check} disabled={busy}>{busy ? <Spinner className="w-4 h-4" /> : <><RefreshCw className="w-4 h-4" /> Verificar agora</>}</Button>
          <Button size="sm" className="flex-1" onClick={() => navigate('/chat')}><MessageSquare className="w-4 h-4" /> Perguntar</Button>
        </div>
      </>)}
    </Card>
  );
}
