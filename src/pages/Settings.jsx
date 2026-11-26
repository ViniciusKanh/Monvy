import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AppSettings, Auth, Account, Category, Transaction, CreditCard, CreditCardTransaction, Goal, Subscription, Investment, Debt } from '../api/entities.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme, ACCENTS } from '../context/ThemeContext.jsx';
import { useLang } from '../context/LangContext.jsx';
import { HeroTitle, Panel, GlowButton } from '../components/kit.jsx';
import { GearArt } from '../components/art/PageArt.jsx';
import { Flag } from '../components/Flags.jsx';
import { Card, Button, Input, Select, Field, Spinner, Badge } from '../components/ui';
import { toast } from '../lib/toast.js';
import { Sun, Moon, ShieldCheck, KeyRound, Bell, Palette, User, Sparkles, ExternalLink, Eye, EyeOff, Check, Camera, Lock, Mail, Smartphone, Download, Upload, Languages, Settings as SettingsIcon, Phone, Briefcase, MapPin, Home, Contact, Save, Paintbrush, Rocket, LogOut, ChevronRight, Plug, Wallet, Tags, Database, Info } from 'lucide-react';

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

function Toggle({ on, onChange, disabled, label }) { return <button type="button" role="switch" aria-checked={!!on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)} className={`relative w-11 h-6 rounded-full transition shrink-0 disabled:opacity-50 ${on ? 'bg-gradient-to-r from-cyan-400 to-emerald-400 shadow-[0_0_12px_rgba(45,212,191,.5)]' : 'bg-black/15 dark:bg-white/15'}`}><span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} /></button>; }
function Row({ icon: Ic, title, desc, children, onClick }) { return <div onClick={onClick} className={`rounded-xl ring-1 ring-[hsl(var(--border))] px-3 py-2.5 flex items-center gap-3 ${onClick ? 'cursor-pointer hover:bg-black/[.03] dark:hover:bg-white/[.03]' : ''}`}><Ic className="w-5 h-5 text-sky-400 shrink-0" /><div className="flex-1 min-w-0"><p className="text-sm font-semibold leading-tight">{title}</p>{desc && <p className="text-[11px] text-muted leading-tight">{desc}</p>}</div>{children}</div>; }

