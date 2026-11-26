import { useEffect, useRef, useState } from 'react';
import { Modal, Button, Input, Select, Spinner } from '../ui';
import { formatCurrency, monthKey } from '../../lib/utils.js';
import { PAYSLIP_KINDS } from '../../lib/payslips.js';
import { Ai } from '../../api/entities.js';
import { Sparkles, Upload, FileText, AlertTriangle, CheckCircle2, Building2, ListOrdered } from 'lucide-react';

const EMPTY = { company: '', company_cnpj: '', role: '', competence: monthKey(new Date()), kind: 'mensal', pay_date: '', gross: '', inss: '', irrf: '', fgts: '', other_deductions: '', net: '', base_inss: '', base_irrf: '', base_fgts: '', dependents: 0, items: [], notes: '', source: 'manual', file_data: null, file_name: '', file_type: '' };
const MAX_FILE_B64 = 1_500_000; // ~1,1 MB — guardamos o arquivo junto do holerite até esse tamanho
const n = (v) => { const x = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(x) ? x : 0; };
const r2 = (v) => Math.round(n(v) * 100) / 100;

async function shrinkImage(file, max = 1800) {
  if (!/^image\//.test(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
    return blob ? new File([blob], (file.name || 'holerite').replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
  } catch { return file; }
}
const toB64 = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(file); });

