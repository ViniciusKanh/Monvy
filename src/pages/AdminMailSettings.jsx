import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Admin } from '../api/entities.js';
import { useAuth } from '../context/AuthContext.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Button, Input, Field, Spinner } from '../components/ui';
import { toast } from '../lib/toast.js';
import { Mail, Send, ShieldAlert } from 'lucide-react';

// Tela dedicada (somente admin) para gerenciar o envio de e-mails do Monvy.
// Antes isso dividia espaco com as preferencias pessoais em Configuracoes —
// agora e uma tela propria, mais facil de achar e sem misturar com o que
// cada usuario mexe por conta (idioma, chave Gemini, aparencia, moeda, 2FA).
export default function AdminMailSettings() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const { data: mail, isLoading } = useQuery({ queryKey: ['adminmail'], queryFn: () => Admin.getMail(), enabled: isAdmin });
  const [mailForm, setMailForm] = useState({ from: '', password: '', enabled: false, notifyNewUser: true, notifyPassword: true, smtp_host: '', smtp_port: '587', smtp_user: '', smtp_pass: '', smtp_from: '', smtp_from_name: 'Monvy' });
  const [testTo, setTestTo] = useState('');
  useEffect(() => { if (mail) setMailForm((f) => ({ ...f, from: mail.from || '', enabled: !!mail.enabled, notifyNewUser: !!mail.notifyNewUser, notifyPassword: !!mail.notifyPassword, password: '', smtp_host: mail.smtp_host || '', smtp_port: String(mail.smtp_port || 587), smtp_user: mail.smtp_user || '', smtp_pass: '', smtp_from: mail.smtp_from || '', smtp_from_name: mail.smtp_from_name || 'Monvy' })); }, [mail]);
  const saveMail = useMutation({ mutationFn: () => Admin.saveMail(mailForm), onSuccess: () => { qc.invalidateQueries({ queryKey: ['adminmail'] }); toast.success('Configuração de e-mail salva'); setMailForm((f) => ({ ...f, password: '' })); } });
  const testMail = useMutation({ mutationFn: () => Admin.testMail(testTo || user?.email), onSuccess: (r) => toast.success(`E-mail de teste enviado para ${r.to || user?.email}${r.via ? ` (via ${r.via === 'gmail' ? 'Gmail' : 'provedor externo'})` : ''}`) });

  if (!isAdmin) {
    return (
      <div className="animate-fadeIn">
        <PageHeader title="Envio de E-mail" subtitle="Somente administradores" />
        <Card className="flex items-start gap-3 text-sm">
          <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <p>Você não tem permissão para acessar esta tela. Fale com o administrador.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn space-y-4">
      <PageHeader title="Envio de E-mail" subtitle="Configuração de SMTP e notificações automáticas do Monvy" />

      {isLoading ? <div className="flex justify-center py-10"><Spinner className="w-6 h-6 text-emerald-500" /></div> : (
        <Card className="hover-lift">
          <h3 className="font-semibold flex items-center gap-2 mb-1"><Mail className="w-4 h-4 text-emerald-500" /> Envio de E-mail</h3>
          <p className="text-xs text-muted mb-3">Configure um provedor SMTP (Brevo/Resend/SES) aqui mesmo, ou use um Gmail + <b>senha de app</b> como reserva.</p>
          {(() => {
            const ap = mail?.active_provider;
            const ok = ap === 'smtp_painel' || ap === 'smtp_env';
            const label = ap === 'smtp_painel' ? 'Provedor SMTP do painel ativo' : ap === 'smtp_env' ? 'Provedor SMTP (variáveis de ambiente) ativo' : ap === 'gmail' ? 'Usando Gmail (reserva)' : 'Nenhum envio configurado';
            return (
              <div className={`mb-4 flex items-start gap-2 p-3 rounded-xl text-sm ${ok ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300'}`}>
                <Send className="w-4 h-4 mt-0.5 shrink-0" />
                <span><b>{label}.</b> {ok ? 'É por ele que os e-mails saem; os outros ficam como reserva automática.' : 'Preencha o SMTP externo abaixo (recomendado) para sair do limite do Gmail.'}</span>
              </div>
            );
          })()}

          {/* Provedor SMTP externo (recomendado) */}
          <div className="rounded-xl border border-[hsl(var(--border))] p-3 mb-4">
            <p className="text-sm font-semibold mb-2">Provedor SMTP externo <span className="text-xs font-normal text-emerald-600">(recomendado)</span></p>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Servidor (host)"><Input value={mailForm.smtp_host} onChange={(e) => setMailForm((f) => ({ ...f, smtp_host: e.target.value }))} placeholder="smtp-relay.brevo.com" /></Field>
              <Field label="Porta"><Input value={mailForm.smtp_port} onChange={(e) => setMailForm((f) => ({ ...f, smtp_port: e.target.value }))} placeholder="587" /></Field>
              <Field label="Usuário (login SMTP)"><Input value={mailForm.smtp_user} onChange={(e) => setMailForm((f) => ({ ...f, smtp_user: e.target.value }))} placeholder="b7f22d001@smtp-brevo.com" /></Field>
              <Field label="Chave/Senha SMTP" hint={mail?.has_smtp_pass ? 'Já configurada — preencha só para alterar' : 'Cole a SMTP key do provedor'}><Input type="password" value={mailForm.smtp_pass} onChange={(e) => setMailForm((f) => ({ ...f, smtp_pass: e.target.value }))} placeholder={mail?.has_smtp_pass ? '•••••••• (salva)' : '••••••••'} /></Field>
              <Field label="Remetente (from)" hint="Precisa ser verificado no provedor"><Input type="email" value={mailForm.smtp_from} onChange={(e) => setMailForm((f) => ({ ...f, smtp_from: e.target.value }))} placeholder="viniciussouza742@gmail.com" /></Field>
              <Field label="Nome do remetente"><Input value={mailForm.smtp_from_name} onChange={(e) => setMailForm((f) => ({ ...f, smtp_from_name: e.target.value }))} placeholder="Monvy" /></Field>
            </div>
            <p className="text-[11px] text-muted mt-2">Ex.: Brevo → host <b>smtp-relay.brevo.com</b>, porta <b>587</b>, usuário e chave em SMTP &amp; API. Salve e clique em Testar.</p>
          </div>

          <p className="text-xs font-semibold text-muted mb-2">RESERVA (Gmail + senha de app)</p>
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
  );
}
