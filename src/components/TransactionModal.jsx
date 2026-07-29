import { useEffect, useMemo, useState, useRef } from 'react';
import { Button, Input, Select, Field, Modal, Textarea, Spinner } from './ui';
import { Paperclip, X, FileText, Eye, Building2 } from 'lucide-react';
import { todayIso } from '../lib/utils.js';
import { buildCategoryIndex, predictCategory } from '../lib/categoryPredictor.js';

const TYPES = [
  { v: 'expense', label: 'Despesa', cls: 'text-rose-600 border-rose-500 bg-rose-50 dark:bg-rose-500/10' },
  { v: 'income', label: 'Receita', cls: 'text-emerald-600 border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' },
  { v: 'transfer', label: 'Transferencia', cls: 'text-blue-600 border-blue-500 bg-blue-50 dark:bg-blue-500/10' },
];

// Comprime imagem (ou le PDF) para dataURL leve, guardado no banco
function readReceipt(file, max = 1100) {
  return new Promise((resolve, reject) => {
    if (file.type === 'application/pdf') { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file); return; }
    const img = new Image(); const r = new FileReader();
    r.onload = () => { img.src = r.result; }; r.onerror = reject;
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(cv.toDataURL('image/jpeg', 0.72));
    };
    r.readAsDataURL(file);
  });
}

const empty = {
  type: 'expense', date: todayIso(), amount: '', description: '',
  account_id: '', account_to_id: '', category_id: '',
  is_fixed: false, recurrence: 'none', status: 'pending', receipt_url: '',
};

