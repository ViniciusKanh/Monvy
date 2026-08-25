import { useEffect, useState } from 'react';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Select, Spinner, EmptyState } from '../components/ui';
import { Car, Bike, Truck } from 'lucide-react';

const API = 'https://fipe.parallelum.com.br/api/v2';
const TIPOS = [{ v: 'cars', label: 'Carros', icon: Car }, { v: 'motorcycles', label: 'Motos', icon: Bike }, { v: 'trucks', label: 'Caminhões', icon: Truck }];

async function getJson(url) { const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 9000); try { const r = await fetch(url, { signal: ctrl.signal }); if (!r.ok) throw new Error('http'); return await r.json(); } finally { clearTimeout(to); } }

export default function Fipe() {
  const [tipo, setTipo] = useState('cars');
  const [brands, setBrands] = useState([]); const [brand, setBrand] = useState('');
  const [models, setModels] = useState([]); const [model, setModel] = useState('');
  const [years, setYears] = useState([]); const [year, setYear] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState({}); const [err, setErr] = useState('');

  const reset = (from) => { if (from <= 1) { setModels([]); setModel(''); } if (from <= 2) { setYears([]); setYear(''); } setResult(null); };

  useEffect(() => { (async () => { setErr(''); setBrands([]); setBrand(''); reset(1); setLoading((l) => ({ ...l, b: true })); try { setBrands(await getJson(`${API}/${tipo}/brands`)); } catch { setErr('Não consegui carregar as marcas.'); } finally { setLoading((l) => ({ ...l, b: false })); } })(); }, [tipo]);

  const onBrand = async (id) => { setBrand(id); reset(1); if (!id) return; setLoading((l) => ({ ...l, m: true })); try { setModels(await getJson(`${API}/${tipo}/brands/${id}/models`)); } catch { setErr('Falha ao carregar modelos.'); } finally { setLoading((l) => ({ ...l, m: false })); } };
  const onModel = async (id) => { setModel(id); reset(2); if (!id) return; setLoading((l) => ({ ...l, y: true })); try { setYears(await getJson(`${API}/${tipo}/brands/${brand}/models/${id}/years`)); } catch { setErr('Falha ao carregar anos.'); } finally { setLoading((l) => ({ ...l, y: false })); } };
  const onYear = async (id) => { setYear(id); setResult(null); if (!id) return; setLoading((l) => ({ ...l, r: true })); try { setResult(await getJson(`${API}/${tipo}/brands/${brand}/models/${model}/years/${id}`)); } catch { setErr('Falha ao consultar o valor.'); } finally { setLoading((l) => ({ ...l, r: false })); } };

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageHeader title={<span className="flex items-center gap-2"><Car className="w-6 h-6 text-emerald-500" /> Tabela FIPE</span>}
        subtitle="Consulte o valor de mercado de carros, motos e caminhões (fonte: FIPE)" />

      <Card>
        <div className="flex gap-2 mb-3">
          {TIPOS.map((t) => { const Ic = t.icon; return (
            <button key={t.v} onClick={() => setTipo(t.v)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${tipo === t.v ? 'bg-emerald-500 text-white' : 'bg-black/5 dark:bg-white/5 text-muted'}`}><Ic className="w-4 h-4" /> {t.label}</button>
          ); })}
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="text-sm font-medium">Marca</label>
            <Select value={brand} onChange={(e) => onBrand(e.target.value)} disabled={loading.b} className="mt-1"><option value="">{loading.b ? 'Carregando...' : 'Selecione'}</option>{brands.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}</Select>
          </div>
          <div>
            <label className="text-sm font-medium">Modelo</label>
            <Select value={model} onChange={(e) => onModel(e.target.value)} disabled={!brand || loading.m} className="mt-1"><option value="">{loading.m ? 'Carregando...' : 'Selecione'}</option>{models.map((m) => <option key={m.code} value={m.code}>{m.name}</option>)}</Select>
          </div>
          <div>
            <label className="text-sm font-medium">Ano</label>
            <Select value={year} onChange={(e) => onYear(e.target.value)} disabled={!model || loading.y} className="mt-1"><option value="">{loading.y ? 'Carregando...' : 'Selecione'}</option>{years.map((y) => <option key={y.code} value={y.code}>{y.name}</option>)}</Select>
          </div>
        </div>
        {err && <p className="text-sm text-rose-500 mt-3">{err}</p>}
      </Card>

      {loading.r && <div className="flex justify-center py-10"><Spinner className="w-6 h-6 text-emerald-500" /></div>}

      {result && !loading.r && (
        <Card>
          <div className="text-center py-2">
            <p className="text-sm text-muted">{result.brand} · {result.model}</p>
            <p className="font-display text-4xl font-extrabold text-emerald-500 mt-1">{result.price}</p>
            <p className="text-xs text-muted mt-1">Ano {result.modelYear} · {result.fuel} · código FIPE {result.codeFipe} · ref. {result.referenceMonth}</p>
          </div>
        </Card>
      )}

      {!result && !loading.r && !err && <Card><EmptyState icon={Car} title="Consulte um veículo" subtitle="Escolha tipo, marca, modelo e ano para ver o valor FIPE." /></Card>}
    </div>
  );
}
