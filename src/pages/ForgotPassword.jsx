import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Auth } from '../api/entities.js';
import { Logo } from '../components/Logo.jsx';
import { Button, Input, Field, Spinner } from '../components/ui';
import { Mail, MailCheck, ArrowLeft } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setLoading(true);
    try { await Auth.forgot(email); setSent(true); } catch { setSent(true); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative" style={{ background: 'linear-gradient(140deg,#070b18,#0b1330 55%,#111b3f)' }}>
      <div className="aurora"><b className="b1" /><b className="b2" /></div>
      <div className="relative z-10 w-full max-w-sm card p-8 animate-fadeIn">
        <div className="flex justify-center mb-6"><Logo size="md" light={false} /></div>
        {sent ? (
          <div className="text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center mb-4"><MailCheck className="w-8 h-8 text-emerald-500" /></div>
            <h1 className="font-display font-bold text-xl">Verifique seu e-mail</h1>
            <p className="text-sm text-muted mt-2">Se houver uma conta com <b>{email}</b>, enviamos um link para redefinir a senha. O link expira em 1 hora.</p>
            <Link to="/login"><Button variant="outline" className="w-full mt-6"><ArrowLeft className="w-4 h-4" /> Voltar ao login</Button></Link>
          </div>
        ) : (
          <>
            <h1 className="font-display text-2xl font-bold">Esqueceu a senha?</h1>
            <p className="text-muted text-sm mt-1 mb-6">Digite seu e-mail e enviaremos um link para criar uma nova senha.</p>
            <form onSubmit={submit} className="space-y-4">
              <Field label="E-mail">
                <div className="relative"><Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" className="pl-9" /></div>
              </Field>
              <Button type="submit" size="lg" className="w-full" disabled={loading}>{loading ? <Spinner className="w-4 h-4" /> : 'Enviar link'}</Button>
            </form>
            <p className="text-sm text-muted text-center mt-6"><Link to="/login" className="text-emerald-600 font-semibold">Voltar ao login</Link></p>
          </>
        )}
      </div>
    </div>
  );
}
