import { useState } from 'react';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Button, Input, Spinner, Badge } from '../components/ui';
import { Reveal } from '../components/Animated.jsx';
import { Building2, Search, AlertTriangle, MapPin, Briefcase, Calendar, Landmark, Users, Coins, CheckCircle2, XCircle } from 'lucide-react';

const onlyDigits = (s) => String(s).replace(/\D/g, '');
const maskCnpj = (s) => { const d = onlyDigits(s).slice(0, 14); return d.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2'); };
const fmtBRL = (v) => (v || v === 0) ? Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';
const fmtDate = (s) => { if (!s) return '—'; const d = new Date(s + 'T00:00'); return isNaN(d) ? s : d.toLocaleDateString('pt-BR'); };

export default function Cnpj() {
  const [input, setInput] = useState('');
  const [state, setState] = useState({ loading: false, error: '', data: null });

  async function search() {
    const digits = onlyDigits(input);
    if (digits.length !== 14) { setState({ loading: false, error: 'Digite um CNPJ valido com 14 digitos.', data: null }); return; }
    setState({ loading: true, error: '', data: null });
    try {
      const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (r.status === 404) throw new Error('CNPJ nao encontrado na base publica.');
      if (!r.ok) throw new Error('Falha na consulta. Tente novamente.');
      const data = await r.json();
      setState({ loading: false, error: '', data });
    } catch (e) { setState({ loading: false, error: e.message || 'Erro na consulta.', data: null }); }
  }

  const d = state.data;
  const ativa = d && /ativa/i.test(d.descricao_situacao_cadastral || '');
  const endereco = d ? [d.logradouro, d.numero, d.bairro, d.municipio && `${d.municipio}/${d.uf}`, d.cep].filter(Boolean).join(', ') : '';

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageHeader
        title={<span className="flex items-center gap-2"><Building2 className="w-6 h-6 text-violet-500" /> Consulta CNPJ</span>}
        subtitle="Identifique um estabelecimento e agilize a categorizacao dos gastos"
      />

      <Card className="hover-lift">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1"><Input value={input} onChange={(e) => setInput(maskCnpj(e.target.value))} onKeyDown={(e) => e.key === 'Enter' && search()} placeholder="00.000.000/0000-00" inputMode="numeric" className="text-lg" /></div>
          <Button onClick={search} disabled={state.loading} className="sm:w-40">{state.loading ? <Spinner className="w-4 h-4" /> : <><Search className="w-4 h-4" /> Consultar</>}</Button>
        </div>
        {state.error && <p className="text-sm text-rose-500 mt-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {state.error}</p>}
      </Card>

      {d && (
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl p-6 text-white shadow-soft" style={{ background: 'linear-gradient(140deg,#2e1065 0%,#4c1d95 55%,#6d28d9 100%)' }}>
            <div className="absolute -top-16 -right-12 w-64 h-64 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(255,255,255,.18), transparent 70%)' }} />
            <div className="relative flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[11px] tracking-[0.28em] text-violet-200 font-medium"><Building2 className="w-3.5 h-3.5" /> ESTABELECIMENTO</div>
                <p className="font-display text-xl sm:text-2xl font-extrabold mt-2 leading-tight">{d.nome_fantasia || d.razao_social}</p>
                {d.nome_fantasia && d.razao_social && <p className="text-violet-200 text-sm mt-0.5">{d.razao_social}</p>}
                <p className="text-violet-200 text-xs mt-1">{maskCnpj(d.cnpj || '')}</p>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${ativa ? 'bg-emerald-500/20 text-emerald-100' : 'bg-rose-500/20 text-rose-100'}`}>{ativa ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}{d.descricao_situacao_cadastral || 'Situacao'}</span>
            </div>
          </div>
        </Reveal>
      )}

      {d && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <InfoCard icon={Briefcase} color="#6366f1" label="Atividade principal (CNAE)" value={d.cnae_fiscal_descricao} />
          <InfoCard icon={Landmark} color="#0ea5e9" label="Natureza juridica" value={d.natureza_juridica} />
          <InfoCard icon={Users} color="#f59e0b" label="Porte" value={d.porte || d.descricao_porte} />
          <InfoCard icon={Calendar} color="#10b981" label="Abertura" value={fmtDate(d.data_inicio_atividade)} />
          <InfoCard icon={Coins} color="#8b5cf6" label="Capital social" value={fmtBRL(d.capital_social)} />
          <InfoCard icon={MapPin} color="#f43f5e" label="Endereco" value={endereco} />
        </div>
      )}

      {d && Array.isArray(d.qsa) && d.qsa.length > 0 && (
        <Card className="hover-lift">
          <h3 className="font-semibold flex items-center gap-2 mb-3"><Users className="w-4 h-4 text-violet-500" /> Quadro societario</h3>
          <div className="grid sm:grid-cols-2 gap-2">
            {d.qsa.slice(0, 8).map((s, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-black/5 dark:bg-white/5">
                <span className="w-9 h-9 rounded-full bg-violet-500/15 text-violet-500 flex items-center justify-center font-bold shrink-0">{(s.nome_socio || '?').slice(0, 1)}</span>
                <div className="min-w-0"><p className="text-sm font-medium truncate">{s.nome_socio}</p><p className="text-[11px] text-muted truncate">{s.qualificacao_socio}</p></div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {d && <p className="text-xs text-muted text-center pt-2">Fonte: BrasilAPI (dados publicos da Receita Federal). Use o CNAE como dica para categorizar seus gastos.</p>}
    </div>
  );
}

function InfoCard({ icon: Icon, color, label, value }) {
  return (
    <Card className="hover-lift">
      <div className="flex items-center gap-2 mb-1.5"><span className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0" style={{ background: color }}><Icon className="w-4 h-4" /></span><p className="text-xs text-muted">{label}</p></div>
      <p className="font-semibold text-sm break-words">{value || '—'}</p>
    </Card>
  );
}
