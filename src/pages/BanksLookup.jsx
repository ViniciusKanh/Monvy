import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Input, Spinner, EmptyState } from '../components/ui';
import { Landmark, Search } from 'lucide-react';

export default function BanksLookup() {
  const [banks, setBanks] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 9000);
        const r = await fetch('https://brasilapi.com.br/api/banks/v1', { signal: ctrl.signal });
        clearTimeout(to);
        if (!r.ok) throw new Error('falha');
        const data = await r.json();
        setBanks((data || []).filter((b) => b.name));
      } catch { setErr('Não consegui carregar a lista de bancos agora. Tente recarregar.'); }
      finally { setLoading(false); }
    })();
  }, []);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = [...banks].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    if (!s) return base.slice(0, 60);
    return base.filter((b) => `${b.name} ${b.fullName || ''} ${b.code || ''} ${b.ispb || ''}`.toLowerCase().includes(s)).slice(0, 60);
  }, [banks, q]);

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageHeader title={<span className="flex items-center gap-2"><Landmark className="w-6 h-6 text-emerald-500" /> Consulta de Bancos</span>}
        subtitle="Encontre o código (COMPE) e o ISPB de qualquer banco do Brasil (fonte: BrasilAPI)" />

      <Card className="py-3">
        <div className="flex items-center gap-2 card px-2 py-1.5">
          <Search className="w-4 h-4 text-muted shrink-0" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, código ou ISPB (ex.: Nubank, 260)..." className="flex-1 bg-transparent outline-none text-sm" />
        </div>
      </Card>

      {loading ? <div className="flex justify-center py-16"><Spinner className="w-6 h-6 text-emerald-500" /></div>
        : err ? <Card><EmptyState icon={Landmark} title="Ops" subtitle={err} /></Card>
        : (
          <Card className="p-0">
            <div className="px-4 py-2 text-xs text-muted border-b border-[hsl(var(--border))]">{list.length} banco(s){!q && ' (mostrando os primeiros 60 — busque para filtrar)'}</div>
            <div className="divide-y divide-[hsl(var(--border))] max-h-[62vh] overflow-y-auto">
              {list.map((b) => (
                <div key={`${b.ispb}-${b.code}`} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="w-12 shrink-0 text-center font-mono text-sm font-bold text-emerald-600">{b.code ?? '—'}</span>
                  <div className="flex-1 min-w-0"><p className="font-medium truncate">{b.name}</p><p className="text-xs text-muted truncate">{b.fullName || ''}</p></div>
                  <span className="text-[11px] text-muted shrink-0">ISPB {b.ispb}</span>
                </div>
              ))}
              {list.length === 0 && <div className="py-8"><EmptyState icon={Search} title="Nada encontrado" subtitle="Tente outro termo." /></div>}
            </div>
          </Card>
        )}
    </div>
  );
}
