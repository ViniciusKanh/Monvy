import { useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CreditCard, CreditCardTransaction, CreditCardInvoice, Account, Category, AppSettings, Ai, Cards } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { Button, Card, Input, Select, Field, Modal, Spinner, EmptyState, Badge } from '../components/ui';
import { Reveal, AnimatedValue } from '../components/Animated.jsx';
import { toast } from '../lib/toast.js';
import { formatCurrency, monthKey, monthLabel, todayIso } from '../lib/utils.js';
import { colorAt } from '../lib/analytics.js';
import { buildCategoryIndex, predictCategory } from '../lib/categoryPredictor.js';
import { Plus, CreditCard as CardIcon, ChevronLeft, ChevronRight, Pencil, Trash2, Sparkles, FileText, CheckCircle2, Wallet, AlertTriangle, Nfc } from 'lucide-react';

const BRANDS = ['visa', 'mastercard', 'elo', 'amex', 'hipercard', 'other'];
const emptyCard = { name: '', last_digits: '', brand: 'visa', closing_day: 1, due_day: 10, credit_limit: '', color: '#6d28d9', account_id: '' };
const emptyTx = { description: '', amount: '', date: todayIso(), category_id: '', installments_total: 1 };
const CARD_COLORS = ['#6d28d9', '#0b1330', '#0f766e', '#1e293b', '#7c2d12', '#831843'];

