import { useState, useEffect } from 'react';
import { Outlet, useLocation, NavLink } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Bootstrap } from '../api/entities.js';
import { Sidebar } from './Sidebar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { NAV_GROUPS } from '../lib/screens.js';
import { Logo } from '../components/Logo.jsx';
import { Menu, X, Sun, Moon } from 'lucide-react';
import { AlertsBell } from '../components/AlertsBell.jsx';
import { LayoutDashboard, Wallet, CreditCard, ArrowLeftRight, Tags } from 'lucide-react';
import { cn } from '../lib/utils.js';

const BOTTOM_NAV = [
  { key: 'dashboard', label: 'Inicio', path: '/', icon: LayoutDashboard },
  { key: 'accounts', label: 'Contas', path: '/contas', icon: Wallet },
  { key: 'cards', label: 'Cartoes', path: '/cartoes', icon: CreditCard },
  { key: 'transactions', label: 'Lancam.', path: '/lancamentos', icon: ArrowLeftRight },
  { key: 'categories', label: 'Categ.', path: '/categorias', icon: Tags },
];

function currentTitle(pathname) {
  for (const g of NAV_GROUPS) {
    const it = g.items.find((i) => i.path === pathname);
    if (it) return it.label;
  }
  return 'Monvy';
}

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, canAccess } = useAuth();
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const qc = useQueryClient();

  // Carrega tudo numa unica chamada e semeia o cache (app fica rapido)
  useEffect(() => {
    if (!user) return;
    let active = true;
    Bootstrap.load().then((b) => {
      if (!active || !b) return;
      qc.setQueryData(['accounts'], b.accounts);
      qc.setQueryData(['categories'], b.categories);
      qc.setQueryData(['transactions'], b.transactions);
      qc.setQueryData(['cards'], b.cards);
      qc.setQueryData(['cardtx'], b.cardTx);
      qc.setQueryData(['invoices'], b.invoices);
      qc.setQueryData(['goals'], b.goals);
      qc.setQueryData(['subscriptions'], b.subscriptions);
      qc.setQueryData(['safes'], b.safes);
      qc.setQueryData(['appsettings'], b.settings);
    }).catch(() => {});
    return () => { active = false; };
  }, [user, qc]);
  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen flex relative">
      <div className="aurora"><b className="b1" /><b className="b2" /><b className="b3" /><b className="b4" /></div>
      {/* Sidebar desktop */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 z-30"><Sidebar /></aside>

      {/* Drawer mobile */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
            <button onClick={() => setMobileOpen(false)} className="absolute top-4 right-4 text-white/70"><X /></button>
          </div>
        </div>
      )}

      <div className="flex-1 lg:ml-72 flex flex-col min-w-0 relative z-10">
        {/* Header desktop */}
        <header className="hidden lg:flex items-center justify-between px-8 py-4 border-b border-[hsl(var(--border))] bg-[hsl(var(--bg))]/80 backdrop-blur sticky top-0 z-20">
          <div>
            <h1 className="font-display font-bold text-xl">{currentTitle(location.pathname)}</h1>
            <p className="text-xs text-muted capitalize">{today}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Sistema Online
            </span>
            <button onClick={toggle} className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10">
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <AlertsBell />
            <div className="flex items-center gap-2 pl-3 border-l border-[hsl(var(--border))]">
              <Avatar user={user} className="w-9 h-9" />
              <div className="hidden xl:block">
                <p className="text-sm font-semibold leading-tight">{user?.full_name || 'Usuario'}</p>
                <p className="text-[11px] text-muted leading-tight">{user?.email}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Header mobile */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--border))] bg-[#080d1f] text-white sticky top-0 z-20">
          <button onClick={() => setMobileOpen(true)}><Menu /></button>
          <Logo size="sm" />
          <div className="flex items-center gap-1"><AlertsBell dark /><button onClick={toggle}>{theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}</button></div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 max-w-[1400px] w-full mx-auto">
          <Outlet />
        </main>

        {/* Bottom nav mobile */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-[hsl(var(--card))] border-t border-[hsl(var(--border))] flex">
          {BOTTOM_NAV.filter((i) => canAccess(i.key)).map((it) => (
            <NavLink key={it.key} to={it.path} end={it.path === '/'}
              className={({ isActive }) => cn('flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium',
                isActive ? 'text-emerald-500' : 'text-muted')}>
              <it.icon className="w-5 h-5" />{it.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}

function Avatar({ user, className = 'w-9 h-9' }) {
  if (user?.photo_url) return <img src={user.photo_url} alt="" className={`${className} rounded-full object-cover`} />;
  return (
    <div className={`${className} rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-300 font-bold`}>
      {(user?.full_name || user?.email || '?').slice(0, 1).toUpperCase()}
    </div>
  );
}
