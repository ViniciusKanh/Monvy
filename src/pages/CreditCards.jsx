import { useMemo, useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CreditCard, CreditCardTransaction, Account, Category, AppSettings, Ai } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { Button, Card, Input, Select, Field, Modal, Spinner, EmptyState, Badge } from '../components/ui';
import { formatCurrency, monthKey, monthLabel, todayIso } from '../lib/utils.js';
import { Plus, CreditCard as CardIcon, ChevronLeft, ChevronRight, Pencil, Trash2, Upload, Sparkles } from 'lucide-react';
import { toast } from '../lib/toast.js';

const BRANDS = ['visa', 'mastercard', 'elo', 'amex', 'hipercard', 'other'];
const emptyCard = { name: '', last_digits: '', brand: 'visa', closing_day: 1, due_day: 10, credit_limit: '', color: '#1a1a2e' };
const emptyTx = { description: '', amount: '', date: todayIso(), category_id: '', installments_total: 1 };

export default function CreditCards() {
  const qc = useQueryClient();
  const { data: cards = [], isLoading } = useQuery({ queryKey: ['cards'], queryFn: () => CreditCard.list() });
  const { data: txs = [] } = useQuery({ queryKey: ['cardtx'], queryFn: () => CreditCardTransaction.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });
  const { data: settingsList = [] } = useQuery({ queryKey: ['appsettings'], queryFn: () => AppSettings.list() });
  const fileRef = useRef(null);
  const [importing, setImporting] = useState(false);

  const [selectedId, setSelectedId] = useState(null);
  const [mk, setMk] = useState(monthKey(new Date()));
  const [cardModal, setCardModal] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [cardForm, setCardForm] = useState(emptyCard);
  const [txModal, setTxModal] = useState(false);
  const [txForm, setTxForm] = useState(emptyTx);

  const selected = cards.find((c) => c.id === selectedId) || cards[0];

  async function ensureCategory(name) {
    const found = categories.find((c) => c.name.toLowerCase() === String(name).toLowerCase() && c.type === 'expense');
    if (found) return found.id;
    const palette = ['#10b981','#3b82f6','#f59e0b','#8b5cf6','#ef4444','#ec4899','#14b8a6'];
    const created = await Category.create({ name, type: 'expense', color: palette[Math.floor(Math.random()*palette.length)] });
    return created.id;
  }

  async function handleInvoiceFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !selected) return;
    const key = settingsList[0]?.gemini_api_key;
    if (!key) { toast.error('Configure a chave da API Gemini em Configuracoes.'); return; }
    setImporting(true);
    try {
      const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(file); });
      toast.info('Lendo fatura com IA...');
      const { items } = await Ai.parseInvoice(b64, key, categories.map((c) => ({ id: c.id, name: c.name })));
      if (!items?.length) { toast.error('Nenhum lancamento encontrado no PDF.'); setImporting(false); return; }
      const catCache = {};
      const rows = [];
      for (const it of items) {
        let catId = null;
        if (it.category) { catId = catCache[it.category] ?? (catCache[it.category] = await ensureCategory(it.category)); }
        rows.push({ card_id: selected.id, description: it.description, amount: it.amount, date: it.date || todayIso(),
          category_id: catId, installments_total: it.installments_total || 1, installment_current: it.installment_current || 1,
          competence_month: (it.date || todayIso()).slice(0,7), imported_from_pdf: true });
      }
      await CreditCardTransaction.bulkCreate(rows);
      qc.invalidateQueries({ queryKey: ['cardtx'] });
      qc.invalidateQueries({ queryKey: ['categories'] });
      toast.success(`${rows.length} lancamentos importados da fatura!`);
    } catch (err) {
      toast.error(err.message || 'Falha ao importar fatura');
    } finally { setImporting(false); }
  }
  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const monthTxs = useMemo(() => txs.filter((t) => t.card_id === selected?.id && (t.competence_month === mk || String(t.date).slice(0, 7) === mk)), [txs, selected, mk]);
  const invoiceTotal = monthTxs.reduce((s, t) => s + Number(t.amount), 0);

  const saveCard = useMutation({
    mutationFn: (p) => editingCard ? CreditCard.update(editingCard.id, p) : CreditCard.create(p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cards'] }); setCardModal(false); },
  });
  const delCard = useMutation({ mutationFn: (id) => CreditCard.remove(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['cards'] }) });
  const delTx = useMutation({ mutationFn: (id) => CreditCardTransaction.remove(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['cardtx'] }) });

  const saveTx = useMutation({
    mutationFn: (p) => {
      const n = Math.max(1, Number(p.installments_total) || 1);
      if (n > 1) {
        const items = [];
        const base = new Date(p.date + 'T00:00');
        const per = Number(p.amount) / n;
        for (let i = 0; i < n; i++) {
          const d = new Date(base.getFullYear(), base.getMonth() + i, base.getDate());
          items.push({ card_id: selected.id, description: `${p.description} (${i + 1}/${n})`, amount: per, date: d.toISOString().slice(0, 10), category_id: p.category_id || null, installments_total: n, installment_current: i + 1, competence_month: monthKey(d) });
        }
        return CreditCardTransaction.bulkCreate(items);
      }
      return CreditCardTransaction.create({ card_id: selected.id, description: p.description, amount: Number(p.amount), date: p.date, category_id: p.category_id || null, installments_total: 1, installment_current: 1, competence_month: monthKey(new Date(p.date + 'T00:00')) });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cardtx'] }); setTxModal(false); setTxForm(emptyTx); },
  });

  const openNewCard = () => { setEditingCard(null); setCardForm(emptyCard); setCardModal(true); };
  const openEditCard = (c) => { setEditingCard(c); setCardForm({ name: c.name, last_digits: c.last_digits || '', brand: c.brand, closing_day: c.closing_day, due_day: c.due_day, credit_limit: c.credit_limit ?? '', color: c.color }); setCardModal(true); };
  const setCf = (k) => (e) => setCardForm((f) => ({ ...f, [k]: e.target.value }));
  const setTf = (k) => (e) => setTxForm((f) => ({ ...f, [k]: e.target.value }));
  const submitCard = (e) => { e.preventDefault(); saveCard.mutate({ ...cardForm, closing_day: Number(cardForm.closing_day), due_day: Number(cardForm.due_day), credit_limit: cardForm.credit_limit === '' ? null : Number(cardForm.credit_limit) }); };
  const shiftMonth = (d) => { const [y, m] = mk.split('-').map(Number); setMk(monthKey(new Date(y, m - 1 + d, 1))); };

  const usage = selected?.credit_limit ? Math.min(100, Math.round((invoiceTotal / Number(selected.credit_limit)) * 100)) : 0;

  return (
    <div>
      <PageHeader title="Cartoes" subtitle="Gestao de cartoes de credito e faturas"
        actions={<Button onClick={openNewCard}><Plus className="w-4 h-4" /> Novo cartao</Button>} />

      {isLoading ? <div className="flex justify-center py-10"><Spinner className="w-6 h-6 text-emerald-500" /></div>
        : cards.length === 0 ? <Card><EmptyState icon={CardIcon} title="Nenhum cartao" subtitle="Cadastre um cartao de credito para controlar faturas." action={<Button onClick={openNewCard}><Plus className="w-4 h-4" /> Novo cartao</Button>} /></Card>
        : (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="space-y-3">
              {cards.map((c) => (
                <button key={c.id} onClick={() => setSelectedId(c.id)} className="w-full text-left">
                  <div className={`rounded-2xl p-4 text-white shadow-lg transition ${selected?.id === c.id ? 'ring-2 ring-emerald-400' : ''}`} style={{ background: `linear-gradient(135deg, ${c.color}, #0d1433)` }}>
                    <div className="flex justify-between items-start">
                      <div className="w-8 h-6 rounded bg-yellow-400/80" />
                      <span className="uppercase text-xs font-bold tracking-wider">{c.brand}</span>
                    </div>
                    <p className="mt-6 tracking-widest">**** **** **** {c.last_digits || '0000'}</p>
                    <div className="flex justify-between items-end mt-3">
                      <span className="font-semibold">{c.name}</span>
                      <span className="text-xs opacity-80">Venc. dia {c.due_day}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {selected && (
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button onClick={() => shiftMonth(-1)} className="p-2 rounded-lg card"><ChevronLeft className="w-4 h-4" /></button>
                    <span className="font-semibold min-w-[130px] text-center">{monthLabel(mk)}</span>
                    <button onClick={() => shiftMonth(1)} className="p-2 rounded-lg card"><ChevronRight className="w-4 h-4" /></button>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEditCard(selected)} className="p-2 rounded-lg card"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => delCard.mutate(selected.id)} className="p-2 rounded-lg card text-rose-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <Card className="py-3"><p className="text-xs text-muted">Fatura</p><p className="font-display text-lg font-bold">{formatCurrency(invoiceTotal)}</p></Card>
                  <Card className="py-3"><p className="text-xs text-muted">Limite</p><p className="font-display text-lg font-bold">{selected.credit_limit ? formatCurrency(selected.credit_limit) : '-'}</p></Card>
                  <Card className="py-3"><p className="text-xs text-muted">Lancamentos</p><p className="font-display text-lg font-bold">{monthTxs.length}</p></Card>
                </div>

                {selected.credit_limit > 0 && (
                  <Card className="py-3">
                    <div className="flex justify-between text-xs mb-1"><span className="text-muted">Uso do limite</span><span className="font-semibold">{usage}%</span></div>
                    <div className="h-2.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${usage}%`, background: usage >= 90 ? '#ef4444' : usage >= 70 ? '#f59e0b' : '#10b981' }} /></div>
                  </Card>
                )}

                <div className="flex justify-between items-center">
                  <h3 className="font-semibold">Lancamentos</h3>
                  <div className="flex gap-2">
                    <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={handleInvoiceFile} />
                    <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={importing}>{importing ? <Spinner className="w-4 h-4" /> : <><Sparkles className="w-4 h-4 text-emerald-500" /> Importar fatura</>}</Button>
                    <Button size="sm" onClick={() => { setTxForm({ ...emptyTx }); setTxModal(true); }}><Plus className="w-4 h-4" /> Compra</Button>
                  </div>
                </div>

                {monthTxs.length === 0 ? <Card><EmptyState icon={CardIcon} title="Sem lancamentos" subtitle="Adicione compras a este cartao." /></Card>
                  : (
                    <Card className="p-0 divide-y divide-[hsl(var(--border))]">
                      {monthTxs.map((t) => (
                        <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                          <span className="w-9 h-9 rounded-lg flex items-center justify-center text-white" style={{ background: catMap[t.category_id]?.color || '#64748b' }}><CardIcon className="w-4 h-4" /></span>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{t.description}</p>
                            <div className="flex items-center gap-2 text-xs text-muted">{catMap[t.category_id]?.name || 'Sem categoria'}{t.imported_from_pdf ? <Badge color="violet">PDF</Badge> : null}</div>
                          </div>
                          <p className="font-semibold text-rose-500">{formatCurrency(t.amount)}</p>
                          <button onClick={() => delTx.mutate(t.id)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      ))}
                    </Card>
                  )}
              </div>
            )}
          </div>
        )}

      <Modal open={cardModal} onClose={() => setCardModal(false)} title={editingCard ? 'Editar cartao' : 'Novo cartao'}
        footer={<><Button variant="outline" onClick={() => setCardModal(false)}>Cancelar</Button><Button onClick={submitCard} disabled={saveCard.isPending}>{saveCard.isPending ? <Spinner className="w-4 h-4" /> : 'Salvar'}</Button></>}>
        <form onSubmit={submitCard} className="space-y-4">
          <Field label="Nome"><Input required value={cardForm.name} onChange={setCf('name')} placeholder="Ex: Nubank" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ultimos 4 digitos"><Input maxLength={4} value={cardForm.last_digits} onChange={setCf('last_digits')} /></Field>
            <Field label="Bandeira"><Select value={cardForm.brand} onChange={setCf('brand')}>{BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}</Select></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Dia fechamento"><Input type="number" min="1" max="31" value={cardForm.closing_day} onChange={setCf('closing_day')} /></Field>
            <Field label="Dia vencimento"><Input type="number" min="1" max="31" value={cardForm.due_day} onChange={setCf('due_day')} /></Field>
          </div>
          <Field label="Limite"><Input type="number" step="0.01" value={cardForm.credit_limit} onChange={setCf('credit_limit')} /></Field>
        </form>
      </Modal>

      <Modal open={txModal} onClose={() => setTxModal(false)} title="Nova compra"
        footer={<><Button variant="outline" onClick={() => setTxModal(false)}>Cancelar</Button><Button onClick={(e) => { e.preventDefault(); saveTx.mutate(txForm); }} disabled={saveTx.isPending}>{saveTx.isPending ? <Spinner className="w-4 h-4" /> : 'Adicionar'}</Button></>}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); saveTx.mutate(txForm); }}>
          <Field label="Descricao"><Input required value={txForm.description} onChange={setTf('description')} placeholder="Ex: Amazon" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor total"><Input type="number" step="0.01" required value={txForm.amount} onChange={setTf('amount')} /></Field>
            <Field label="Data"><Input type="date" value={txForm.date} onChange={setTf('date')} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoria"><Select value={txForm.category_id} onChange={setTf('category_id')}><option value="">Sem categoria</option>{categories.filter((c) => c.type === 'expense').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
            <Field label="Parcelas"><Input type="number" min="1" value={txForm.installments_total} onChange={setTf('installments_total')} /></Field>
          </div>
        </form>
      </Modal>
    </div>
  );
}