export default function CreditCards() {
  const qc = useQueryClient();
  const { data: cards = [], isLoading } = useQuery({ queryKey: ['cards'], queryFn: () => CreditCard.list() });
  const { data: txs = [] } = useQuery({ queryKey: ['cardtx'], queryFn: () => CreditCardTransaction.list() });
  const { data: invoices = [] } = useQuery({ queryKey: ['invoices'], queryFn: () => CreditCardInvoice.list() });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => Account.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });
  const { data: settingsList = [] } = useQuery({ queryKey: ['appsettings'], queryFn: () => AppSettings.list() });

  const [selectedId, setSelectedId] = useState(null);
  const [mk, setMk] = useState(monthKey(new Date()));
  const [cardModal, setCardModal] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [cardForm, setCardForm] = useState(emptyCard);
  const [txModal, setTxModal] = useState(false);
  const [txForm, setTxForm] = useState(emptyTx);
  const [payModal, setPayModal] = useState(null);
  const [payAccount, setPayAccount] = useState('');
  const [payMode, setPayMode] = useState('full');
  const [payAmount, setPayAmount] = useState('');
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);

  const selected = cards.find((c) => c.id === selectedId) || cards[0];
  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const monthTxs = useMemo(() => txs.filter((t) => t.card_id === selected?.id && (t.competence_month === mk || String(t.date).slice(0, 7) === mk)), [txs, selected, mk]);
  const invoiceTotal = monthTxs.reduce((s, t) => s + Number(t.amount), 0);
  const selectedInvoice = invoices.find((i) => i.card_id === selected?.id && i.competence_month === mk);
  const usage = selected?.credit_limit ? Math.min(100, Math.round((invoiceTotal / Number(selected.credit_limit)) * 100)) : 0;
  const available = selected?.credit_limit ? Number(selected.credit_limit) - invoiceTotal : null;

  const topCats = useMemo(() => {
    const map = {};
    for (const t of monthTxs) { const c = catMap[t.category_id]; const n = c?.name || 'Sem categoria'; map[n] = map[n] || { name: n, value: 0, color: c?.color }; map[n].value += Number(t.amount); }
    return Object.values(map).sort((a, b) => b.value - a.value).map((x, i) => ({ ...x, color: x.color || colorAt(i) }));
  }, [monthTxs, catMap]);
  const maxCat = topCats[0]?.value || 1;

  // ----- mutations -----
  const saveCard = useMutation({ mutationFn: (p) => editingCard ? CreditCard.update(editingCard.id, p) : CreditCard.create(p), onSuccess: () => { qc.invalidateQueries({ queryKey: ['cards'] }); setCardModal(false); } });
  const delCard = useMutation({ mutationFn: (id) => CreditCard.remove(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['cards'] }); setSelectedId(null); } });
  const delTx = useMutation({ mutationFn: (id) => CreditCardTransaction.remove(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['cardtx'] }) });
  const delImported = useMutation({
    mutationFn: async () => {
      const imported = txs.filter((t) => t.card_id === selected?.id && (t.competence_month === mk) && t.imported_from_pdf);
      for (const t of imported) await CreditCardTransaction.remove(t.id);
      if (selectedInvoice) await CreditCardInvoice.remove(selectedInvoice.id);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cardtx'] }); qc.invalidateQueries({ queryKey: ['invoices'] }); toast.success('Fatura importada excluida.'); },
  });
  const genInvoices = useMutation({ mutationFn: () => Cards.generateInvoices(), onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); toast.success('Faturas atualizadas.'); } });
  const payInvoice = useMutation({ mutationFn: (payload) => Cards.payInvoice(payload), onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['invoices'] }); qc.invalidateQueries({ queryKey: ['accounts'] }); qc.invalidateQueries({ queryKey: ['transactions'] }); setPayModal(null); toast.success(r?.fullyPaid === false ? 'Pagamento parcial registrado!' : 'Fatura paga!'); } });
  const saveTx = useMutation({
    mutationFn: (p) => {
      const n = Math.max(1, Number(p.installments_total) || 1);
      if (n > 1) {
        const items = []; const base = new Date(p.date + 'T00:00'); const per = Number(p.amount) / n;
        for (let i = 0; i < n; i++) { const d = new Date(base.getFullYear(), base.getMonth() + i, base.getDate()); items.push({ card_id: selected.id, description: `${p.description} (${i + 1}/${n})`, amount: per, date: d.toISOString().slice(0, 10), category_id: p.category_id || null, installments_total: n, installment_current: i + 1, competence_month: monthKey(d) }); }
        return CreditCardTransaction.bulkCreate(items);
      }
      return CreditCardTransaction.create({ card_id: selected.id, description: p.description, amount: Number(p.amount), date: p.date, category_id: p.category_id || null, installments_total: 1, installment_current: 1, competence_month: monthKey(new Date(p.date + 'T00:00')) });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cardtx'] }); setTxModal(false); setTxForm(emptyTx); },
  });

  async function ensureCategory(name) {
    const found = categories.find((c) => c.name.toLowerCase() === String(name).toLowerCase() && c.type === 'expense');
    if (found) return found.id;
    const created = await Category.create({ name, type: 'expense', color: colorAt(Math.floor(Math.random() * 8)) });
    return created.id;
  }
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1] || '');
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }
  async function importRows(items, source) {
    const idx = buildCategoryIndex(txs.map((t) => ({ description: t.description, category_id: t.category_id, type: 'expense' })));
    const cache = {}; const rows = [];
    for (const it of items) {
      let catId = predictCategory(it.description, idx);
      const hint = it.category || it.categoryHint;
      if (!catId && hint) catId = cache[hint] ?? (cache[hint] = await ensureCategory(hint));
      rows.push({ card_id: selected.id, description: it.description, amount: Number(it.amount) || 0, date: it.date, category_id: catId || null, installments_total: it.installments_total || 1, installment_current: it.installment_current || 1, competence_month: mk, imported_from_pdf: true });
    }
    await CreditCardTransaction.bulkCreate(rows);
    await Cards.generateInvoices();
    qc.invalidateQueries({ queryKey: ['cardtx'] }); qc.invalidateQueries({ queryKey: ['categories'] }); qc.invalidateQueries({ queryKey: ['invoices'] });
    const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
    const credits = rows.filter((r) => r.amount < 0).length;
    toast.success(`${rows.length} lancamentos (${source})${credits ? ` incl. ${credits} estorno(s)` : ''} · total ${formatCurrency(total)}. Confira com o PDF.`);
  }
  async function handleInvoiceFile(e) {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file || !selected) return;
    setImporting(true);
    const apiKey = settingsList[0]?.gemini_api_key;
    try {
      // 1) IA (Gemini le o PDF nativamente) — melhor precisao em qualquer banco
      if (apiKey) {
        toast.info('Lendo a fatura com IA...');
        try {
          const base64 = await fileToBase64(file);
          const { items = [] } = await Ai.parseInvoice(base64, apiKey, categories.map((c) => ({ id: c.id, name: c.name })));
          if (items.length) { await importRows(items, 'IA'); setImporting(false); return; }
          toast.info('A IA nao encontrou lancamentos — tentando leitura local...');
        } catch (aiErr) {
          toast.info('IA indisponivel (' + (aiErr.message || 'erro') + ') — tentando leitura local...');
        }
      } else {
        toast.info('Chave de IA nao configurada. Usando leitura local — configure a chave em Configuracoes para melhor precisao.');
      }
      // 2) Fallback local (offline)
      const { parseInvoicePdf } = await import('../lib/invoiceParser.js');
      const { isInvoice, items } = await parseInvoicePdf(file, { year: Number(mk.slice(0, 4)), onOcr: () => toast.info('PDF sem texto — lendo com OCR local (pode demorar)...') });
      if (!isInvoice && items.length < 2) { toast.error('Este PDF nao parece uma fatura de cartao de credito.'); setImporting(false); return; }
      if (!items.length) { toast.error('Nao encontrei lancamentos na fatura.'); setImporting(false); return; }
      await importRows(items, 'local');
    } catch (err) { toast.error('Falha ao ler o PDF: ' + (err.message || err)); } finally { setImporting(false); }
  }

  const openNewCard = () => { setEditingCard(null); setCardForm({ ...emptyCard, account_id: accounts[0]?.id || '' }); setCardModal(true); };
  const openEditCard = (c) => { setEditingCard(c); setCardForm({ name: c.name, last_digits: c.last_digits || '', brand: c.brand, closing_day: c.closing_day, due_day: c.due_day, credit_limit: c.credit_limit ?? '', color: c.color, account_id: c.account_id || '' }); setCardModal(true); };
  const setCf = (k) => (e) => setCardForm((f) => ({ ...f, [k]: e.target.value }));
  const setTf = (k) => (e) => setTxForm((f) => ({ ...f, [k]: e.target.value }));
  const submitCard = (e) => { e.preventDefault(); saveCard.mutate({ ...cardForm, closing_day: Number(cardForm.closing_day), due_day: Number(cardForm.due_day), credit_limit: cardForm.credit_limit === '' ? null : Number(cardForm.credit_limit), account_id: cardForm.account_id || null }); };
  const shiftMonth = (d) => { const [y, m] = mk.split('-').map(Number); setMk(monthKey(new Date(y, m - 1 + d, 1))); };

  return (
    <div className="animate-fadeIn">
      <PageHeader title="Cartoes" subtitle="Gestao de cartoes de credito e faturas"
        actions={<><Button variant="outline" onClick={() => genInvoices.mutate()} disabled={genInvoices.isPending}>{genInvoices.isPending ? <Spinner className="w-4 h-4" /> : <><FileText className="w-4 h-4" /> Gerar faturas</>}</Button><Button onClick={openNewCard}><Plus className="w-4 h-4" /> Novo cartao</Button></>} />

      {isLoading ? <div className="flex justify-center py-10"><Spinner className="w-6 h-6 text-emerald-500" /></div>
        : cards.length === 0 ? <Card><EmptyState icon={CardIcon} title="Nenhum cartao" subtitle="Cadastre um cartao de credito para controlar faturas e limites." action={<Button onClick={openNewCard}><Plus className="w-4 h-4" /> Novo cartao</Button>} /></Card>
        : (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Lista de cartoes */}
            <div className="space-y-4">
              {cards.map((c, i) => {
                const cUsage = c.credit_limit ? Math.min(100, Math.round((txs.filter((t) => t.card_id === c.id && (t.competence_month === mk || String(t.date).slice(0, 7) === mk)).reduce((s, t) => s + Number(t.amount), 0) / Number(c.credit_limit)) * 100)) : 0;
                const active = selected?.id === c.id;
                return (
                  <Reveal key={c.id} i={i}>
                    <button onClick={() => setSelectedId(c.id)} className="w-full text-left">
                      <div className={`relative overflow-hidden rounded-2xl p-5 text-white shadow-card transition hover-lift ${active ? 'ring-2 ring-emerald-400' : ''}`} style={{ background: `linear-gradient(135deg, ${c.color || CARD_COLORS[i % CARD_COLORS.length]}, #05070f 140%)` }}>
                        <div className="absolute -right-10 -top-10 w-32 h-32 rounded-full bg-white/10" />
                        <div className="relative flex justify-between items-start">
                          <div className="w-10 h-7 rounded-md bg-gradient-to-br from-yellow-300 to-yellow-500" />
                          <div className="flex items-center gap-2"><Nfc className="w-5 h-5 opacity-70" /><span className="uppercase text-xs font-bold tracking-widest">{c.brand}</span></div>
                        </div>
                        <p className="relative mt-6 tracking-[0.2em] text-lg">•••• •••• •••• {c.last_digits || '0000'}</p>
                        <div className="relative flex justify-between items-end mt-4">
                          <div><p className="text-[10px] text-white/60 uppercase">Titular</p><p className="font-semibold text-sm">{c.name}</p></div>
                          <div className="text-right"><p className="text-[10px] text-white/60 uppercase">Vence</p><p className="font-semibold text-sm">dia {c.due_day}</p></div>
                        </div>
                        {c.credit_limit > 0 && (
                          <div className="relative mt-3">
                            <div className="h-1.5 rounded-full bg-white/20 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${cUsage}%`, background: cUsage >= 90 ? '#fb7185' : cUsage >= 70 ? '#fbbf24' : '#34d399' }} /></div>
                            <p className="text-[10px] text-white/70 mt-1">{cUsage}% do limite usado</p>
                          </div>
                        )}
                      </div>
                    </button>
                  </Reveal>
                );
              })}
            </div>

            {/* Detalhe do cartao selecionado */}
            {selected && (
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <button onClick={() => shiftMonth(-1)} className="p-2 rounded-lg card"><ChevronLeft className="w-4 h-4" /></button>
                    <span className="font-semibold min-w-[130px] text-center capitalize">{monthLabel(mk)}</span>
                    <button onClick={() => shiftMonth(1)} className="p-2 rounded-lg card"><ChevronRight className="w-4 h-4" /></button>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEditCard(selected)} className="p-2 rounded-lg card"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => delCard.mutate(selected.id)} className="p-2 rounded-lg card text-rose-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Card className="py-3"><p className="text-xs text-muted">Fatura</p><p className="font-display text-lg font-bold"><AnimatedValue value={invoiceTotal} format={formatCurrency} /></p></Card>
                  <Card className="py-3"><p className="text-xs text-muted">Limite disponivel</p><p className={`font-display text-lg font-bold ${available != null && available < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{available != null ? formatCurrency(available) : '-'}</p></Card>
                  <Card className="py-3"><p className="text-xs text-muted">Lancamentos</p><p className="font-display text-lg font-bold">{monthTxs.length}</p></Card>
                  <Card className="py-3"><p className="text-xs text-muted">Vencimento</p><p className="font-display text-lg font-bold">dia {selected.due_day}</p></Card>
                </div>

                {selected.credit_limit > 0 && (
                  <Card className="py-3">
                    <div className="flex justify-between text-xs mb-1"><span className="text-muted">Uso do limite</span><span className="font-semibold">{usage}% de {formatCurrency(selected.credit_limit)}</span></div>
                    <div className="h-2.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${usage}%`, background: usage >= 90 ? '#f43f5e' : usage >= 70 ? '#f59e0b' : '#10b981' }} /></div>
                    {usage >= 80 && <p className="text-xs text-amber-500 mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Voce ja usou {usage}% do limite deste cartao.</p>}
                  </Card>
                )}

                {invoiceTotal > 0 && (() => {
                  const isPaid = selectedInvoice?.status === 'paid';
                  const totalDue = Number(selectedInvoice?.total_amount ?? invoiceTotal);
                  const paidSoFar = Number(selectedInvoice?.paid_amount || 0);
                  const remaining = totalDue - paidSoFar;
                  return (
                    <Card className="py-3 flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        {isPaid ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <FileText className="w-5 h-5 text-amber-500" />}
                        <div>
                          <p className="text-sm font-semibold">Fatura {monthLabel(mk)}</p>
                          <p className="text-xs text-muted">{selectedInvoice?.due_date ? `Venc. ${new Date(selectedInvoice.due_date + 'T00:00').toLocaleDateString('pt-BR')} · ` : ''}{formatCurrency(totalDue)}{paidSoFar > 0 && !isPaid ? ` · em aberto ${formatCurrency(remaining)}` : ''}</p>
                        </div>
                      </div>
                      {isPaid ? <Badge color="emerald">Paga</Badge>
                        : <Button size="sm" onClick={() => { setPayModal({ invoiceId: selectedInvoice?.id || null, cardId: selected.id, competence_month: mk, total: totalDue, remaining }); setPayAccount(selected.account_id || accounts[0]?.id || ''); setPayMode('full'); setPayAmount(''); }}><Wallet className="w-4 h-4" /> Pagar fatura</Button>}
                    </Card>
                  );
                })()}

                {topCats.length > 0 && (
                  <Card>
                    <h3 className="font-semibold mb-3 text-sm">Onde voce gastou neste cartao</h3>
                    <div className="space-y-2.5">
                      {topCats.slice(0, 5).map((c, i) => (
                        <div key={i}><div className="flex justify-between text-sm mb-1"><span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: c.color }} />{c.name}</span><span className="font-semibold">{formatCurrency(c.value)}</span></div><div className="h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(c.value / maxCat) * 100}%`, background: c.color }} /></div></div>
                      ))}
                    </div>
                  </Card>
                )}

                <div className="flex justify-between items-center flex-wrap gap-2">
                  <h3 className="font-semibold">Lancamentos</h3>
                  <div className="flex gap-2">
                    <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={handleInvoiceFile} />
                    <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={importing}>{importing ? <Spinner className="w-4 h-4" /> : <><Sparkles className="w-4 h-4 text-emerald-500" /> Importar fatura</>}</Button>
                    {monthTxs.some((t) => t.imported_from_pdf) && <Button size="sm" variant="outline" onClick={() => { if (confirm('Excluir os lancamentos importados desta fatura?')) delImported.mutate(); }} disabled={delImported.isPending}>{delImported.isPending ? <Spinner className="w-4 h-4" /> : <><Trash2 className="w-4 h-4 text-rose-500" /> Excluir fatura</>}</Button>}
                    <Button size="sm" onClick={() => { setTxForm({ ...emptyTx }); setTxModal(true); }}><Plus className="w-4 h-4" /> Compra</Button>
                  </div>
                </div>

                {monthTxs.length === 0 ? <Card><EmptyState icon={CardIcon} title="Sem lancamentos" subtitle="Adicione compras ou importe a fatura em PDF." /></Card>
                  : (
                    <Card className="p-0 divide-y divide-[hsl(var(--border))]">
                      {monthTxs.map((t) => (
                        <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                          <span className="w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0" style={{ background: catMap[t.category_id]?.color || '#64748b' }}><CardIcon className="w-4 h-4" /></span>
                          <div className="flex-1 min-w-0"><p className="font-medium truncate">{t.description}</p><div className="flex items-center gap-2 text-xs text-muted">{catMap[t.category_id]?.name || 'Sem categoria'}{t.installments_total > 1 ? <Badge color="blue">{t.installment_current}/{t.installments_total}</Badge> : null}{t.imported_from_pdf ? <Badge color="violet">PDF</Badge> : null}</div></div>
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

      {/* Modal cartao */}
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
          <Field label="Conta para pagamento"><Select value={cardForm.account_id} onChange={setCf('account_id')}><option value="">Nenhuma</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
          <Field label="Cor do cartao"><div className="flex gap-2 flex-wrap">{CARD_COLORS.map((c) => <button key={c} type="button" onClick={() => setCardForm((f) => ({ ...f, color: c }))} className={`w-8 h-8 rounded-full border-2 ${cardForm.color === c ? 'border-slate-900 dark:border-white scale-110' : 'border-transparent'}`} style={{ background: c }} />)}</div></Field>
        </form>
      </Modal>

      {/* Modal pagar */}
      <Modal open={!!payModal} onClose={() => setPayModal(null)} title="Pagar fatura" maxWidth="max-w-md"
        footer={<><Button variant="outline" onClick={() => setPayModal(null)}>Cancelar</Button>
          <Button onClick={() => payInvoice.mutate({ invoiceId: payModal.invoiceId, cardId: payModal.cardId, competence_month: payModal.competence_month, accountId: payAccount, amount: payMode === 'partial' ? Number(String(payAmount).replace(',', '.')) : undefined })} disabled={!payAccount || payInvoice.isPending || (payMode === 'partial' && !(Number(String(payAmount).replace(',', '.')) > 0))}>{payInvoice.isPending ? <Spinner className="w-4 h-4" /> : 'Confirmar pagamento'}</Button></>}>
        <div className="space-y-3">
          <div className="rounded-xl bg-emerald-500/10 p-3">
            <p className="text-xs text-muted">Fatura {payModal ? monthLabel(payModal.competence_month) : ''}</p>
            <p className="font-display text-2xl font-bold">{payModal ? formatCurrency(payModal.remaining) : ''}</p>
            <p className="text-xs text-muted">valor em aberto</p>
          </div>
          <Field label="Pagar com a conta"><Select value={payAccount} onChange={(e) => setPayAccount(e.target.value)}><option value="">Selecione</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
          <Field label="Tipo de pagamento">
            <div className="inline-flex p-1 rounded-lg bg-black/5 dark:bg-white/5 w-full">
              {[['full', 'Valor total'], ['partial', 'Outro valor']].map(([v, l]) => (<button key={v} type="button" onClick={() => setPayMode(v)} className={`flex-1 px-3 py-1.5 rounded-md text-sm font-semibold transition ${payMode === v ? 'bg-[hsl(var(--card))] shadow' : 'text-muted'}`}>{l}</button>))}
            </div>
          </Field>
          {payMode === 'partial' && <Field label="Valor a pagar"><Input type="number" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="0,00" /></Field>}
          <p className="text-xs text-muted">Cria um lancamento "Fatura {payModal ? payModal.competence_month : ''}" debitando a conta escolhida.</p>
        </div>
      </Modal>

      {/* Modal compra */}
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
