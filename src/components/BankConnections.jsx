import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plug, Plus, RefreshCw, Trash2, ShieldCheck, AlertCircle, CheckCircle2, Building2, ExternalLink } from 'lucide-react';
import { Button, Badge, Spinner } from './ui';
import { Integrations } from '../api/entities.js';
import { toast } from '../lib/toast.js';

// Carrega o script do Pluggy Connect uma unica vez.
let _pluggyPromise = null;
function loadPluggyScript(url) {
  if (window.PluggyConnect) return Promise.resolve(window.PluggyConnect);
  if (_pluggyPromise) return _pluggyPromise;
  _pluggyPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = url; s.async = true;
    s.onload = () => resolve(window.PluggyConnect);
    s.onerror = () => { _pluggyPromise = null; reject(new Error('script')); };
    document.head.appendChild(s);
  });
  return _pluggyPromise;
}

// Gerenciador de bancos conectados via Pluggy (Open Finance).
// Reutilizavel: usado na tela de Carga Tributaria e pode ir para Configuracoes.
export function BankConnections() {
  const qc = useQueryClient();
  const [connecting, setConnecting] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['integrations-status'], queryFn: () => Integrations.status() });
  const refresh = () => qc.invalidateQueries({ queryKey: ['integrations-status'] });

  const disconnect = useMutation({
    mutationFn: (id) => Integrations.disconnect(id),
    onSuccess: () => { toast.success('Banco desconectado'); refresh(); },
    onError: (e) => toast.error(e.message || 'Falha ao desconectar'),
  });

  const openWidget = async (itemId) => {
    setConnecting(true);
    try {
      const PluggyConnect = await loadPluggyScript(data.connectUrl).catch(() => null);
      if (!PluggyConnect) {
        toast.error('Não consegui carregar o widget do Pluggy. Confirme a URL em PLUGGY_CONNECT_URL.');
        setConnecting(false); return;
      }
      const { accessToken } = await Integrations.connectToken(itemId);
      const pluggy = new PluggyConnect({
        connectToken: accessToken,
        includeSandbox: true, // permite conectar bancos de teste (sandbox) gratuitos
        onSuccess: async (itemData) => {
          try {
            const id = itemData?.item?.id || itemData?.itemId;
            await Integrations.saveItem(id);
            toast.success('Banco conectado!');
            refresh();
          } catch (e) { toast.error(e.message || 'Falha ao salvar conexão'); }
          setConnecting(false);
        },
        onError: () => { setConnecting(false); },
        onClose: () => { setConnecting(false); },
      });
      pluggy.init();
    } catch (e) {
      toast.error(e.message || 'Falha ao iniciar conexão');
      setConnecting(false);
    }
  };

  if (isLoading) return <div className="flex justify-center py-4"><Spinner className="w-5 h-5" /></div>;

  // Servidor sem credenciais Pluggy -> instrucoes de configuracao
  if (!data?.configured) {
    return (
      <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 text-sm">
        <p className="font-semibold flex items-center gap-2 text-amber-700 dark:text-amber-300"><AlertCircle className="w-4 h-4" /> Conexão bancária ainda não configurada</p>
        <p className="text-xs text-muted mt-1">Para conectar bancos de verdade (Nubank, Itaú, Mercado Pago, Caixa e outros) via Open Finance, o servidor precisa das chaves do Pluggy:</p>
        <ol className="text-xs text-muted mt-2 space-y-1 list-decimal ml-4">
          <li>Crie uma conta grátis em <a className="text-emerald-600 underline" href="https://dashboard.pluggy.ai" target="_blank" rel="noreferrer">dashboard.pluggy.ai <ExternalLink className="inline w-3 h-3" /></a></li>
          <li>Copie seu <b>Client ID</b> e <b>Client Secret</b></li>
          <li>Na Vercel do Monvy, adicione as variáveis <code>PLUGGY_CLIENT_ID</code> e <code>PLUGGY_CLIENT_SECRET</code> e faça redeploy</li>
        </ol>
      </div>
    );
  }

  const conns = data.connections || [];
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Você autoriza no ambiente seguro do banco. O Monvy nunca vê sua senha.</p>
        <Button size="sm" onClick={() => openWidget()} disabled={connecting}>{connecting ? <Spinner className="w-4 h-4" /> : <><Plus className="w-4 h-4" /> Conectar banco</>}</Button>
      </div>

      {conns.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-4 text-center text-sm text-muted">
          Nenhum banco conectado ainda. Conecte Nubank, Mercado Pago, Itaú e outros para uma análise tributária mais precisa.
        </div>
      ) : conns.map((c) => (
        <div key={c.id} className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 p-3">
          <div className="flex items-center gap-3">
            {c.image_url
              ? <img src={c.image_url} alt="" className="w-9 h-9 rounded-lg object-contain bg-white" />
              : <span className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center"><Building2 className="w-4 h-4" /></span>}
            <div>
              <p className="font-semibold text-sm flex items-center gap-2">{c.institution}
                <Badge color={c.status === 'UPDATED' ? 'emerald' : c.status === 'OUTDATED' ? 'amber' : 'slate'}>
                  {c.status === 'UPDATED' ? <><CheckCircle2 className="w-3 h-3" /> ativo</> : c.status}
                </Badge>
              </p>
              <p className="text-xs text-muted">{c.last_synced_at ? `sincronizado ${new Date(c.last_synced_at).toLocaleDateString('pt-BR')}` : 'ainda não sincronizado'}</p>
            </div>
          </div>
          <div className="flex gap-1">
            <button className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-muted" title="Reconectar / atualizar" onClick={() => openWidget(c.item_id)}><RefreshCw className="w-4 h-4" /></button>
            <button className="w-8 h-8 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 flex items-center justify-center text-rose-500" title="Desconectar" onClick={() => { if (confirm(`Desconectar ${c.institution}?`)) disconnect.mutate(c.id); }}><Trash2 className="w-4 h-4" /></button>
          </div>
        </div>
      ))}
    </div>
  );
}
