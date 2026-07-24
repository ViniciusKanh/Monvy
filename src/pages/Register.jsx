import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Logo } from '../components/Logo.jsx';
import { Button, Input, Field, Spinner } from '../components/ui';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) return setError('A senha deve ter ao menos 8 caracteres.');
    if (form.password !== form.confirm) return setError('As senhas nao conferem.');
    setLoading(true);
    try {
      await register({ full_name: form.full_name, email: form.email, password: form.password });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Falha no cadastro');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-[#080d1f] to-[#0d1433] text-white">
        <Logo size="lg" />
        <div>
          <h2 className="font-display text-4xl font-extrabold leading-tight">Comece a organizar<br /><span className="text-emerald-400">seu dinheiro hoje.</span></h2>
          <p className="text-slate-400 mt-4 max-w-md">Crie sua conta gratuita e tenha uma visao clara de para onde vai cada real.</p>
        </div>
        <p className="text-xs text-slate-500">Monvy © {new Date().getFullYear()}</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12 bg-[hsl(var(--bg))]">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8 flex justify-center"><Logo size="md" light={false} /></div>
          <h1 className="font-display text-2xl font-bold">Criar conta</h1>
          <p className="text-muted text-sm mt-1 mb-6">Leva menos de um minuto.</p>

          {error && <div className="mb-4 text-sm text-rose-600 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-lg px-3 py-2">{error}</div>}

          <form onSubmit={submit} className="space-y-4">
            <Field label="Nome completo">
              <Input required value={form.full_name} onChange={set('full_name')} placeholder="Seu nome" />
            </Field>
            <Field label="Email">
              <Input type="email" required value={form.email} onChange={set('email')} placeholder="voce@email.com" />
            </Field>
            <Field label="Senha" hint="Minimo de 8 caracteres">
              <Input type="password" required value={form.password} onChange={set('password')} placeholder="********" />
            </Field>
            <Field label="Confirmar senha">
              <Input type="password" required value={form.confirm} onChange={set('confirm')} placeholder="********" />
            </Field>
            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? <Spinner className="w-4 h-4" /> : 'Criar conta'}
            </Button>
          </form>

          <p className="text-sm text-muted text-center mt-6">
            Ja tem conta? <Link to="/login" className="text-emerald-600 font-semibold">Entrar</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
