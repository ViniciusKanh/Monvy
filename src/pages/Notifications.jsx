import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Notification } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Button, Spinner, EmptyState } from '../components/ui';
import { Reveal } from '../components/Animated.jsx';
import { Bell, CheckCheck, Trash2, CalendarClock, PiggyBank, Zap, Wallet, TrendingDown, AlertTriangle, DollarSign, Ticket, FileText } from 'lucide-react';

const ICON = { overdue: AlertTriangle, invoice: CalendarClock, budget: PiggyBank, anomaly: Zap, balance: Wallet, savings: TrendingDown, fx: DollarSign, reminder: CalendarClock, summary: FileText, ticket: Ticket, alert: Zap, info: Bell };
const fmt = (d) => d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

export default function Notifications() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: items = [], isLoading } = useQuery({ queryKey: ['notifications'], queryFn: () => Notification.list() });
  const list = useMemo(() => [...items].sort((a, b) => (String(b.created_date || '').localeCompare(String(a.created_date || '')))), [items]);
  const unread = list.filter((n) => !n.read);

  const inval = () => qc.invalidateQueries({ queryKey: ['notifications'] });
  const markRead = useMutation({ mutationFn: (id) => Notification.update(id, { read: true }), onSuccess: inval });
  const del = useMutation({ mutationFn: (id) => Notification.remove(id), onSuccess: inval });
  const markAll = useMutation({ mutationFn: async () => { for (const n of unread) await Notification.update(n.id, { read: true }); }, onSuccess: inval });
  const clearRead = useMutation({ mutationFn: async () => { for (const n of list.filter((x) => x.read)) await Notification.remove(n.id); }, onSuccess: inval });

  const openN = (n) => { if (!n.read) markRead.mutate(n.id); if (n.path) navigate(n.path); };

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageHeader title={<span className="flex items-center gap-2"><Bell className="w-6 h-6 text-emerald-500" /> Notificacoes</span>}
        subtitle="Historico de alertas e automacoes"
        actions={<div className="flex gap-2">{unread.length > 0 && <Button variant="outline" onClick={() => markAll.mutate()}><CheckCheck className="w-4 h-4" /> Marcar lidas</Button>}{list.some((n) => n.read) && <Button variant="outline" onClick={() => clearRead.mutate()}><Trash2 className="w-4 h-4" /> Limpar lidas</Button>}</div>} />

      {isLoading ? <div className="flex justify-center py-16"><Spinner className="w-6 h-6 text-emerald-500" /></div>
        : list.length === 0 ? <Card><EmptyState icon={Bell} title="Sem notificacoes" subtitle="Alertas e automacoes disparadas aparecerao aqui." /></Card>
        : (
          <Card className="p-0 divide-y divide-[hsl(var(--border))]">
            {list.map((n, i) => { const Icon = ICON[n.kind] || Bell; return (
              <Reveal key={n.id} i={Math.min(i, 15)}>
                <div className={`flex items-start gap-3 px-4 py-3 ${!n.read ? 'bg-emerald-500/5' : ''}`}>
                  <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${n.read ? 'bg-black/5 dark:bg-white/10 text-muted' : 'bg-emerald-500/10 text-emerald-500'}`}><Icon className="w-4 h-4" /></span>
                  <button onClick={() => openN(n)} className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-semibold leading-tight flex items-center gap-2">{n.title}{!n.read && <span className="w-2 h-2 rounded-full bg-emerald-500" />}</p>
                    {n.text && <p className="text-xs text-muted leading-tight mt-0.5">{n.text}</p>}
                    <p className="text-[10px] text-muted mt-0.5">{fmt(n.created_date)}</p>
                  </button>
                  <button onClick={() => del.mutate(n.id)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 shrink-0"><Trash2 className="w-4 h-4" /></button>
                </div>
              </Reveal>
            ); })}
          </Card>
        )}
    </div>
  );
}