export function TransactionModal({ open, onClose, onSubmit, saving, accounts, categories, transactions = [], initial, defaultType }) {
  const catIndex = useMemo(() => buildCategoryIndex(transactions), [transactions]);
  const [form, setForm] = useState(empty);
  const [busyReceipt, setBusyReceipt] = useState(false);
  const receiptRef = useRef(null);
  const onReceipt = async (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    setBusyReceipt(true);
    try { const url = await readReceipt(file); setForm((f) => ({ ...f, receipt_url: url })); }
    catch { /* ignore */ } finally { setBusyReceipt(false); }
  };

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        type: initial.type, date: (initial.date || todayIso()).slice(0, 10),
        amount: initial.amount, description: initial.description || '',
        account_id: initial.account_id || '', account_to_id: initial.account_to_id || '',
        category_id: initial.category_id || '', is_fixed: !!initial.is_fixed, recurrence: initial.recurrence || 'none', status: initial.status || 'pending', receipt_url: initial.receipt_url || '',
      });
    } else {
      setForm({ ...empty, type: defaultType || 'expense', account_id: accounts?.[0]?.id || '' });
    }
  }, [open, initial, defaultType]); // eslint-disable-line

  const [cnpj, setCnpj] = useState({ busy: false, hint: '' });
  const descDigits = (form.description || '').replace(/\D/g, '');
  const looksCnpj = descDigits.length === 14;
  async function lookupCnpj() {
    setCnpj({ busy: true, hint: '' });
    try {
      const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${descDigits}`);
      if (!r.ok) throw new Error('nao encontrado');
      const d = await r.json();
      const name = d.nome_fantasia || d.razao_social || form.description;
      const cnae = d.cnae_fiscal_descricao || '';
      setForm((f) => {
        let cat = f.category_id;
        if (f.type !== 'transfer' && !cat && cnae) { const p = predictCategory(cnae, catIndex); if (p && categories.some((c) => c.id === p && c.type === f.type)) cat = p; }
        return { ...f, description: name, category_id: cat };
      });
      setCnpj({ busy: false, hint: cnae ? `Estabelecimento identificado · segmento: ${cnae}` : 'Estabelecimento identificado.' });
    } catch { setCnpj({ busy: false, hint: 'CNPJ nao encontrado na base publica.' }); }
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const onDesc = (e) => {
    const v = e.target.value;
    setForm((f) => {
      let cat = f.category_id;
      if (f.type !== 'transfer' && !cat) { const p = predictCategory(v, catIndex); if (p && categories.some((c) => c.id === p && c.type === f.type)) cat = p; }
      return { ...f, description: v, category_id: cat };
    });
  };
  const cats = useMemo(() => categories.filter((c) => form.type === 'transfer' ? false : c.type === form.type), [categories, form.type]);

  const submit = (e) => {
    e.preventDefault();
    const payload = {
      type: form.type, date: form.date, amount: Number(form.amount),
      description: form.description, account_id: form.account_id,
      account_to_id: form.type === 'transfer' ? form.account_to_id : null,
      category_id: form.type === 'transfer' ? null : form.category_id || null,
      is_fixed: form.is_fixed, recurrence: form.recurrence,
      status: form.type === 'transfer' ? 'completed' : form.status,
      receipt_url: form.receipt_url || null,
    };
    onSubmit(payload);
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Editar lancamento' : 'Novo lancamento'}
      footer={<><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={submit} disabled={saving}>{saving ? <Spinner className="w-4 h-4" /> : 'Salvar'}</Button></>}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {TYPES.map((t) => (
            <button key={t.v} type="button" onClick={() => setForm((f) => ({ ...f, type: t.v, category_id: '' }))}
              className={`py-2 rounded-lg border-2 text-sm font-semibold transition ${form.type === t.v ? t.cls : 'border-[hsl(var(--border))] text-muted'}`}>{t.label}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor"><Input type="number" step="0.01" required value={form.amount} onChange={set('amount')} placeholder="0,00" /></Field>
          <Field label="Data"><Input type="date" required value={form.date} onChange={set('date')} /></Field>
        </div>
        <Field label="Descricao" hint={cnpj.hint || 'Categoria sugerida pelo historico. Dica: cole um CNPJ e toque em buscar para identificar o estabelecimento'}>
          <div className="flex gap-2">
            <Input value={form.description} onChange={onDesc} placeholder="Ex: Mercado ou um CNPJ" className="flex-1" />
            {looksCnpj && form.type !== 'transfer' && <Button type="button" variant="outline" onClick={lookupCnpj} disabled={cnpj.busy} className="shrink-0" title="Buscar CNPJ">{cnpj.busy ? <Spinner className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}</Button>}
          </div>
        </Field>
        <Field label={form.type === 'transfer' ? 'Conta de origem' : 'Conta'}>
          <Select required value={form.account_id} onChange={set('account_id')}>
            <option value="">Selecione</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </Field>
        {form.type === 'transfer' ? (
          <Field label="Conta de destino">
            <Select required value={form.account_to_id} onChange={set('account_to_id')}>
              <option value="">Selecione</option>
              {accounts.filter((a) => a.id !== form.account_id).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>
        ) : (
          <Field label="Categoria">
            <Select value={form.category_id} onChange={set('category_id')}>
              <option value="">Sem categoria</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        )}
        {form.type !== 'transfer' && (
          <div className="grid grid-cols-2 gap-3 items-end">
            <Field label="Recorrencia">
              <Select value={form.recurrence} onChange={set('recurrence')}>
                <option value="none">Nenhuma</option>
                <option value="monthly">Mensal</option>
                <option value="weekly">Semanal</option>
                <option value="yearly">Anual</option>
              </Select>
            </Field>
            <label className="flex items-center gap-2 pb-2 text-sm">
              <input type="checkbox" checked={form.is_fixed} onChange={(e) => setForm((f) => ({ ...f, is_fixed: e.target.checked }))} className="w-4 h-4 accent-emerald-500" />
              Lancamento fixo
            </label>
          </div>
        )}
        {form.type !== 'transfer' && (
          <label className="flex items-center gap-2 text-sm p-3 rounded-lg border border-[hsl(var(--border))]">
            <input type="checkbox" checked={form.status === 'completed'} onChange={(e) => setForm((f) => ({ ...f, status: e.target.checked ? 'completed' : 'pending' }))} className="w-4 h-4 accent-emerald-500" />
            {form.type === 'income' ? 'Ja recebi este valor' : 'Ja paguei este valor'}
            <span className="text-xs text-muted ml-auto">(afeta o saldo)</span>
          </label>
        )}

        <Field label="Comprovante (opcional)" hint="Anexe a foto do comprovante ou um PDF para controle">
          {form.receipt_url ? (
            <div className="flex items-center gap-3 p-2 rounded-lg border border-[hsl(var(--border))]">
              {form.receipt_url.startsWith('data:application/pdf') || form.receipt_url.includes('.pdf')
                ? <span className="w-12 h-12 rounded-lg bg-rose-500/10 flex items-center justify-center"><FileText className="w-6 h-6 text-rose-500" /></span>
                : <img src={form.receipt_url} alt="" className="w-12 h-12 rounded-lg object-cover" />}
              <span className="text-sm text-muted flex-1">Comprovante anexado</span>
              <button type="button" onClick={() => window.open(form.receipt_url, '_blank')} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><Eye className="w-4 h-4" /></button>
              <button type="button" onClick={() => setForm((f) => ({ ...f, receipt_url: '' }))} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"><X className="w-4 h-4" /></button>
            </div>
          ) : (
            <>
              <input ref={receiptRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={onReceipt} />
              <button type="button" onClick={() => receiptRef.current?.click()} disabled={busyReceipt} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 border-dashed border-[hsl(var(--border))] text-sm text-muted hover:bg-black/5 dark:hover:bg-white/5">
                {busyReceipt ? <Spinner className="w-4 h-4" /> : <><Paperclip className="w-4 h-4" /> Anexar comprovante</>}
              </button>
            </>
          )}
        </Field>
      </form>
    </Modal>
  );
}