export default function Settings() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user, logout, updateProfile, refreshUser } = useAuth();
  const { theme, setTheme, accent, setAccent } = useTheme();
  const { lang, setLang, langs, t } = useLang();
  const { data: list = [], isLoading } = useQuery({ queryKey: ['appsettings'], queryFn: () => AppSettings.list() });
  const settings = list[0];
  const fileRef = useRef(null);

  const [profile, setProfile] = useState({ full_name: '', phone: '', profession: '', photo_url: '', cep: '', address: '', cpf: '' });
  const [cepBusy, setCepBusy] = useState(false);
  const [form, setForm] = useState({ currency: 'BRL', default_view_mode: 'cash', notifications_enabled: true, auto_categorize: true, gemini_api_key: '' });
  const [showKey, setShowKey] = useState(false);

  // CPF nunca e pre-preenchido com o valor real — so o mascarado aparece como dica.
  useEffect(() => { if (user) setProfile({ full_name: user.full_name || '', phone: user.phone || '', profession: user.profession || '', photo_url: user.photo_url || '', cep: user.cep || '', address: user.address || '', cpf: '' }); }, [user]);

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


  const onPhoto = async (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    try { const dataUrl = await resizeImage(file); setProfile((p) => ({ ...p, photo_url: dataUrl })); toast.info('Foto pronta — clique em Salvar perfil'); }
    catch { toast.error('Nao foi possível processar a imagem'); }
  };
  const setP = (k, v) => setProfile((p) => ({ ...p, [k]: v }));
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const [secOpen, setSecOpen] = useState(null); // 'pw' | '2fa' | null
  const [gemOpen, setGemOpen] = useState(false);
  const accHex = ACCENTS.find((a) => a.k === accent)?.hex || '#10b981';
  const LANG_FLAG = { pt: 'BRL', en: 'USD', es: 'ES', fr: 'FR', de: 'DE' };
  const lbl = (Ic, t) => <span className="text-sm font-semibold flex items-center gap-1.5 mb-1"><Ic className="w-4 h-4 text-muted" />{t}</span>;

  return (
    <div className="space-y-5 animate-fadeIn">
      <HeroTitle icon={SettingsIcon} lead="" accent="Configurações" iconClass="text-sky-400" subtitle="Perfil, aparência, segurança e integrações." art={<GearArt className="w-[26rem] h-40 opacity-95" />} />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <Panel className="xl:col-span-7" tone="sky" title="Perfil" subtitle="Gerencie suas informações pessoais e profissionais." icon={User} iconClass="text-sky-400">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative">
              {profile.photo_url ? <img src={profile.photo_url} alt="" className="w-24 h-24 rounded-2xl object-cover ring-2 ring-sky-400/60 shadow-[0_0_20px_-4px_rgba(56,189,248,.6)]" />
                : <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-sky-500 to-violet-600 grid place-items-center text-white font-display font-bold text-4xl ring-2 ring-sky-400/60">{(profile.full_name || user?.email || '?').slice(0, 1).toUpperCase()}</div>}
              <button onClick={() => fileRef.current?.click()} className="absolute -bottom-2 -right-2 w-9 h-9 rounded-full bg-sky-500 text-white grid place-items-center shadow-lg ring-2 ring-[hsl(var(--card))]" aria-label="Trocar foto"><Camera className="w-4 h-4" /></button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhoto} />
            </div>
            <div className="min-w-0">
              <p className="text-sm flex items-center gap-2 truncate"><Mail className="w-4 h-4 text-muted shrink-0" />{user?.email}</p>
              {isAdmin && <span className="inline-flex items-center gap-1 mt-2 text-xs font-semibold px-2.5 py-1 rounded-full ring-1 ring-sky-400/50 bg-sky-500/10 text-sky-600 dark:text-sky-300"><ShieldCheck className="w-3.5 h-3.5" />Administrador</span>}
            </div>
          </div>
          <div className="space-y-3">
            <div>{lbl(User, 'Nome completo')}<Input value={profile.full_name} onChange={(e) => setP('full_name', e.target.value)} placeholder="Seu nome" /></div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>{lbl(Phone, 'Telefone')}<Input value={profile.phone} onChange={(e) => setP('phone', e.target.value)} placeholder="(11) 90000-0000" /></div>
              <div>{lbl(Briefcase, 'Profissão')}<Input list="profissoes" value={profile.profession} onChange={(e) => setP('profession', e.target.value)} placeholder="Ex.: Analista de Dados" /><datalist id="profissoes">{['Analista de Dados', 'Cientista de Dados', 'Desenvolvedor(a)', 'Engenheiro(a)', 'Professor(a)', 'Estudante', 'Autônomo(a)', 'Empresário(a)', 'Servidor(a) público(a)'].map((x) => <option key={x} value={x} />)}</datalist></div>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <div>{lbl(MapPin, 'CEP')}<Input value={profile.cep} onChange={(e) => onCep(e.target.value)} placeholder="00000-000" inputMode="numeric" /><p className="text-[11px] text-muted mt-0.5">{cepBusy ? 'buscando…' : 'preenche o endereço'}</p></div>
              <div className="sm:col-span-2">{lbl(Home, 'Endereço')}<Input value={profile.address} onChange={(e) => setP('address', e.target.value)} placeholder="Rua, bairro, cidade/UF" /></div>
            </div>
            <div>{lbl(Contact, 'CPF')}<Input value={profile.cpf} onChange={(e) => setP('cpf', e.target.value.replace(/[^\d.\-\s]/g, ''))} placeholder={user?.cpf_set ? user.cpf_masked : '000.000.000-00'} inputMode="numeric" /><p className="text-[11px] text-muted mt-0.5">{user?.cpf_set ? `cadastrado: ${user.cpf_masked} — preencha só para alterar` : 'usado só como identificador — nunca exibido por inteiro'}</p></div>
            <GlowButton tone="aurora" onClick={() => { const p = { ...profile }; if (!String(p.cpf || '').replace(/\D/g, '')) delete p.cpf; saveProfile.mutate(p); }} disabled={saveProfile.isPending} className="w-full justify-center py-2.5">{saveProfile.isPending ? <Spinner className="w-4 h-4" /> : <><Save className="w-4 h-4" />Salvar perfil</>}</GlowButton>
          </div>
        </Panel>

        <div className="xl:col-span-5 space-y-5">
        <Panel tone="violet" title="Aparência" subtitle="Personalize o visual do Monvy do seu jeito." icon={Palette} iconClass="text-violet-400">
          <div className="grid grid-cols-2 gap-3">
            {[['light', 'Claro', Sun, 'bg-slate-100', 'bg-white', '#cbd5e1'], ['dark', 'Escuro', Moon, 'bg-slate-900', 'bg-slate-800', '#334155']].map(([k, l, Ic, bg, card, line]) => { const on = k === 'dark' ? theme === 'dark' : theme !== 'dark'; return (
              <button key={k} onClick={() => setTheme(k)} aria-pressed={on} className={`rounded-2xl ring-1 p-3 text-left transition ${on ? 'ring-2 ring-sky-400 shadow-[0_0_22px_-6px_rgba(56,189,248,.7)]' : 'ring-[hsl(var(--border))]'}`}>
                <span className="flex items-center justify-between font-semibold"><span className="flex items-center gap-2"><Ic className="w-5 h-5" />{l}</span>{on ? <span className="w-5 h-5 rounded-full bg-sky-500 grid place-items-center"><Check className="w-3.5 h-3.5 text-white" /></span> : <span className="w-5 h-5 rounded-full ring-2 ring-[hsl(var(--border))]" />}</span>
                <span className={`mt-3 block h-20 rounded-xl ${bg} p-2 grid grid-cols-[18px_1fr] gap-2`}><span className="space-y-1">{[0, 1, 2, 3].map((x) => <i key={x} className="block h-1.5 rounded" style={{ background: line }} />)}</span><span className={`rounded-lg ${card} p-1.5 flex items-end gap-1`}>{[40, 70, 55, 90].map((h, x) => <i key={x} className="flex-1 rounded-sm" style={{ height: `${h}%`, background: accHex, opacity: 0.85 }} />)}</span></span>
              </button>); })}
          </div>
          <div className="mt-5 grid sm:grid-cols-[1fr_auto] gap-4 items-start">
            <div>
              <p className="font-semibold flex items-center gap-2"><Paintbrush className="w-4 h-4 text-sky-400" />Cor de destaque</p>
              <p className="text-xs text-muted mb-3">Aplica em botões, gráficos e destaques de todo o app.</p>
              <div className="flex flex-wrap gap-2.5">{ACCENTS.map((a) => <button key={a.k} onClick={() => setAccent(a.k)} title={a.label} aria-label={a.label} aria-pressed={accent === a.k} className="relative w-9 h-9 rounded-full transition hover:scale-110" style={{ background: a.hex, boxShadow: accent === a.k ? `0 0 0 3px hsl(var(--card)), 0 0 0 5px ${a.hex}, 0 0 16px ${a.hex}` : 'none' }}>{accent === a.k && <Check className="w-5 h-5 text-white absolute inset-0 m-auto" strokeWidth={3} />}</button>)}</div>
              <p className="text-[11px] text-muted mt-2">Atual: <b>{ACCENTS.find((a) => a.k === accent)?.label || 'Esmeralda'}</b> · salva neste dispositivo.</p>
            </div>
            <div className="rounded-2xl ring-1 ring-[hsl(var(--border))] p-3">
              <p className="text-sm font-semibold flex items-center gap-1.5 mb-2"><Eye className="w-4 h-4 text-sky-400" />Prévia</p>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1.5 rounded-lg text-white text-xs font-semibold flex items-center gap-1" style={{ background: accHex, boxShadow: `0 0 12px ${accHex}88` }}><Rocket className="w-3.5 h-3.5" />Botão</span>
                <span className="flex items-end gap-0.5 h-9 px-2 rounded-lg ring-1 ring-[hsl(var(--border))] py-1.5">{[50, 80, 60, 100].map((h, x) => <i key={x} className="w-1.5 rounded-sm" style={{ height: `${h}%`, background: accHex }} />)}</span>
                <svg width="52" height="36" className="rounded-lg ring-1 ring-[hsl(var(--border))]" aria-hidden><path d="M4 28 C14 10 22 30 30 18 S44 6 48 10" stroke={accHex} strokeWidth="2.5" fill="none" /></svg>
              </div>
            </div>
          </div>
        </Panel>
        <Panel tone="sky" title={t('settings.language_title', 'Idioma do sistema')} subtitle={t('settings.language_desc', 'Escolha o idioma da interface.')} icon={Languages} iconClass="text-sky-400">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3 gap-2">
            {langs.map((l) => { const on = lang === l.code; return (
              <button key={l.code} onClick={() => setLang(l.code)} aria-pressed={on} className={`flex items-center gap-2.5 p-3 rounded-xl ring-1 text-left transition ${on ? 'ring-2 ring-emerald-400 bg-emerald-500/10 shadow-[0_0_16px_-4px_rgba(52,211,153,.6)]' : 'ring-[hsl(var(--border))] hover:bg-black/5 dark:hover:bg-white/5'}`}>
                <Flag code={LANG_FLAG[l.code] || l.code.toUpperCase()} size={26} />
                <span className="text-sm font-semibold flex-1 truncate">{l.label}</span>
                {on && <Check className="w-4 h-4 text-emerald-500 shrink-0" />}
              </button>); })}
          </div>
        </Panel>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Panel tone="sky" title="Segurança & Privacidade" subtitle="Proteja sua conta e controle o acesso." icon={ShieldCheck} iconClass="text-sky-400">
          <div className="space-y-2">
            <Row icon={Lock} title="Verificação em duas etapas (2FA)" desc={user?.totp_enabled ? (user?.require_2fa ? 'Ativada · obrigatória pelo administrador' : 'Ativada com app autenticador') : 'Camada extra com app autenticador'}>
              <Toggle label="2FA" on={!!user?.totp_enabled || secOpen === '2fa'} disabled={(user?.totp_enabled && user?.require_2fa) || twofa.busy} onChange={(v) => { if (user?.totp_enabled) { if (!v) disableTwofa(); } else if (v) { setSecOpen('2fa'); startSetup(); } else { setSecOpen(null); resetTwofa(); } }} />
            </Row>
            {!user?.totp_enabled && twofa.open && (
              <div className="rounded-xl ring-1 ring-sky-400/40 p-3 space-y-2 text-xs">
                <p className="text-muted">1. Escaneie o QR code no app autenticador (Google Authenticator, Authy ou Microsoft Authenticator) ou use a chave.</p>
                {twofa.qr && <img src={twofa.qr} alt="QR 2FA" className="mx-auto rounded-lg bg-white p-1" />}
                <div className="text-center"><code className="text-[11px] bg-black/5 dark:bg-white/10 px-2 py-1 rounded break-all">{twofa.secret}</code></div>
                <p className="text-muted">2. Digite o código gerado para confirmar.</p>
                <Input inputMode="numeric" maxLength={6} value={twofa.code} onChange={(e) => setTwofa((x) => ({ ...x, code: e.target.value.replace(/\D/g, '') }))} placeholder="000000" className="tracking-[0.4em] text-center text-lg" />
                <div className="flex gap-2"><Button variant="ghost" onClick={() => { resetTwofa(); setSecOpen(null); }} className="flex-1">Cancelar</Button><Button onClick={confirmEnable} disabled={twofa.busy} className="flex-1">{twofa.busy ? <Spinner className="w-4 h-4" /> : 'Confirmar'}</Button></div>
              </div>
            )}
            <Row icon={KeyRound} title="Senha" desc="Troque sua senha de acesso" onClick={() => setSecOpen(secOpen === 'pw' ? null : 'pw')}><ChevronRight className={`w-4 h-4 text-muted transition ${secOpen === 'pw' ? 'rotate-90' : ''}`} /></Row>
            {secOpen === 'pw' && (
              <div className="rounded-xl ring-1 ring-sky-400/40 p-3 space-y-2">
                <Input type="password" value={pw.current} onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))} placeholder="Senha atual" autoComplete="current-password" />
                <div className="grid grid-cols-2 gap-2"><Input type="password" value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} placeholder="Nova (mín. 8)" autoComplete="new-password" /><Input type="password" value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} placeholder="Confirmar" autoComplete="new-password" /></div>
                <Button variant="outline" onClick={submitPw} disabled={changePw.isPending} className="w-full">{changePw.isPending ? <Spinner className="w-4 h-4" /> : 'Alterar senha'}</Button>
              </div>
            )}
            <Row icon={LogOut} title="Sair da conta" desc="Encerra a sessão neste dispositivo" onClick={logout}><ChevronRight className="w-4 h-4 text-muted" /></Row>
          </div>
        </Panel>

        <Panel tone="violet" title="Notificações & preferências" subtitle="Alertas e como o Monvy mostra seus números." icon={Bell} iconClass="text-violet-400">
          <div className="space-y-2">
            <Row icon={Bell} title="Alertas e notificações" desc="Vencimentos, orçamento, câmbio e resumos"><Toggle label="Notificações" on={!!form.notifications_enabled} onChange={(v) => { const f = { ...form, notifications_enabled: v }; setForm(f); saveSettings.mutate(f); }} /></Row>
            <Row icon={Tags} title="Categorização automática" desc="Sugere a categoria dos lançamentos"><Toggle label="Categorização automática" on={!!form.auto_categorize} onChange={(v) => { const f = { ...form, auto_categorize: v }; setForm(f); saveSettings.mutate(f); }} /></Row>
            <Row icon={Wallet} title="Moeda"><Select value={form.currency} onChange={(e) => { const f = { ...form, currency: e.target.value }; setForm(f); saveSettings.mutate(f); }} className="w-auto text-xs py-1"><option value="BRL">Real (R$)</option><option value="USD">Dólar (US$)</option><option value="EUR">Euro (€)</option></Select></Row>
            <Row icon={Eye} title="Visualização" desc="Caixa = só pagos · Competência = todos"><Select value={form.default_view_mode} onChange={(e) => { const f = { ...form, default_view_mode: e.target.value }; setForm(f); saveSettings.mutate(f); }} className="w-auto text-xs py-1"><option value="cash">Caixa</option><option value="accrual">Competência</option></Select></Row>
          </div>
          <p className="text-[11px] text-muted mt-2">As alterações são salvas na hora.</p>
        </Panel>

        <Panel tone="emerald" title="Integrações" subtitle="Conecte o Monvy a outros serviços." icon={Plug} iconClass="text-emerald-400">
          <div className="space-y-2">
            <Row icon={Sparkles} title="Google Gemini (IA)" desc="Leitura de faturas, notas e análises">
              {settings?.gemini_api_key_configured ? <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full ring-1 ring-emerald-400/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 flex items-center gap-1"><Check className="w-3 h-3" />Conectado</span> : null}
              <button onClick={() => setGemOpen((v) => !v)} className="text-xs font-semibold px-2.5 py-1 rounded-lg ring-1 ring-[hsl(var(--border))]">{settings?.gemini_api_key_configured ? 'Alterar' : 'Conectar'}</button>
            </Row>
            {gemOpen && (
              <div className="rounded-xl ring-1 ring-emerald-400/40 p-3 space-y-2 text-xs">
                <p className="text-muted">A chave é <b>pessoal</b>: fica guardada criptografada na sua conta e só você a usa. Gere a sua grátis em <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-emerald-600 dark:text-emerald-300 font-semibold inline-flex items-center gap-0.5">aistudio.google.com/apikey <ExternalLink className="w-3 h-3" /></a>. Sem chave, a leitura de PDF usa um método local mais limitado.</p>
                <div className="relative"><Input type={showKey ? 'text' : 'password'} value={form.gemini_api_key} onChange={(e) => set('gemini_api_key', e.target.value)} placeholder={settings?.gemini_api_key_configured ? 'Configurada — preencha só para alterar' : 'AIza...'} className="pr-10" /><button type="button" onClick={() => setShowKey((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted" aria-label="Mostrar chave">{showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div>
                <Button variant="outline" onClick={() => saveSettings.mutate(form)} disabled={saveSettings.isPending} className="w-full">{saveSettings.isPending ? <Spinner className="w-4 h-4" /> : 'Salvar chave'}</Button>
              </div>
            )}
            {isAdmin && <Row icon={Mail} title="Envio de e-mail (SMTP)" desc="Notificações e chamados por e-mail" onClick={() => navigate('/configuracoes/email')}><span className="text-xs font-semibold px-2.5 py-1 rounded-lg ring-1 ring-[hsl(var(--border))] flex items-center gap-1">Gerenciar<ChevronRight className="w-3.5 h-3.5" /></span></Row>}
            <Row icon={Database} title="Bancos e cartões" desc="Contas, extratos e faturas" onClick={() => navigate('/contas')}><span className="text-xs font-semibold px-2.5 py-1 rounded-lg ring-1 ring-[hsl(var(--border))] flex items-center gap-1">Abrir<ChevronRight className="w-3.5 h-3.5" /></span></Row>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-5">
        <Panel tone="violet" title="Backup & Dados" subtitle="Exporte todos os seus dados (contas, lançamentos, cartões, metas, investimentos, dívidas...) em um arquivo, ou importe de um backup." icon={Download} iconClass="text-sky-400">
          <div className="flex flex-col sm:flex-row gap-2">
            <GlowButton tone="sky" onClick={exportData} disabled={backupBusy} className="flex-1 justify-center py-2.5">{backupBusy ? <Spinner className="w-4 h-4" /> : <><Upload className="w-4 h-4" />Exportar dados</>}</GlowButton>
            <input ref={backupRef} type="file" accept="application/json" className="hidden" onChange={importData} />
            <button onClick={() => backupRef.current?.click()} disabled={backupBusy} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold ring-1 ring-[hsl(var(--border))] hover:bg-black/5 dark:hover:bg-white/10"><Download className="w-4 h-4" />Importar backup</button>
          </div>
          <p className="text-[11px] text-muted mt-2 flex items-start gap-1.5"><Info className="w-3.5 h-3.5 shrink-0" />A importação cria novos registros (não substitui). O arquivo .json fica com você — ideal para portabilidade e cópia de segurança.</p>
        </Panel>
      </div>
    </div>
  );
}