// Cadastro/edição de holerite. Com a chave do Gemini, o arquivo (PDF ou foto)
// é lido pela IA e o formulário vem pré-preenchido para conferência.
export function PayslipModal({ open, onClose, onSave, saving, initial, geminiKey, companies = [], autoPick = false }) {
  const [f, setF] = useState(EMPTY);
  const [reading, setReading] = useState(false);
  const [aiInfo, setAiInfo] = useState(null); // { model, diff } | { error }
  const fileRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setF(initial ? { ...EMPTY, ...initial, items: Array.isArray(initial.items) ? initial.items : [] } : EMPTY);
    setAiInfo(null);
    if (autoPick && !initial) setTimeout(() => fileRef.current?.click(), 50);
  }, [open, initial, autoPick]);

  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const liquidoCalc = r2(n(f.gross) - n(f.inss) - n(f.irrf) - n(f.other_deductions));
  const diff = f.net !== '' && f.gross !== '' ? r2(liquidoCalc - n(f.net)) : 0;

  async function onFile(e) {
    const raw = e.target.files?.[0]; e.target.value = '';
    if (!raw) return;
    const file = await shrinkImage(raw);
    const mime = /pdf/i.test(file.type) || /\.pdf$/i.test(file.name) ? 'application/pdf' : file.type;
    const b64 = await toB64(file);
    const keep = b64.length <= MAX_FILE_B64 ? { file_data: b64, file_name: raw.name, file_type: mime } : { file_data: null, file_name: raw.name, file_type: mime };
    setF((s) => ({ ...s, ...keep }));
    if (!geminiKey) { setAiInfo({ error: 'Sem chave do Gemini em Configurações — preencha os campos à mão (o arquivo fica guardado).' }); return; }
    setReading(true); setAiInfo(null);
    try {
      const d = await Ai.parsePayslip(b64, geminiKey, mime);
      setF((s) => ({
        ...s, ...keep, source: 'ia',
        company: d.company || s.company, company_cnpj: d.company_cnpj || s.company_cnpj, role: d.role || s.role,
        competence: d.competence || s.competence, kind: d.kind || s.kind, pay_date: d.pay_date || s.pay_date,
        gross: d.gross || '', inss: d.inss || '', irrf: d.irrf || '', fgts: d.fgts || '', other_deductions: d.other_deductions || '', net: d.net || '',
        base_inss: d.base_inss || '', base_irrf: d.base_irrf || '', base_fgts: d.base_fgts || '', dependents: d.dependents || 0, items: d.items || [],
      }));
      setAiInfo({ model: d.model, diff: d.diff, count: (d.items || []).length });
    } catch (err) {
      setAiInfo({ error: err.message || 'Falha na leitura com IA. Preencha os campos à mão.' });
    } finally { setReading(false); }
  }

  function submit() {
    if (!String(f.company).trim()) return setAiInfo({ error: 'Informe a empresa.' });
    if (!/^\d{4}-\d{2}$/.test(f.competence)) return setAiInfo({ error: 'Informe a competência (mês/ano).' });
    if (!(n(f.gross) > 0)) return setAiInfo({ error: 'Informe o salário bruto (total de vencimentos).' });
    const net = f.net === '' ? liquidoCalc : r2(f.net);
    onSave({
      ...f, company: f.company.trim(), company_cnpj: String(f.company_cnpj || '').trim(),
      gross: r2(f.gross), inss: r2(f.inss), irrf: r2(f.irrf), fgts: r2(f.fgts), other_deductions: r2(f.other_deductions), net,
      base_inss: r2(f.base_inss), base_irrf: r2(f.base_irrf), base_fgts: r2(f.base_fgts), dependents: Math.max(0, Math.round(n(f.dependents))),
    });
  }

  const money = [['gross', 'Total de vencimentos (bruto)'], ['inss', 'INSS'], ['irrf', 'IRRF'], ['other_deductions', 'Outros descontos'], ['net', 'Líquido a receber'], ['fgts', 'FGTS do mês']];
  const bases = [['base_inss', 'Base INSS'], ['base_irrf', 'Base IRRF'], ['base_fgts', 'Base FGTS']];
  const prov = (f.items || []).filter((i) => i.type === 'provento');
  const desc = (f.items || []).filter((i) => i.type === 'desconto');

  return (
    <Modal open={open} onClose={onClose} title={initial?.id ? 'Editar holerite' : 'Novo holerite'} maxWidth="max-w-3xl"
      footer={<><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={submit} disabled={saving || reading}>{saving ? <Spinner className="w-4 h-4" /> : 'Salvar holerite'}</Button></>}>
      <div className="space-y-4">
        <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={onFile} />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={reading}
          className="w-full rounded-2xl border-2 border-dashed border-violet-400/50 bg-violet-500/5 hover:bg-violet-500/10 transition p-4 flex items-center gap-3 text-left">
          <span className="w-11 h-11 rounded-xl grid place-items-center bg-violet-500/20 text-violet-500 shrink-0">{reading ? <Spinner className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}</span>
          <span className="flex-1 min-w-0">
            <b className="text-sm block">{reading ? 'Lendo o holerite com IA...' : f.file_name ? 'Trocar arquivo' : 'Enviar holerite (PDF ou foto)'}</b>
            <span className="text-xs text-muted block truncate">{f.file_name ? <><FileText className="w-3 h-3 inline -mt-0.5" /> {f.file_name}{!f.file_data ? ' · grande demais para guardar, só os dados serão salvos' : ''}</> : 'A IA identifica empresa, CNPJ, competência, proventos, INSS, IRRF, FGTS e líquido.'}</span>
          </span>
          <Upload className="w-4 h-4 text-muted shrink-0" />
        </button>

        {aiInfo?.error && <p className="text-xs rounded-xl px-3 py-2 bg-amber-500/10 ring-1 ring-amber-400/40 text-amber-700 dark:text-amber-300 flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />{aiInfo.error}</p>}
        {aiInfo?.model && <p className="text-xs rounded-xl px-3 py-2 bg-emerald-500/10 ring-1 ring-emerald-400/40 flex gap-2"><CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />Lido pela IA ({aiInfo.model}) · {aiInfo.count} rubrica(s). Confira os valores antes de salvar.</p>}

        <div className="grid sm:grid-cols-6 gap-3">
          <label className="sm:col-span-3 text-sm font-medium">Empresa
            <Input list="payslip-companies" value={f.company} onChange={set('company')} placeholder="Razão social do empregador" className="mt-1" />
            <datalist id="payslip-companies">{companies.map((c) => <option key={c} value={c} />)}</datalist>
          </label>
          <label className="sm:col-span-3 text-sm font-medium">CNPJ<Input value={f.company_cnpj} onChange={set('company_cnpj')} placeholder="00.000.000/0000-00" className="mt-1" /></label>
          <label className="sm:col-span-2 text-sm font-medium">Competência<Input type="month" value={f.competence} onChange={set('competence')} className="mt-1" /></label>
          <label className="sm:col-span-2 text-sm font-medium">Tipo<Select value={f.kind} onChange={set('kind')} className="mt-1">{PAYSLIP_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</Select></label>
          <label className="sm:col-span-2 text-sm font-medium">Data de pagamento<Input type="date" value={f.pay_date} onChange={set('pay_date')} className="mt-1" /></label>
          <label className="sm:col-span-4 text-sm font-medium">Cargo<Input value={f.role} onChange={set('role')} placeholder="Opcional" className="mt-1" /></label>
          <label className="sm:col-span-2 text-sm font-medium">Dependentes (IR)<Input type="number" min="0" value={f.dependents} onChange={set('dependents')} className="mt-1" /></label>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {money.map(([k, l]) => (
            <label key={k} className="text-sm font-medium">{l}<Input type="number" step="0.01" min="0" value={f[k]} onChange={set(k)} className={`mt-1 ${k === 'net' ? 'ring-1 ring-emerald-400/50' : ''}`} placeholder="0,00" /></label>
          ))}
        </div>
        <details className="rounded-xl ring-1 ring-[hsl(var(--border))] px-3 py-2">
          <summary className="text-sm font-medium cursor-pointer">Bases de cálculo</summary>
          <div className="grid grid-cols-3 gap-3 mt-2">{bases.map(([k, l]) => <label key={k} className="text-xs font-medium">{l}<Input type="number" step="0.01" min="0" value={f[k]} onChange={set(k)} className="mt-1" /></label>)}</div>
        </details>

        {f.gross !== '' && (
          <div className={`rounded-xl px-3 py-2 text-xs flex items-center gap-2 ${Math.abs(diff) <= 0.05 ? 'bg-emerald-500/10 ring-1 ring-emerald-400/40' : 'bg-amber-500/10 ring-1 ring-amber-400/40'}`}>
            {Math.abs(diff) <= 0.05 ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertTriangle className="w-4 h-4 text-amber-500" />}
            <span>Conferência: bruto − INSS − IRRF − outros = <b>{formatCurrency(liquidoCalc)}</b>{f.net !== '' ? (Math.abs(diff) <= 0.05 ? ' · bate com o líquido ✓' : ` · diferença de ${formatCurrency(Math.abs(diff))} para o líquido informado`) : ' (será usado como líquido)'}</span>
          </div>
        )}

        {(prov.length > 0 || desc.length > 0) && (
          <div className="rounded-xl ring-1 ring-[hsl(var(--border))] overflow-hidden">
            <p className="px-3 py-2 text-sm font-semibold flex items-center gap-2 bg-black/5 dark:bg-white/5"><ListOrdered className="w-4 h-4 text-violet-400" /> Rubricas lidas</p>
            <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[hsl(var(--border))] text-xs">
              {[['Proventos', prov, 'text-emerald-600 dark:text-emerald-300'], ['Descontos', desc, 'text-rose-500']].map(([t, list, cls]) => (
                <div key={t} className="p-3 space-y-1 max-h-48 overflow-y-auto">
                  <p className="font-semibold text-muted uppercase tracking-wide text-[10px]">{t}</p>
                  {list.length === 0 ? <p className="text-muted">—</p> : list.map((i, k) => (
                    <p key={k} className="flex gap-2"><span className="text-muted w-10 shrink-0">{i.code}</span><span className="flex-1 truncate" title={i.description}>{i.description}{i.reference ? <span className="text-muted"> · {i.reference}</span> : null}</span><b className={`tabular-nums ${cls}`}>{formatCurrency(i.amount)}</b></p>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
        <p className="text-[11px] text-muted flex gap-1.5"><Building2 className="w-3.5 h-3.5 shrink-0" /><span>Os holerites ficam agrupados por empresa (CNPJ). INSS e IRRF salvos aqui entram como <b>confirmados</b> em Minha Carga Tributária no mês da competência.</span></p>
      </div>
    </Modal>
  );
}
