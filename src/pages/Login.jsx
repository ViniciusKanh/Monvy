import { useEffect, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Logo, LogoMark } from '../components/Logo.jsx';
import { Button, Input, Field, Spinner } from '../components/ui';
import { Auth } from '../api/entities.js';
import { toast } from '../lib/toast.js';
import { Mail, Lock, Eye, EyeOff, ShieldCheck, TrendingUp, Sparkles, Check } from 'lucide-react';

const FEATURES = [
  { icon: TrendingUp, title: 'Controle total', text: 'Contas, cartões, metas e orcamento em um só lugar.' },
  { icon: Sparkles, title: 'Analises inteligentes', text: 'Relatórios, previsões e alertas para planejar melhor.' },
  { icon: ShieldCheck, title: 'Seguro e privado', text: 'Seus dados protegidos com criptografia.' },
];

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [needVerify, setNeedVerify] = useState(false);
  const [needs2fa, setNeeds2fa] = useState(false);
  const [code, setCode] = useState('');
  const [remember, setRemember] = useState(true);
  const [success, setSuccess] = useState(false);

  useEffect(() => { if (user && !success) navigate('/', { replace: true }); }, [user]); // eslint-disable-line
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => navigate(location.state?.from?.pathname || '/', { replace: true }), 1150);
    return () => clearTimeout(t);
  }, [success]); // eslint-disable-line

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setNeedVerify(false); setLoading(true);
    try {
      await login(email, password, { code: needs2fa ? code : undefined, remember });
      setSuccess(true);
    } catch (err) {
      if (err.message === '2FA_REQUIRED') { setNeeds2fa(true); setError(''); setLoading(false); return; }
      if (err.message === '2FA_INVALID') { setError('Código de verificacao invalido.'); setLoading(false); return; }
      if (err.status === 403) { setNeedVerify(true); setError('Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.'); }
      else setError(err.message || 'Falha no login');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2 bg-[hsl(var(--bg))]">
      {/* Painel de marca */}
      <div className="relative overflow-hidden hidden lg:flex flex-col justify-between p-12 text-white"
        style={{ background: 'linear-gradient(140deg,#070b18,#0b1330 55%,#111b3f)' }}>
        <div className="aurora"><b className="b1" /><b className="b2" /><b className="b3" /></div>
        <div className="relative z-10"><Logo size="lg" /></div>
        <div className="relative z-10">
          <h2 className="font-display text-4xl xl:text-5xl font-extrabold leading-tight">Suas financas,<br /><span className="gradient-text">no controle.</span></h2>
          <p className="text-slate-400 mt-4 max-w-md">Organize, preveja e cresca. O Monvy transforma seus numeros em decisoes melhores.</p>
          <div className="mt-8 space-y-4 max-w-md">
            {FEATURES.map((f, i) => (
              <div key={i} className="flex items-start gap-3 reveal" style={{ animationDelay: `${i * 120}ms` }}>
                <span className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center shrink-0"><f.icon className="w-5 h-5 text-emerald-400" /></span>
                <div><p className="font-semibold">{f.title}</p><p className="text-sm text-slate-400">{f.text}</p></div>
              </div>
            ))}
          </div>
        </div>
        <p className="relative z-10 text-xs text-slate-500">Monvy © {new Date().getFullYear()} — Gestao Financeira</p>
      </div>

      {/* Formulario */}
      <div className="relative flex items-center justify-center p-6 sm:p-12 min-h-screen lg:min-h-0">
        {/* fundo aurora leve no mobile */}
        <div className="lg:hidden aurora"><b className="b1" /><b className="b2" /></div>
        <div className="relative z-10 w-full max-w-sm">
          <div className="lg:hidden mb-8 flex justify-center"><Logo size="md" light={false} /></div>
          <div className="card p-6 sm:p-8 animate-fadeIn">
            <h1 className="font-display text-2xl font-bold">Bem-vindo de volta 👋</h1>
            <p className="text-muted text-sm mt-1 mb-6">Entre com sua conta para continuar.</p>

            {error && (
              <div className="mb-4 text-sm text-rose-600 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-lg px-3 py-2">
                {error}
                {needVerify && <button type="button" onClick={async () => { try { await Auth.resend(email); toast.success('E-mail de confirmacao reenviado.'); } catch { toast.error('Nao foi possível reenviar.'); } }} className="block mt-1 font-semibold underline">Reenviar confirmacao</button>}
              </div>
            )}

            <form onSubmit={submit} className="space-y-4">
              <Field label="E-mail">
                <div className="relative"><Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" /><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="você@email.com" className="pl-10" autoComplete="email" /></div>
              </Field>
              <Field label="Senha">
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                  <Input type={show ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="********" className="pl-10 pr-10" autoComplete="current-password" />
                  <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">{show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                </div>
              </Field>
              {needs2fa && (
                <Field label="Código de verificacao (app autenticador)">
                  <Input inputMode="numeric" autoFocus maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" className="tracking-[0.4em] text-center text-lg" />
                  <span className="block text-xs text-muted mt-1">Abra seu app autenticador e digite o codigo de 6 digitos.</span>
                </Field>
              )}
              <div className="flex items-center justify-between -mt-1">
                <label className="flex items-center gap-2 text-xs text-muted cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-emerald-500" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Manter conectado</label>
                <Link to="/esqueci-senha" className="text-xs text-emerald-600 font-semibold hover:underline">Esqueci minha senha</Link>
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={loading}>{loading ? <Spinner className="w-4 h-4" /> : (needs2fa ? 'Verificar e entrar' : 'Entrar')}</Button>
            </form>
            <p className="text-sm text-muted text-center mt-6">Não tem conta? <Link to="/cadastro" className="text-emerald-600 font-semibold">Cadastre-se</Link></p>
            <p className="text-xs text-muted text-center mt-3 pt-3 border-t border-[hsl(var(--border))]">Dúvidas ou problemas? Fale com o suporte: <a href="mailto:vinicius-souza.santos@unesp.br" className="text-emerald-600 font-semibold hover:underline">vinicius-souza.santos@unesp.br</a></p>
          </div>
        </div>
      </div>

      {/* Overlay de sucesso */}
      {success && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center text-white" style={{ background: 'linear-gradient(140deg,#070b18,#0b1330 55%,#111b3f)' }}>
          <div className="aurora"><b className="b1" /><b className="b2" /><b className="b3" /></div>
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-24 h-24 rounded-3xl bg-white/5 ring-1 ring-white/10 flex items-center justify-center check-pop glow-pulse"><LogoMark className="w-14 h-14" /></div>
            <div className="mt-6 w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center check-pop" style={{ animationDelay: '.25s' }}><Check className="w-7 h-7 text-white" /></div>
            <p className="mt-4 font-display text-xl font-bold" style={{ animation: 'scaleIn .4s ease .4s both' }}>Bem-vindo de volta!</p>
            <p className="text-slate-400 text-sm">Preparando seu painel...</p>
          </div>
        </div>
      )}
    </div>
  );
}
