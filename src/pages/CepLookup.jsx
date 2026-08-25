import { useState } from 'react';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Button, Input, Spinner, EmptyState } from '../components/ui';
import { MapPin, Search, Building2, Map } from 'lucide-react';

export default function CepLookup() {
  const [cep, setCep] = useState('');
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const buscar = async (e) => {
    e?.preventDefault();
    const clean = cep.replace(/\D/g, '');
    if (clean.length !== 8) { setErr('Digite um CEP válido com 8 dígitos.'); setData(null); return; }
    setLoading(true); setErr(''); setData(null);
    try {
      const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 8000);
      const r = await fetch(`https://brasilapi.com.br/api/cep/v2/${clean}`, { signal: ctrl.signal });
      clearTimeout(to);
      if (!r.ok) throw new Error('CEP não encontrado.');
      setData(await r.json());
    } catch (e2) { setErr(e2.name === 'AbortError' ? 'Tempo esgotado. Tente novamente.' : (e2.message || 'Não consegui consultar agora.')); }
    finally { setLoading(false); }
  };

  const fmtCep = (v) => { const d = v.replace(/\D/g, '').slice(0, 8); return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d; };
  const coords = data?.location?.coordinates;

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageHeader title={<span className="flex items-center gap-2"><MapPin className="w-6 h-6 text-emerald-500" /> Consulta de CEP</span>}
        subtitle="Encontre o endereço completo de qualquer CEP do Brasil (fonte: BrasilAPI)" />

      <Card>
        <form onSubmit={buscar} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium">CEP</label>
            <Input value={cep} onChange={(e) => setCep(fmtCep(e.target.value))} placeholder="00000-000" inputMode="numeric" className="mt-1" />
          </div>
          <Button type="submit" disabled={loading}>{loading ? <Spinner className="w-4 h-4" /> : <><Search className="w-4 h-4" /> Consultar</>}</Button>
        </form>
        {err && <p className="text-sm text-rose-500 mt-3">{err}</p>}
      </Card>

      {data && (
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <span className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center"><Building2 className="w-6 h-6" /></span>
            <div><p className="font-display text-xl font-bold">{data.cep ? `${String(data.cep).slice(0, 5)}-${String(data.cep).slice(5)}` : cep}</p><p className="text-sm text-muted">{data.city} · {data.state}</p></div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            {[['Logradouro', data.street], ['Bairro', data.neighborhood], ['Cidade', data.city], ['Estado (UF)', data.state], ['Fonte', data.service]].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-black/5 dark:bg-white/5 p-3"><p className="text-[11px] text-muted">{k}</p><p className="font-semibold">{v || '—'}</p></div>
            ))}
          </div>
          {coords?.latitude && (
            <a href={`https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 mt-4 text-sm text-emerald-600 font-medium hover:underline"><Map className="w-4 h-4" /> Ver no mapa</a>
          )}
        </Card>
      )}

      {!data && !err && !loading && <Card><EmptyState icon={MapPin} title="Consulte um CEP" subtitle="Digite o CEP acima para ver o endereço completo." /></Card>}
    </div>
  );
}
