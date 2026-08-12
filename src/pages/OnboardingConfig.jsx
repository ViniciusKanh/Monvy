import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Admin } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Button, Spinner, Badge } from '../components/ui';
import { NAV_GROUPS } from '../lib/screens.js';
import { toast } from '../lib/toast.js';
import { UserPlus, Check, LayoutGrid, Rocket } from 'lucide-react';

// telas configuraveis (exclui as exclusivas de admin)
const GROUPS = NAV_GROUPS.map((g) => ({ label: g.label, items: g.items.filter((i) => !i.adminOnly) })).filter((g) => g.items.length);
const ALL_KEYS = GROUPS.flatMap((g) => g.items.map((i) => i.key));

export default function OnboardingConfig() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['default-screens'], queryFn: () => Admin.getDefaultScreens() });
  const [sel, setSel] = useState(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (data && sel === null) setSel(Array.isArray(data.screens) && data.screens.length ? data.screens : ALL_KEYS);
  }, [data, sel]);

  const save = useMutation({
    mutationFn: () => Admin.saveDefaultScreens(sel),
    onSuccess: (r) => { setDirty(false); qc.setQueryData(['default-screens'], { screens: r?.screens || sel }); toast.success('Padrao salvo! Novos usuarios ja recebem essas telas.'); },
    onError: (e) => toast.error(e.message || 'Falha ao salvar'),
  });

  const toggle = (k) => { setDirty(true); setSel((s) => s.includes(k) ? s.filter((x) => x !== k) : [...s, k]); };
  const setAll = (v) => { setDirty(true); setSel(v); };
  const count = sel?.length || 0;
  const allOn = useMemo(() => count === ALL_KEYS.length, [count]);

  if (isLoading || sel === null) return <div className="flex justify-center py-16"><Spinner className="w-6 h-6 text-emerald-500" /></div>;

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageHeader
        title={<span className="flex items-center gap-2"><UserPlus className="w-6 h-6 text-emerald-500" /> Onboarding de novos usuarios</span>}
        subtitle="Defina as telas que cada novo usuario recebe automaticamente ao se cadastrar"
        actions={<Button onClick={() => save.mutate()} disabled={save.isPending || count === 0}>{save.isPending ? <Spinner className="w-4 h-4" /> : <><Check className="w-4 h-4" /> {dirty ? 'Salvar alteracoes' : 'Salvar padrao'}</>}</Button>}
      />

      <div className="relative overflow-hidden rounded-3xl p-6 text-white shadow-soft" style={{ background: 'linear-gradient(135deg,#059669 0%,#0d9488 55%,#6366f1 100%)' }}>
        <div className="absolute -top-16 -right-12 w-64 h-64 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(255,255,255,.2), transparent 70%)' }} />
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] tracking-[0.28em] font-medium text-emerald-100"><Rocket className="w-3.5 h-3.5" /> AUTOMATICO</div>
            <p className="font-display text-2xl font-extrabold mt-1">{count} de {ALL_KEYS.length} telas liberadas</p>
            <p className="text-emerald-50 text-sm mt-1">Ao cadastrar, o usuario ja entra com essas telas — voce nao precisa liberar uma a uma.</p>
          </div>
          <button onClick={() => setAll(allOn ? [] : ALL_KEYS)} className="px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 transition font-semibold text-sm flex items-center gap-2"><LayoutGrid className="w-4 h-4" /> {allOn ? 'Desmarcar todas' : 'Selecionar todas'}</button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {GROUPS.map((g) => (
          <Card key={g.label} className="hover-lift">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">{g.label}</h3>
              <Badge color="slate">{g.items.filter((i) => sel.includes(i.key)).length}/{g.items.length}</Badge>
            </div>
            <div className="space-y-1.5">
              {g.items.map((i) => {
                const on = sel.includes(i.key);
                return (
                  <label key={i.key} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition ${on ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-[hsl(var(--border))] hover:bg-black/5 dark:hover:bg-white/5'}`}>
                    <input type="checkbox" className="w-4 h-4 accent-emerald-500" checked={on} onChange={() => toggle(i.key)} />
                    <i.icon className="w-4 h-4 text-muted" />
                    <span className="text-sm">{i.label}</span>
                  </label>
                );
              })}
            </div>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted">Ajuda & Suporte esta sempre disponivel para todos. Voce continua podendo ajustar as telas de cada usuario individualmente em Usuarios & Acessos.</p>
    </div>
  );
}
