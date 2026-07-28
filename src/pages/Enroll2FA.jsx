import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Auth } from '../api/entities.js';
import { Button, Input, Spinner } from '../components/ui';
import { toast } from '../lib/toast.js';
import { ShieldCheck, Smartphone, LogOut } from 'lucide-react';

// Tela bloqueante: o admin exigiu 2FA e o usuario ainda nao ativou.
export default function Enroll2FA() {
  const { user, logout, refreshUser } = useAuth();
  const [state, setState] = useState({ secret: '', otpauth: '', qr: '', loading: true });
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { secret, otpauth } = await Auth.setup2fa();
        let qr = '';
        try { const QR = (await import('qrcode')).default; qr = await QR.toDataURL(otpauth, { margin: 1, width: 210 }); } catch {}
        if (alive) setState({ secret, otpauth, qr, loading: false });
      } catch (e) { toast.error(e.message || 'Falha ao iniciar 2FA'); if (alive) setState((s) => ({ ...s, loading: false })); }
    })();
    return () => { alive = false; };
  }, []);

  const confirm = async () => {
    if (code.length < 6) return toast.error('Digite o codigo de 6 digitos');
    setBusy(true);
    try {
      await Auth.enable2fa(code);
      await refreshUser();
      toast.success('Verificacao em duas etapas ativada');
    } catch (e) {
      toast.error(e.message === '2FA_INVALID' ? 'Codigo invalido' : (e.message || 'Falha ao ativar'));
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[hsl(var(--bg))]/95 backdrop-blur-sm">
      <div className="w-full max-w-md card p-6 space-y-4">
        <div className="text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-500/15 flex items-center justify-center text-indigo-500 mb-3"><ShieldCheck className="w-7 h-7" /></div>
          <h1 className="text-xl font-bold">Ative a verificacao em duas etapas</h1>
          <p className="text-sm text-muted mt-1">O administrador tornou esta protecao obrigatoria para a conta <b>{user?.email}</b>. Configure agora para continuar.</p>
        </div>

        {state.loading ? (
          <div className="flex justify-center py-8"><Spinner className="w-6 h-6 text-emerald-500" /></div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted flex items-center gap-2"><Smartphone className="w-4 h-4 text-indigo-500" /> 1. Escaneie o QR code no seu app autenticador (Google Authenticator, Authy ou Microsoft Authenticator).</p>
            {state.qr && <img src={state.qr} alt="QR code 2FA" className="mx-auto rounded-lg border border-line" />}
            <div className="text-center">
              <span className="text-xs text-muted">Ou insira esta chave manualmente:</span>
              <div className="mt-1"><code className="text-[11px] bg-black/5 dark:bg-white/10 px-2 py-1 rounded break-all">{state.secret}</code></div>
            </div>
            <p className="text-xs text-muted">2. Digite o codigo de 6 digitos gerado para confirmar.</p>
            <Input inputMode="numeric" autoFocus maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" className="tracking-[0.4em] text-center text-lg" />
            <Button onClick={confirm} disabled={busy} size="lg" className="w-full">{busy ? <Spinner className="w-4 h-4" /> : 'Ativar e continuar'}</Button>
          </div>
        )}

        <button onClick={logout} className="w-full text-xs text-muted hover:text-rose-500 flex items-center justify-center gap-1 pt-1"><LogOut className="w-3 h-3" /> Sair</button>
      </div>
    </div>
  );
}
