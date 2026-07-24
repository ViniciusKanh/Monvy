import { NavLink } from 'react-router-dom';
import { NAV_GROUPS } from '../lib/screens.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Logo } from '../components/Logo.jsx';
import { LogOut } from 'lucide-react';
import { cn } from '../lib/utils.js';

export function Sidebar({ onNavigate }) {
  const { user, logout, canAccess } = useAuth();

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-[#080d1f] to-[#0d1433] text-slate-300 w-72">
      <div className="px-5 py-5">
        <Logo size="md" />
        <p className="text-[10px] tracking-widest text-slate-500 mt-1 ml-11 -mt-1">GESTAO FINANCEIRA</p>
      </div>

      <div className="mx-4 mb-4 p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
        {user?.photo_url
          ? <img src={user.photo_url} alt="" className="w-10 h-10 rounded-full object-cover border border-emerald-500/40" />
          : <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 font-bold">{(user?.full_name || user?.email || '?').slice(0, 1).toUpperCase()}</div>}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">{user?.full_name || 'Usuario'}</p>
          <p className="text-[11px] text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            {user?.role === 'admin' ? 'Administrador' : 'Conta Premium'}
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-4">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((it) => (!it.adminOnly || user?.role === 'admin') && canAccess(it.key));
          if (!items.length) return null;
          return (
            <div key={group.label}>
              <p className="px-3 text-[10px] font-bold tracking-widest text-slate-500 mb-1.5">{group.label.toUpperCase()}</p>
              <div className="space-y-0.5">
                {items.map((it) => (
                  <NavLink key={it.key} to={it.path} end={it.path === '/'} onClick={onNavigate}
                    className={({ isActive }) => cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition',
                      isActive ? 'bg-emerald-500/15 text-emerald-300' : 'text-slate-400 hover:text-white hover:bg-white/5'
                    )}>
                    <it.icon className="w-[18px] h-[18px]" />
                    <span className="truncate">{it.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      <button onClick={logout}
        className="m-3 flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5">
        <LogOut className="w-[18px] h-[18px]" /> Sair da conta
      </button>
    </div>
  );
}
