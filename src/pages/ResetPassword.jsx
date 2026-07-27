import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Auth } from '../api/entities.js';
import { Logo } from '../components/Logo.jsx';
import { Button, Input, Field, Spinner } from '../components/ui';
import { toast } from '../lib/toast.js';
import { Lock, CheckCircle2 } from 'lucide-react';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token');
  const [pw, setPw] = useState({ next: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (pw.next.length < 8) return toast.error('A senha deve ter ao menos 8 caracteres');
    if (pw.next !== pw.confirm) return toast.error('As senhas nao conferem');
    setLoading(true);
    try { await Auth.reset(token, pw.next); setDone(true); }
    catch (err) { toast.error(err.message || 'Nao foi possivel redefinir'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative" style={{ background: 'linear-gradient(140deg,#070b18,#0b1330 55%,#111b3f)' }}>
      <div className="aurora"><b className="b1" /><b className="b3" /></div>
      <div className="relative z-10 w-full max-w-sm card p-8 animate-fadeIn">
        <div className="flex justify-center mb-6"><Logo size="md" light={false} /></div>
        {done ? (
          <div className="text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center mb-4 check-pop"><CheckCircle2 className="w-8 h-8 text-emerald-500" /></div>
            <h1 className="font-display font-bold text-xl">Senha redefinida!</h1>
            <p className="text-sm text-muted mt-2">Agora e so entrar com a nova senha.</p>
            <Button className="w-full mt-6" onClick={() => navigate('/login')}>Ir para o login</Button>
          </div>
        ) : !token ? (
          <div className="text-center">
            <h1 className="font-display font-bold text-xl">Link invalido</h1>
            <p className="text-sm text-muted mt-2">Solicite um novo link de redefinicao.</p>
            <Link to="/esqueci-senha"><Button variant="outline" className="w-full mt-6">Solicitar novo link</Button></Link>
          </div>
        ) : (
          <>
            <h1 className="font-display text-2xl font-bold">Criar nova senha</h1>
            <p className="text-muted text-sm mt-1 mb-6">Escolha uma senha forte (min. 8 caracteres).</p>
            <form onSubmit={submit} className="space-y-4">
              <Field label="Nova senha"><div className="relative"><Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" /><Input type="password" required value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} placeholder="********" className="pl-10" /></div></Field>
              <Field label="Confirmar senha"><div className="relative"><Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" /><Input type="password" required value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} placeholder="********" className="pl-10" /></div></Field>
              <Button type="submit" size="lg" className="w-full" disabled={loading}>{loading ? <Spinner className="w-4 h-4" /> : 'Redefinir senha'}</Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
