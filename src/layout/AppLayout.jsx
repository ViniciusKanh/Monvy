import { useState, useEffect } from 'react';
import { Outlet, useLocation, NavLink } from 'react-router-dom';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { Account } from '../api/entities.js';
import { Onboarding } from '../components/Onboarding.jsx';
import { WhatsNew } from '../components/WhatsNew.jsx';
import { QuickAdd } from '../components/QuickAdd.jsx';
import { Bootstrap } from '../api/entities.js';
import { Sidebar } from './Sidebar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { NAV_GROUPS } from '../lib/screens.js';
import { Logo } from '../components/Logo.jsx';
import { Menu, X, Sun, Moon, Search } from 'lucide-react';
import { AlertsBell } from '../components/AlertsBell.jsx';
import { GlobalSearch, openGlobalSearch } from '../components/GlobalSearch.jsx';
import { OnboardingWizard } from '../components/OnboardingWizard.jsx';
import { ErrorBoundary } from '../components/ErrorBoundary.jsx';
import { LayoutDashboard, Wallet, CreditCard, ArrowLeftRight, Tags } from 'lucide-react';
import { cn } from '../lib/utils.js';

const BOTTOM_NAV = [
  { key: 'dashboard', label: 'Inicio', path: '/', icon: LayoutDashboard },
  { key: 'accounts', label: 'Contas', path: '/contas', icon: Wallet },
  { key: 'cards', label: 'Cartoes', path: '/cartoes', icon: CreditCard },
  { key: 'transactions', label: 'Lancam.', path: '/lancamentos', icon: ArrowLeftRight },
  { key: 'categories', label: 'Categ.', path: '/categorias', icon: Tags },
];

function currentIcon(pathname) {
  for (const g of NAV_GROUPS) { const it = g.items.find((i) => i.path === pathname); if (it) return it.icon; }
  return LayoutDashboard;
}

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
  const [onboarded, setOnboarded] = useState(() => { try { return localStorage.getItem('monvy_onboarded') === '1'; } catch { return false; } });
  const { data: accs, isSuccess: accsReady } = useQuery({ queryKey: ['accounts'], queryFn: () => Account.list(), enabled: !!user });
  const showOnboarding = !!user && accsReady && Array.isArray(accs) && accs.length === 0 && !onboarded;

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
      {showOnboarding && <Onboarding name={user?.full_name} onDone={() => setOnboarded(true)} />}
      {!!user && !showOnboarding && <WhatsNew />}
      {!!user && !showOnboarding && <QuickAdd />}
      {!!user && <GlobalSearch />}
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
        <header className="hidden lg:block sticky top-0 z-20">
          <div className="flex items-center justify-between px-8 py-3.5 bg-[hsl(var(--card))]/70 backdrop-blur-xl border-b border-[hsl(var(--border))]">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm bg-gradient-to-br from-emerald-500 to-indigo-500">
                {(() => { const It = currentIcon(location.pathname); return <It className="w-[18px] h-[18px]" />; })()}
              </span>
              <div>
                <h1 className="font-display font-bold text-xl leading-none">{currentTitle(location.pathname)}</h1>
                <p className="text-[11px] text-muted capitalize mt-1">{today}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden xl:flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-300 bg-emerald-500/10 px-3 py-1.5 rounded-full ring-1 ring-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Sistema Online
              </span>
              <button onClick={openGlobalSearch} className="hidden md:flex items-center gap-2 text-sm text-muted bg-black/5 dark:bg-white/5 rounded-xl pl-3 pr-2 py-2 hover:bg-black/10 dark:hover:bg-white/10" title="Buscar (Ctrl+K)"><Search className="w-4 h-4" /> Buscar <kbd className="text-[10px] font-mono bg-black/10 dark:bg-white/10 rounded px-1 py-0.5 ml-1">Ctrl K</kbd></button>
              <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 rounded-xl px-1 py-1">
                <button onClick={openGlobalSearch} className="md:hidden p-2 rounded-lg hover:bg-black/10 dark:hover:bg-white/10" title="Buscar"><Search className="w-5 h-5" /></button>
                <button onClick={toggle} className="p-2 rounded-lg hover:bg-black/10 dark:hover:bg-white/10" title="Tema">{theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}</button>
                <AlertsBell />
              </div>
              <div className="flex items-center gap-2 pl-2 ml-1 border-l border-[hsl(var(--border))]">
                <Avatar user={user} className="w-9 h-9 ring-2 ring-emerald-500/30" />
                <div className="hidden xl:block">
                  <p className="text-sm font-semibold leading-tight">{user?.full_name || 'Usuario'}</p>
                  <p className="text-[11px] text-muted leading-tight">{user?.role === 'admin' ? 'Administrador' : 'Premium'}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="h-[3px] bg-gradient-to-r from-emerald-500 via-indigo-500 to-violet-500 opacity-80" />
        </header>

        {/* Header mobile */}
        <header className="lg:hidden sticky top-0 z-20">
          <div className="flex items-center justify-between px-4 py-3 text-white" style={{ background: 'linear-gradient(120deg,#080d1f,#111b3f)' }}>
            <button onClick={() => setMobileOpen(true)} className="p-1.5 rounded-lg hover:bg-white/10"><Menu /></button>
            <Logo size="sm" />
            <div className="flex items-center gap-1"><AlertsBell dark /><button onClick={toggle} className="p-1.5 rounded-lg hover:bg-white/10">{theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}</button></div>
          </div>
          <div className="h-[3px] bg-gradient-to-r from-emerald-500 via-indigo-500 to-violet-500" />
        </header>

        <main className="flex-1 p-3 sm:p-6 lg:p-8 pb-24 lg:pb-8 max-w-[1400px] w-full mx-auto overflow-x-hidden">
          <ErrorBoundary routeKey={location.pathname}><Outlet /></ErrorBoundary>
        </main>
        <OnboardingWizard />

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
