import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppSettings, Auth, Admin, Account, Category, Transaction, CreditCard, CreditCardTransaction, Goal, Subscription, Investment, Debt } from '../api/entities.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme, ACCENTS } from '../context/ThemeContext.jsx';
import { useLang } from '../context/LangContext.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Button, Input, Select, Field, Spinner, Badge } from '../components/ui';
import { toast } from '../lib/toast.js';
import { Sun, Moon, ShieldCheck, KeyRound, Bell, Palette, User, Sparkles, ExternalLink, Eye, EyeOff, Check, Camera, Lock, Mail, Send, Smartphone, Download, Upload, Languages } from 'lucide-react';

// redimensiona a imagem para ~256px e devolve dataURL (evita foto gigante no banco)
function resizeImage(file, max = 256) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => { img.src = reader.result; };
    reader.onerror = reject;
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(cv.toDataURL('image/jpeg', 0.85));
    };
    reader.readAsDataURL(file);
  });
}

export default function Settings() {
  const qc = useQueryClient();
  const { user, logout, updateProfile, refreshUser } = useAuth();
  const { theme, setTheme, accent, setAccent } = useTheme();
  const { lang, setLang, langs, t } = useLang();
  const { data: list = [], isLoading } = useQuery({ queryKey: ['appsettings'], queryFn: () => AppSettings.list() });
  const settings = list[0];
  const fileRef = useRef(null);

  const [profile, setProfile] = useState({ full_name: '', phone: '', profession: '', photo_url: '', cep: '', address: '' });
  const [cepBusy, setCepBusy] = useState(false);
  const [form, setForm] = useState({ currency: 'BRL', default_view_mode: 'cash', notifications_enabled: true, auto_categorize: true, gemini_api_key: '' });
  const [showKey, setShowKey] = useState(false);

  useEffect(() => { if (user) setProfile({ full_name: user.full_name || '', phone: user.phone || '', profession: user.profession || '', photo_url: user.photo_url || '', cep: user.cep || '', address: user.address || '' }); }, [user]);

  const onCep = async (val) => {
    setProfile((p) => ({ ...p, cep: val }));
    const d = String(val).replace(/\D/g, '');
    if (d.length !== 8) return;
    setCepBusy(true);
    try {
      const r = await fetch(`https://brasilapi.com.br/api/cep/v2/${d}`);
      if (!r.ok) throw new Error('cep');
      const c = await r.json();
      const addr = [c.street, c.neighborhood, c.city && `${c.city}/${c.state}`].filter(Boolean).join(', ');
      setProfile((p) => ({ ...p, address: addr || p.address }));
      toast.success('Endereço preenchido pelo CEP');
    } catch { toast.error('CEP não encontrado'); } finally { setCepBusy(false); }
  };
  useEffect(() => { if (settings) setForm((f) => ({ ...f, ...settings, gemini_api_key: settings.gemini_api_key || '' })); }, [settings]);

  const saveProfile = useMutation({ mutationFn: (p) => updateProfile(p), onSuccess: () => toast.success('Perfil atualizado') });

  const backupRef = useRef(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const exportData = async () => {
    setBackupBusy(true);
    try {
      const [acc, cat, txs, cards, cardtx, goals, subs, inv, debts] = await Promise.all([Account.list(), Category.list(), Transaction.list(), CreditCard.list(), CreditCardTransaction.list(), Goal.list(), Subscription.list(), Investment.list(), Debt.list()]);
      const data = { app: 'Monvy', version: 1, exported_at: new Date().toISOString(), accounts: acc, categories: cat, transactions: txs, cards, cardtx, goals, subscriptions: subs, investments: inv, debts };
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = `monvy-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(url);
      toast.success('Backup exportado');
    } catch { toast.error('Falha ao exportar'); } finally { setBackupBusy(false); }
  };
  const importData = async (e) => {
    const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
    if (!window.confirm('Importar vai CRIAR novos registros a partir do arquivo (não substitui os atuais). Continuar?')) return;
    setBackupBusy(true);
    try {
      const d = JSON.parse(await file.text());
      const strip = (arr) => (arr || []).map(({ id, created_by_id, created_date, updated_date, ...rest }) => rest);
      const map = [['categories', Category], ['accounts', Account], ['transactions', Transaction], ['cards', CreditCard], ['cardtx', CreditCardTransaction], ['goals', Goal], ['subscriptions', Subscription], ['investments', Investment], ['debts', Debt]];
      for (const [key, Ent] of map) { const arr = strip(d[key]); if (arr.length && Ent.bulkCreate) await Ent.bulkCreate(arr); }
      qc.invalidateQueries();
      toast.success('Dados importados! Recarregue a pagina para ver tudo.');
    } catch { toast.error('Arquivo invalido ou falha na importacao'); } finally { setBackupBusy(false); }
  };
  const saveSettings = useMutation({
    mutationFn: (patch) => { const payload = { ...patch, gemini_api_key_configured: !!patch.gemini_api_key }; return settings ? AppSettings.update(settings.id, payload) : AppSettings.create(payload); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['appsettings'] }); toast.success('Preferencias salvas'); },
  });

  const isAdmin = user?.role === 'admin';

  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const changePw = useMutation({
    mutationFn: () => Auth.changePassword(pw.current, pw.next),
    onSuccess: () => { toast.success('Senha alterada com sucesso'); setPw({ current: '', next: '', confirm: '' }); },
  });
  const submitPw = () => {
    if (pw.next.length < 8) return toast.error('A nova senha deve ter ao menos 8 caracteres');
    if (pw.next !== pw.confirm) return toast.error('As senhas não conferem');
    changePw.mutate();
  };

  // --- Verificacao em duas etapas (TOTP) ---
  const [twofa, setTwofa] = useState({ open: false, secret: '', otpauth: '', qr: '', code: '', busy: false });
  const resetTwofa = () => setTwofa({ open: false, secret: '', otpauth: '', qr: '', code: '', busy: false });
  const startSetup = async () => {
    setTwofa((t) => ({ ...t, busy: true }));
    try {
      const { secret, otpauth } = await Auth.setup2fa();
      let qr = ''; try { const QR = (await import('qrcode')).default; qr = await QR.toDataURL(otpauth, { margin: 1, width: 200 }); } catch {}
      setTwofa({ open: true, secret, otpauth, qr, code: '', busy: false });
    } catch (e) { toast.error(e.message || 'Falha ao iniciar 2FA'); setTwofa((t) => ({ ...t, busy: false })); }
  };
  const confirmEnable = async () => {
    if (twofa.code.length < 6) return toast.error('Digite o codigo de 6 digitos');
    setTwofa((t) => ({ ...t, busy: true }));
    try { await Auth.enable2fa(twofa.code); await refreshUser(); toast.success('Verificacao em duas etapas ativada'); resetTwofa(); }
    catch (e) { toast.error(e.message === '2FA_INVALID' ? 'Código invalido' : (e.message || 'Falha ao ativar')); setTwofa((t) => ({ ...t, busy: false })); }
  };
  const disableTwofa = async () => {
    const pass = window.prompt('Confirme sua senha para desativar a verificacao em duas etapas:');
    if (!pass) return;
    try { await Auth.disable2fa({ password: pass }); await refreshUser(); toast.success('Verificacao em duas etapas desativada'); }
    catch (e) { toast.error(e.message || 'Falha ao desativar'); }
  };

  const { data: mail } = useQuery({ queryKey: ['adminmail'], queryFn: () => Admin.getMail(), enabled: isAdmin });
  const [mailForm, setMailForm] = useState({ from: '', password: '', enabled: false, notifyNewUser: true, notifyPassword: true, notifyAlerts: true });
  const [testTo, setTestTo] = useState('');
  useEffect(() => { if (mail) setMailForm((f) => ({ ...f, from: mail.from || '', enabled: !!mail.enabled, notifyNewUser: !!mail.notifyNewUser, notifyPassword: !!mail.notifyPassword, notifyAlerts: !!mail.notifyAlerts, password: '' })); }, [mail]);
  const saveMail = useMutation({ mutationFn: () => Admin.saveMail(mailForm), onSuccess: () => { qc.invalidateQueries({ queryKey: ['adminmail'] }); toast.success('Configuração de e-mail salva'); setMailForm((f) => ({ ...f, password: '' })); } });
  const testMail = useMutation({ mutationFn: () => Admin.testMail(testTo || user?.email), onSuccess: (r) => toast.success(`E-mail de teste enviado para ${r.to || user?.email}${r.via ? ` (via ${r.via === 'smtp' ? 'provedor externo' : 'Gmail'})` : ''}`) });

  const onPhoto = async (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    try { const dataUrl = await resizeImage(file); setProfile((p) => ({ ...p, photo_url: dataUrl })); toast.info('Foto pronta — clique em Salvar perfil'); }
    catch { toast.error('Nao foi possível processar a imagem'); }
  };
  const setP = (k, v) => setProfile((p) => ({ ...p, [k]: v }));
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4 animate-fadeIn">
      <PageHeader title="Configurações" subtitle="Perfil, aparencia e integracoes" />

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Perfil editavel */}
        <Card className="hover-lift">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><User className="w-4 h-4 text-emerald-500" /> Perfil</h3>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative">
              {profile.photo_url
                ? <img src={profile.photo_url} alt="" className="w-20 h-20 rounded-2xl object-cover" />
                : <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-display font-bold text-3xl">{(profile.full_name || user?.email || '?').slice(0, 1).toUpperCase()}</div>}
              <button onClick={() => fileRef.current?.click()} className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg"><Camera className="w-4 h-4" /></button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhoto} />
            </div>
            <div>
              <p className="text-sm text-muted">{user?.email}</p>
              {user?.role === 'admin' && <Badge color="emerald" className="mt-1"><ShieldCheck className="w-3 h-3" /> Administrador</Badge>}
            </div>
          </div>
          <div className="space-y-3">
            <Field label="Nome completo"><Input value={profile.full_name} onChange={(e) => setP('full_name', e.target.value)} placeholder="Seu nome" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Telefone"><Input value={profile.phone} onChange={(e) => setP('phone', e.target.value)} placeholder="(11) 90000-0000" /></Field>
              <Field label="Profissao"><Input value={profile.profession} onChange={(e) => setP('profession', e.target.value)} placeholder="Ex: Cientista de Dados" /></Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="CEP" hint={cepBusy ? 'buscando...' : 'preenche o endereço'}><Input value={profile.cep} onChange={(e) => onCep(e.target.value)} placeholder="00000-000" inputMode="numeric" /></Field>
              <div className="col-span-2"><Field label="Endereço"><Input value={profile.address} onChange={(e) => setP('address', e.target.value)} placeholder="Rua, bairro, cidade/UF" /></Field></div>
            </div>
            <Button onClick={() => saveProfile.mutate(profile)} disabled={saveProfile.isPending} className="w-full">{saveProfile.isPending ? <Spinner className="w-4 h-4" /> : 'Salvar perfil'}</Button>
          </div>
        </Card>

        {/* Aparencia */}
        <Card className="hover-lift">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Palette className="w-4 h-4 text-violet-500" /> Aparencia</h3>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setTheme('light')} className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 ${theme !== 'dark' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' : 'border-[hsl(var(--border))]'}`}><Sun className="w-6 h-6" /><span className="text-sm font-medium">Claro</span>{theme !== 'dark' && <Check className="w-4 h-4 text-emerald-500" />}</button>
            <button onClick={() => setTheme('dark')} className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 ${theme === 'dark' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' : 'border-[hsl(var(--border))]'}`}><Moon className="w-6 h-6" /><span className="text-sm font-medium">Escuro</span>{theme === 'dark' && <Check className="w-4 h-4 text-emerald-500" />}</button>
          </div>

          <div className="mt-5">
            <p className="text-sm font-medium mb-1">Cor de destaque</p>
            <p className="text-xs text-muted mb-3">Aplica em botoes, graficos e destaques de todo o app.</p>
            <div className="flex flex-wrap gap-2.5">
              {ACCENTS.map((a) => (
                <button key={a.k} onClick={() => setAccent(a.k)} title={a.label} className={`relative w-10 h-10 rounded-full transition hover:scale-110 ${accent === a.k ? 'ring-2 ring-offset-2 ring-offset-[hsl(var(--card))]' : ''}`} style={{ background: a.hex, boxShadow: accent === a.k ? `0 0 0 2px ${a.hex}` : 'none' }}>
                  {accent === a.k && <Check className="w-5 h-5 text-white absolute inset-0 m-auto" strokeWidth={3} />}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted mt-3">Paleta atual: <b className="text-[hsl(var(--text))]">{ACCENTS.find((a) => a.k === accent)?.label || 'Esmeralda'}</b>. A escolha fica salva neste dispositivo.</p>
          </div>
        </Card>

        {/* Idioma */}
        <Card className="hover-lift">
          <h3 className="font-semibold mb-1 flex items-center gap-2"><Languages className="w-4 h-4 text-sky-500" /> {t('settings.language_title')}</h3>
          <p className="text-xs text-muted mb-4">{t('settings.language_desc')}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {langs.map((l) => (
              <button key={l.code} onClick={() => setLang(l.code)}
                className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition hover-lift ${lang === l.code ? 'border-sky-500 bg-sky-50 dark:bg-sky-500/10' : 'border-[hsl(var(--border))] hover:bg-black/5 dark:hover:bg-white/5'}`}>
                <span className="text-xl">{l.flag}</span>
                <span className="text-sm font-semibold flex-1 truncate">{l.label}</span>
                {lang === l.code && <Check className="w-4 h-4 text-sky-500 shrink-0" />}
              </button>
            ))}
          </div>
        </Card>

        {/* Backup & Dados */}
        <Card className="hover-lift">
          <h3 className="font-semibold mb-1 flex items-center gap-2"><Download className="w-4 h-4 text-sky-500" /> Backup & Dados</h3>
          <p className="text-xs text-muted mb-3">Exporte todos os seus dados (contas, lançamentos, cartões, metas, investimentos, dividas...) em um arquivo, ou importe de um backup.</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={exportData} disabled={backupBusy} className="flex-1">{backupBusy ? <Spinner className="w-4 h-4" /> : <><Download className="w-4 h-4" /> Exportar dados</>}</Button>
            <input ref={backupRef} type="file" accept="application/json" className="hidden" onChange={importData} />
            <Button variant="outline" onClick={() => backupRef.current?.click()} disabled={backupBusy} className="flex-1"><Upload className="w-4 h-4" /> Importar backup</Button>
          </div>
          <p className="text-[11px] text-muted mt-2">A importacao cria novos registros (não substitui). Ideal para portabilidade e para guardar uma copia dos seus dados.</p>
        </Card>

        {/* Preferencias */}
        <Card className="hover-lift">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Bell className="w-4 h-4 text-amber-500" /> Preferencias</h3>
          <div className="space-y-3">
            <Field label="Moeda"><Select value={form.currency} onChange={(e) => set('currency', e.target.value)}><option value="BRL">Real (R$)</option><option value="USD">Dolar (US$)</option><option value="EUR">Euro (€)</option></Select></Field>
            <Field label="Modo de visualizacao"><Select value={form.default_view_mode} onChange={(e) => set('default_view_mode', e.target.value)}><option value="cash">Caixa (só pagos)</option><option value="accrual">Competencia (todos)</option></Select></Field>
            <label className="flex items-center justify-between text-sm py-1"><span>Notificações</span><input type="checkbox" className="w-5 h-5 accent-emerald-500" checked={!!form.notifications_enabled} onChange={(e) => set('notifications_enabled', e.target.checked)} /></label>
            <label className="flex items-center justify-between text-sm py-1"><span>Categorizacao automática (IA)</span><input type="checkbox" className="w-5 h-5 accent-emerald-500" checked={!!form.auto_categorize} onChange={(e) => set('auto_categorize', e.target.checked)} /></label>
          </div>
        </Card>

      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Seguranca */}
        <Card className="hover-lift">
          <h3 className="font-semibold flex items-center gap-2 mb-4"><Lock className="w-4 h-4 text-rose-500" /> Seguranca</h3>
          <div className="space-y-3">
            <Field label="Senha atual"><Input type="password" value={pw.current} onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))} placeholder="********" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nova senha"><Input type="password" value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} placeholder="min. 8 caracteres" /></Field>
              <Field label="Confirmar"><Input type="password" value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} placeholder="********" /></Field>
            </div>
            <Button variant="outline" onClick={submitPw} disabled={changePw.isPending} className="w-full">{changePw.isPending ? <Spinner className="w-4 h-4" /> : 'Alterar senha'}</Button>
          </div>
        </Card>

        {/* Verificacao em duas etapas */}
        <Card className="hover-lift">
          <h3 className="font-semibold flex items-center gap-2 mb-1"><Smartphone className="w-4 h-4 text-indigo-500" /> Verificacao em duas etapas</h3>
          <p className="text-xs text-muted mb-3">Proteja sua conta com um app autenticador (Google Authenticator, Authy ou Microsoft Authenticator).</p>
          {user?.totp_enabled ? (
            <div className="space-y-3">
              <Badge color="emerald"><ShieldCheck className="w-3 h-3" /> Ativada</Badge>
              {user?.require_2fa && <p className="text-xs text-muted">O administrador definiu esta protecao como obrigatória para sua conta.</p>}
              <Button variant="outline" onClick={disableTwofa} disabled={user?.require_2fa} className="w-full">Desativar</Button>
            </div>
          ) : !twofa.open ? (
            <div className="space-y-2">
              {user?.require_2fa && <p className="text-xs text-amber-600 font-medium">Obrigatoria para sua conta — ative agora.</p>}
              <Button onClick={startSetup} disabled={twofa.busy} className="w-full">{twofa.busy ? <Spinner className="w-4 h-4" /> : 'Ativar verificacao em duas etapas'}</Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted">1. Escaneie o QR code no app autenticador (ou insira a chave manualmente).</p>
              {twofa.qr && <img src={twofa.qr} alt="QR 2FA" className="mx-auto rounded-lg border border-line" />}
              <div className="text-center"><code className="text-[11px] bg-black/5 dark:bg-white/10 px-2 py-1 rounded break-all">{twofa.secret}</code></div>
              <p className="text-xs text-muted">2. Digite o codigo gerado para confirmar.</p>
              <Input inputMode="numeric" maxLength={6} value={twofa.code} onChange={(e) => setTwofa((t) => ({ ...t, code: e.target.value.replace(/\D/g, '') }))} placeholder="000000" className="tracking-[0.4em] text-center text-lg" />
              <div className="flex gap-2">
                <Button variant="ghost" onClick={resetTwofa} className="flex-1">Cancelar</Button>
                <Button onClick={confirmEnable} disabled={twofa.busy} className="flex-1">{twofa.busy ? <Spinner className="w-4 h-4" /> : 'Confirmar'}</Button>
              </div>
            </div>
          )}
        </Card>

        {/* Leitura de faturas por IA (somente admin) */}
        {isAdmin && (
          <Card className="hover-lift">
            <h3 className="font-semibold flex items-center gap-2 mb-1"><Sparkles className="w-4 h-4 text-violet-500" /> Leitura de faturas (IA)</h3>
            <p className="text-xs text-muted mb-3">Chave da API do Google Gemini para ler e categorizar faturas de cartão em PDF automaticamente. A camada gratuita costuma bastar. Gere em <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-emerald-600 font-semibold inline-flex items-center gap-0.5">aistudio.google.com/apikey <ExternalLink className="w-3 h-3" /></a>.</p>
            <div className="space-y-3">
              <Field label="Chave da API Gemini" hint={settings?.gemini_api_key_configured ? 'Configurada — preencha só para alterar' : 'Sem chave, a leitura usa o método local'}>
                <div className="relative">
                  <Input type={showKey ? 'text' : 'password'} value={form.gemini_api_key} onChange={(e) => set('gemini_api_key', e.target.value)} placeholder="AIza..." className="pr-10" />
                  <button type="button" onClick={() => setShowKey((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted">{showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                </div>
              </Field>
              <Button variant="outline" onClick={() => saveSettings.mutate(form)} disabled={saveSettings.isPending} className="w-full">{saveSettings.isPending ? <Spinner className="w-4 h-4" /> : 'Salvar chave'}</Button>
            </div>
          </Card>
        )}

        {/* Envio de e-mail (somente admin) */}
        {isAdmin && (
          <Card className="hover-lift">
            <h3 className="font-semibold flex items-center gap-2 mb-1"><Mail className="w-4 h-4 text-emerald-500" /> Envio de E-mail</h3>
            <p className="text-xs text-muted mb-3">Use um provedor SMTP (Brevo/Resend/SES) pelas variáveis de ambiente, ou um Gmail + <b>senha de app</b> como alternativa.</p>
            <div className={`mb-3 flex items-start gap-2 p-3 rounded-xl text-sm ${mail?.smtp_env ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300'}`}>
              {mail?.smtp_env
                ? <><Send className="w-4 h-4 mt-0.5 shrink-0" /><span>Provedor externo (SMTP por variáveis de ambiente) <b>ativo</b>. Os e-mails saem por ele; o Gmail abaixo fica só como reserva.</span></>
                : <><Send className="w-4 h-4 mt-0.5 shrink-0" /><span>Usando <b>Gmail</b> (sem provedor externo). Para sair do limite diário do Gmail, configure <b>EMAIL_HOST/PORT/USER/PASS/FROM</b> na Vercel e faça redeploy.</span></>}
            </div>
            <div className="space-y-3">
              <Field label="E-mail remetente"><Input type="email" value={mailForm.from} onChange={(e) => setMailForm((f) => ({ ...f, from: e.target.value }))} placeholder="você@gmail.com" /></Field>
              <Field label="Senha de app do Gmail" hint={mail?.has_password ? 'Ja configurada — preencha só para alterar' : 'Gere em myaccount.google.com/apppasswords'}>
                <Input type="password" value={mailForm.password} onChange={(e) => setMailForm((f) => ({ ...f, password: e.target.value }))} placeholder={mail?.has_password ? '•••••••• (salva)' : 'xxxx xxxx xxxx xxxx'} />
              </Field>
              <label className="flex items-center justify-between text-sm"><span>Ativar envio de e-mails</span><input type="checkbox" className="w-5 h-5 accent-emerald-500" checked={mailForm.enabled} onChange={(e) => setMailForm((f) => ({ ...f, enabled: e.target.checked }))} /></label>
              <div className="border-t border-[hsl(var(--border))] pt-2 space-y-2">
                <p className="text-xs font-semibold text-muted">NOTIFICAR QUANDO:</p>
                <label className="flex items-center justify-between text-sm"><span>Novo usuário se cadastra</span><input type="checkbox" className="w-5 h-5 accent-emerald-500" checked={mailForm.notifyNewUser} onChange={(e) => setMailForm((f) => ({ ...f, notifyNewUser: e.target.checked }))} /></label>
                <label className="flex items-center justify-between text-sm"><span>Senha e alterada</span><input type="checkbox" className="w-5 h-5 accent-emerald-500" checked={mailForm.notifyPassword} onChange={(e) => setMailForm((f) => ({ ...f, notifyPassword: e.target.checked }))} /></label>
                <label className="flex items-center justify-between text-sm"><span>Alertas do aplicativo</span><input type="checkbox" className="w-5 h-5 accent-emerald-500" checked={mailForm.notifyAlerts} onChange={(e) => setMailForm((f) => ({ ...f, notifyAlerts: e.target.checked }))} /></label>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => saveMail.mutate()} disabled={saveMail.isPending} className="flex-1">{saveMail.isPending ? <Spinner className="w-4 h-4" /> : 'Salvar'}</Button>
                <Button variant="outline" onClick={() => testMail.mutate()} disabled={testMail.isPending}>{testMail.isPending ? <Spinner className="w-4 h-4" /> : <><Send className="w-4 h-4" /> Testar</>}</Button>
              </div>
              <Input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder={`Enviar teste para (padrão: ${user?.email})`} />
            </div>
          </Card>
        )}
      </div>

      <div className="flex justify-between items-center">
        <Button variant="danger" onClick={logout}>Sair da conta</Button>
        <Button onClick={() => saveSettings.mutate(form)} disabled={saveSettings.isPending}>{saveSettings.isPending ? <Spinner className="w-4 h-4" /> : 'Salvar preferencias'}</Button>
      </div>
    </div>
  );
}
