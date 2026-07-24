import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Logo } from '../components/Logo.jsx';
import { Button, Input, Field, Spinner } from '../components/ui';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) navigate('/', { replace: true });

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await login(email, password);
      navigate(location.state?.from?.pathname || '/', { replace: true });
    } catch (err) {
      setError(err.message || 'Falha no login');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Painel esquerdo (marca) */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-[#080d1f] to-[#0d1433] text-white">
        <Logo size="lg" />
        <div>
          <h2 className="font-display text-4xl font-extrabold leading-tight">Controle total das suas<br /><span className="text-emerald-400">financas pessoais.</span></h2>
          <p className="text-slate-400 mt-4 max-w-md">Contas, cartoes, metas, orcamento e inteligencia financeira em um so lugar. Simples, visual e no seu bolso.</p>
        </div>
        <p className="text-xs text-slate-500">Monvy © {new Date().getFullYear()} — Gestao Financeira</p>
      </div>

      {/* Formulario */}
      <div className="flex items-center justify-center p-6 sm:p-12 bg-[hsl(var(--bg))]">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8 flex justify-center"><Logo size="md" light={false} /></div>
          <h1 className="font-display text-2xl font-bold">Bem-vindo de volta 👋</h1>
          <p className="text-muted text-sm mt-1 mb-6">Entre com sua conta para continuar.</p>

          {error && <div className="mb-4 text-sm text-rose-600 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-lg px-3 py-2">{error}</div>}

          <form onSubmit={submit} className="space-y-4">
            <Field label="Email">
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@email.com" className="pl-9" />
              </div>
            </Field>
            <Field label="Senha">
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <Input type={show ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="********" className="pl-9 pr-9" />
                <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </Field>
            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? <Spinner className="w-4 h-4" /> : 'Entrar'}
            </Button>
          </form>

          <p className="text-sm text-muted text-center mt-6">
            Nao tem conta? <Link to="/cadastro" className="text-emerald-600 font-semibold">Cadastre-se</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
