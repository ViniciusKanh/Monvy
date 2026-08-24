import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Admin } from '../api/entities.js';
import { useAuth } from '../context/AuthContext.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { Button, Card, Modal, Spinner, Badge, EmptyState } from '../components/ui';
import { NAV_GROUPS } from '../lib/screens.js';
import { Users as UsersIcon, ShieldCheck, Trash2, SlidersHorizontal, Smartphone, RotateCcw } from 'lucide-react';

export default function Users() {
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const { data: users = [], isLoading } = useQuery({ queryKey: ['admin-users'], queryFn: () => Admin.listUsers() });
  const [editing, setEditing] = useState(null);
  const [screens, setScreens] = useState([]);
  const [role, setRole] = useState('user');
  const [require2fa, setRequire2fa] = useState(false);
  const [active, setActive] = useState(true);

  const save = useMutation({
    mutationFn: ({ id, data }) => Admin.updateUser(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); setEditing(null); },
  });
  const del = useMutation({ mutationFn: (id) => Admin.removeUser(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }) });

  const openEdit = (u) => { setEditing(u); setScreens(u.allowed_screens || []); setRole(u.role); setRequire2fa(!!u.require_2fa); setActive(u.is_active !== false); };
  const toggle = (key) => setScreens((s) => s.includes(key) ? s.filter((k) => k !== key) : [...s, key]);

  return (
    <div>
      <PageHeader title="Usuários & Acessos" subtitle="Controle quem acessa cada tela do sistema" />

      {isLoading ? <div className="flex justify-center py-10"><Spinner className="w-6 h-6 text-emerald-500" /></div>
        : users.length === 0 ? <Card><EmptyState icon={UsersIcon} title="Nenhum usuário" /></Card>
        : (
          <Card className="p-0 divide-y divide-[hsl(var(--border))]">
            {users.map((u) => (
              <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-emerald-300 font-bold">{(u.full_name || u.email).slice(0, 1).toUpperCase()}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{u.full_name || '(sem nome)'} {u.id === me?.id && <span className="text-xs text-muted">(você)</span>}</p>
                  <p className="text-xs text-muted truncate">{u.email}</p>
                </div>
                {u.role === 'admin' ? <Badge color="emerald"><ShieldCheck className="w-3 h-3" /> Admin</Badge> : <Badge>{u.allowed_screens?.length || 0} telas</Badge>}
                {u.totp_enabled && <Badge color="violet"><Smartphone className="w-3 h-3" /> 2FA</Badge>}
                {!u.is_active && <Badge color="rose">Inativo</Badge>}
                <Button size="sm" variant="outline" onClick={() => openEdit(u)}><SlidersHorizontal className="w-4 h-4" /> Acessos</Button>
                {u.id !== me?.id && <button onClick={() => del.mutate(u.id)} className="p-2 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"><Trash2 className="w-4 h-4" /></button>}
              </div>
            ))}
          </Card>
        )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Acessos: ${editing?.full_name || editing?.email || ''}`} maxWidth="max-w-2xl"
        footer={<><Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button><Button onClick={() => save.mutate({ id: editing.id, data: { role, allowed_screens: role === 'admin' ? undefined : screens, require_2fa: require2fa, is_active: active } })} disabled={save.isPending}>{save.isPending ? <Spinner className="w-4 h-4" /> : 'Salvar'}</Button></>}>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Papel:</span>
            <div className="inline-flex p-1 rounded-lg bg-black/5 dark:bg-white/5">
              {[['user', 'Usuário'], ['admin', 'Admin']].map(([v, l]) => (
                <button key={v} onClick={() => setRole(v)} className={`px-3 py-1 rounded-md text-sm font-semibold ${role === v ? 'bg-[hsl(var(--card))] shadow' : 'text-muted'}`}>{l}</button>
              ))}
            </div>
            {role === 'admin' && <span className="text-xs text-emerald-600">Admin acessa todas as telas.</span>}
          </div>

          {role !== 'admin' && NAV_GROUPS.map((g) => (
            <div key={g.label}>
              <p className="text-xs font-bold tracking-widest text-muted mb-2">{g.label.toUpperCase()}</p>
              <div className="grid grid-cols-2 gap-2">
                {g.items.filter((i) => !i.adminOnly).map((i) => (
                  <label key={i.key} className="flex items-center gap-2 text-sm p-2 rounded-lg border border-[hsl(var(--border))] cursor-pointer hover:bg-black/5 dark:hover:bg-white/5">
                    <input type="checkbox" className="w-4 h-4 accent-emerald-500" checked={screens.includes(i.key)} onChange={() => toggle(i.key)} />
                    {i.label}
                  </label>
                ))}
              </div>
            </div>
          ))}

          <div className="pt-3 border-t border-[hsl(var(--border))] space-y-2">
            <p className="text-xs font-bold tracking-widest text-muted">SEGURANCA</p>
            <label className="flex items-center justify-between gap-2 text-sm p-2 rounded-lg border border-[hsl(var(--border))] cursor-pointer">
              <span>Conta ativa</span>
              <input type="checkbox" className="w-4 h-4 accent-emerald-500" checked={active} onChange={(e) => setActive(e.target.checked)} disabled={editing?.id === me?.id} />
            </label>
            <label className="flex items-center justify-between gap-2 text-sm p-2 rounded-lg border border-[hsl(var(--border))] cursor-pointer">
              <span className="flex items-center gap-2"><Smartphone className="w-4 h-4 text-indigo-500" /> Exigir verificacao em duas etapas</span>
              <input type="checkbox" className="w-4 h-4 accent-emerald-500" checked={require2fa} onChange={(e) => setRequire2fa(e.target.checked)} />
            </label>
            {editing?.totp_enabled && (
              <Button size="sm" variant="outline" onClick={() => save.mutate({ id: editing.id, data: { reset_2fa: true } })} disabled={save.isPending} className="w-full text-rose-500">
                <RotateCcw className="w-4 h-4" /> Resetar 2FA (desativar deste usuário)
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
