import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Auth } from '../api/entities.js';
import { Logo } from '../components/Logo.jsx';
import { Button, Spinner } from '../components/ui';
import { CheckCircle2, XCircle } from 'lucide-react';

export default function Verify() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState('loading'); // loading | ok | error
  const token = params.get('token');

  useEffect(() => {
    if (!token) { setState('error'); return; }
    Auth.verify(token).then(() => setState('ok')).catch(() => setState('error'));
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-[#080d1f] to-[#0d1433]">
      <div className="w-full max-w-md card p-8 text-center">
        <div className="flex justify-center mb-6"><Logo size="md" light={false} /></div>
        {state === 'loading' && <><Spinner className="w-8 h-8 text-emerald-500 mx-auto" /><p className="text-muted mt-4">Confirmando seu e-mail...</p></>}
        {state === 'ok' && <>
          <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center mb-4"><CheckCircle2 className="w-8 h-8 text-emerald-500" /></div>
          <h1 className="font-display font-bold text-xl">E-mail confirmado! 🎉</h1>
          <p className="text-sm text-muted mt-2">Sua conta esta ativa. Agora e só entrar.</p>
          <Button className="w-full mt-6" onClick={() => navigate('/login')}>Entrar no Monvy</Button>
        </>}
        {state === 'error' && <>
          <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-100 dark:bg-rose-500/15 flex items-center justify-center mb-4"><XCircle className="w-8 h-8 text-rose-500" /></div>
          <h1 className="font-display font-bold text-xl">Link invalido</h1>
          <p className="text-sm text-muted mt-2">Este link de confirmacao e invalido ou já foi usado. Tente reenviar na tela de login.</p>
          <Button variant="outline" className="w-full mt-6" onClick={() => navigate('/login')}>Ir para o login</Button>
        </>}
      </div>
    </div>
  );
}
