import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppSettings, Auth, Admin } from '../api/entities.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Button, Input, Select, Field, Spinner, Badge } from '../components/ui';
import { toast } from '../lib/toast.js';
import { Sun, Moon, ShieldCheck, KeyRound, Bell, Palette, User, Sparkles, ExternalLink, Eye, EyeOff, Check, Camera, Lock, Mail, Send } from 'lucide-react';

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
  const { user, logout, updateProfile } = useAuth();
  const { theme, setTheme } = useTheme();
  const { data: list = [], isLoading } = useQuery({ queryKey: ['appsettings'], queryFn: () => AppSettings.list() });
  const settings = list[0];
  const fileRef = useRef(null);

  const [profile, setProfile] = useState({ full_name: '', phone: '', profession: '', photo_url: '' });
  const [form, setForm] = useState({ currency: 'BRL', default_view_mode: 'cash', notifications_enabled: true, auto_categorize: true, gemini_api_key: '' });
  const [showKey, setShowKey] = useState(false);

  useEffect(() => { if (user) setProfile({ full_name: user.full_name || '', phone: user.phone || '', profession: user.profession || '', photo_url: user.photo_url || '' }); }, [user]);
  useEffect(() => { if (settings) setForm((f) => ({ ...f, ...settings, gemini_api_key: settings.gemini_api_key || '' })); }, [settings]);

  const saveProfile = useMutation({ mutationFn: (p) => updateProfile(p), onSuccess: () => toast.success('Perfil atualizado') });
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
    if (pw.next !== pw.confirm) return toast.error('As senhas nao conferem');
    changePw.mutate();
  };

  const { data: mail } = useQuery({ queryKey: ['adminmail'], queryFn: () => Admin.getMail(), enabled: isAdmin });
  const [mailForm, setMailForm] = useState({ from: '', password: '', enabled: false, notifyNewUser: true, notifyPassword: true, notifyAlerts: true });
  const [testTo, setTestTo] = useState('');
  useEffect(() => { if (mail) setMailForm((f) => ({ ...f, from: mail.from || '', enabled: !!mail.enabled, notifyNewUser: !!mail.notifyNewUser, notifyPassword: !!mail.notifyPassword, notifyAlerts: !!mail.notifyAlerts, password: '' })); }, [mail]);
  const saveMail = useMutation({ mutationFn: () => Admin.saveMail(mailForm), onSuccess: () => { qc.invalidateQueries({ queryKey: ['adminmail'] }); toast.success('Configuracao de e-mail salva'); setMailForm((f) => ({ ...f, password: '' })); } });
  const testMail = useMutation({ mutationFn: () => Admin.testMail(testTo || user?.email), onSuccess: (r) => toast.success('E-mail de teste enviado para ' + (r.to || user?.email)) });

  const onPhoto = async (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    try { const dataUrl = await resizeImage(file); setProfile((p) => ({ ...p, photo_url: dataUrl })); toast.info('Foto pronta — clique em Salvar perfil'); }
    catch { toast.error('Nao foi possivel processar a imagem'); }
  };
  const setP = (k, v) => setProfile((p) => ({ ...p, [k]: v }));
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4 animate-fadeIn">
      <PageHeader title="Configuracoes" subtitle="Perfil, aparencia e integracoes" />

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
        </Card>

        {/* Preferencias */}
        <Card className="hover-lift">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Bell className="w-4 h-4 text-amber-500" /> Preferencias</h3>
          <div className="space-y-3">
            <Field label="Moeda"><Select value={form.currency} onChange={(e) => set('currency', e.target.value)}><option value="BRL">Real (R$)</option><option value="USD">Dolar (US$)</option><option value="EUR">Euro (€)</option></Select></Field>
            <Field label="Modo de visualizacao"><Select value={form.default_view_mode} onChange={(e) => set('default_view_mode', e.target.value)}><option value="cash">Caixa (so pagos)</option><option value="accrual">Competencia (todos)</option></Select></Field>
            <label className="flex items-center justify-between text-sm py-1"><span>Notificacoes</span><input type="checkbox" className="w-5 h-5 accent-emerald-500" checked={!!form.notifications_enabled} onChange={(e) => set('notifications_enabled', e.target.checked)} /></label>
            <label className="flex items-center justify-between text-sm py-1"><span>Categorizacao automatica (IA)</span><input type="checkbox" className="w-5 h-5 accent-emerald-500" checked={!!form.auto_categorize} onChange={(e) => set('auto_categorize', e.target.checked)} /></label>
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

        {/* Envio de e-mail (somente admin) */}
        {isAdmin && (
          <Card className="hover-lift">
            <h3 className="font-semibold flex items-center gap-2 mb-1"><Mail className="w-4 h-4 text-emerald-500" /> Envio de E-mail (Gmail)</h3>
            <p className="text-xs text-muted mb-3">Use um Gmail + <b>senha de app</b> para o Monvy enviar e-mails (cadastro, troca de senha, alertas).</p>
            <div className="space-y-3">
              <Field label="E-mail remetente"><Input type="email" value={mailForm.from} onChange={(e) => setMailForm((f) => ({ ...f, from: e.target.value }))} placeholder="voce@gmail.com" /></Field>
              <Field label="Senha de app do Gmail" hint={mail?.has_password ? 'Ja configurada — preencha so para alterar' : 'Gere em myaccount.google.com/apppasswords'}>
                <Input type="password" value={mailForm.password} onChange={(e) => setMailForm((f) => ({ ...f, password: e.target.value }))} placeholder={mail?.has_password ? '•••••••• (salva)' : 'xxxx xxxx xxxx xxxx'} />
              </Field>
              <label className="flex items-center justify-between text-sm"><span>Ativar envio de e-mails</span><input type="checkbox" className="w-5 h-5 accent-emerald-500" checked={mailForm.enabled} onChange={(e) => setMailForm((f) => ({ ...f, enabled: e.target.checked }))} /></label>
              <div className="border-t border-[hsl(var(--border))] pt-2 space-y-2">
                <p className="text-xs font-semibold text-muted">NOTIFICAR QUANDO:</p>
                <label className="flex items-center justify-between text-sm"><span>Novo usuario se cadastra</span><input type="checkbox" className="w-5 h-5 accent-emerald-500" checked={mailForm.notifyNewUser} onChange={(e) => setMailForm((f) => ({ ...f, notifyNewUser: e.target.checked }))} /></label>
                <label className="flex items-center justify-between text-sm"><span>Senha e alterada</span><input type="checkbox" className="w-5 h-5 accent-emerald-500" checked={mailForm.notifyPassword} onChange={(e) => setMailForm((f) => ({ ...f, notifyPassword: e.target.checked }))} /></label>
                <label className="flex items-center justify-between text-sm"><span>Alertas do aplicativo</span><input type="checkbox" className="w-5 h-5 accent-emerald-500" checked={mailForm.notifyAlerts} onChange={(e) => setMailForm((f) => ({ ...f, notifyAlerts: e.target.checked }))} /></label>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => saveMail.mutate()} disabled={saveMail.isPending} className="flex-1">{saveMail.isPending ? <Spinner className="w-4 h-4" /> : 'Salvar'}</Button>
                <Button variant="outline" onClick={() => testMail.mutate()} disabled={testMail.isPending}>{testMail.isPending ? <Spinner className="w-4 h-4" /> : <><Send className="w-4 h-4" /> Testar</>}</Button>
              </div>
              <Input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder={`Enviar teste para (padrao: ${user?.email})`} />
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
